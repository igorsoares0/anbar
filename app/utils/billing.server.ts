import { authenticate } from "../shopify.server";
import db from "../db.server";

export const BILLING_PLANS = {
  FREE: {
    id: "free",
    name: "Free Plan",
    price: 0,
    maxAnnouncements: 1,
    billingType: "free" as const,
    features: ["1 announcement bar", "Basic customization"],
  },
  MONTHLY: {
    id: "monthly",
    name: "Pro Monthly",
    price: 9.99,
    maxAnnouncements: -1, // unlimited
    billingType: "recurring" as const,
    interval: "every_30_days" as const,
    features: ["Unlimited announcement bars", "Advanced customization", "Priority support"],
  },
  ANNUAL: {
    id: "annual",
    name: "Pro Annual",
    price: 99,
    maxAnnouncements: -1, // unlimited
    billingType: "recurring" as const,
    interval: "annual" as const,
    features: ["Unlimited announcement bars", "Advanced customization", "Priority support", "2 months free"],
  },
} as const;

export async function getOrCreateSubscription(shop: string) {
  let subscription = await db.subscription.findUnique({
    where: { shop },
  });

  if (!subscription) {
    subscription = await db.subscription.create({
      data: {
        shop,
        planId: BILLING_PLANS.FREE.id,
        status: "active",
        billingType: BILLING_PLANS.FREE.billingType,
        maxAnnouncements: BILLING_PLANS.FREE.maxAnnouncements,
      },
    });
  }

  return subscription;
}

export async function createRecurringCharge(
  request: Request,
  planId: "monthly" | "annual"
) {
  const { admin, session } = await authenticate.admin(request);
  
  // Check if user has an existing active subscription
  const existingSubscription = await db.subscription.findUnique({
    where: { shop: session.shop },
  });

  // If switching plans, cancel the existing charge first
  if (existingSubscription && existingSubscription.chargeId && existingSubscription.planId !== "free") {
    // Cancelling existing subscription before creating new one
    
    try {
      // Cancel the existing charge
      const cancelResponse = await fetch(`https://${session.shop}/admin/api/2023-10/recurring_application_charges/${existingSubscription.chargeId}.json`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": session.accessToken,
        },
      });

      if (cancelResponse.ok) {
        // Successfully cancelled existing charge
      } else {
        // Failed to cancel existing charge
      }
    } catch (error) {
      // Error cancelling existing charge
    }
  }
  
  const plan = BILLING_PLANS[planId.toUpperCase() as keyof typeof BILLING_PLANS];
  if (!plan || plan.billingType !== "recurring") {
    throw new Error("Invalid plan for recurring charge");
  }

  // Use REST API directly
  const chargeData = {
    recurring_application_charge: {
      name: plan.name,
      price: plan.price,
      return_url: `${process.env.SHOPIFY_APP_URL}/app/billing/callback?plan_id=${planId}`,
      test: process.env.NODE_ENV === "development",
    }
  };

  if ("interval" in plan) {
    chargeData.recurring_application_charge.terms = `$${plan.price} ${plan.interval === "annual" ? "per year" : "every 30 days"}`;
  }

  // Make REST API call directly
  const response = await fetch(`https://${session.shop}/admin/api/2023-10/recurring_application_charges.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": session.accessToken,
    },
    body: JSON.stringify(chargeData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Billing Error - Create Charge Failed
    throw new Error(`Failed to create charge: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  return result.recurring_application_charge;
}

export async function activateRecurringCharge(
  request: Request,
  chargeId: string,
  planId: string
) {
  const { admin, session } = await authenticate.admin(request);

  // Activate charge using REST API
  const response = await fetch(`https://${session.shop}/admin/api/2023-10/recurring_application_charges/${chargeId}/activate.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": session.accessToken,
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Billing Error - Activate Charge Failed
    throw new Error(`Failed to activate charge: ${response.status} ${errorText}`);
  }

  const result = await response.json();

  const plan = Object.values(BILLING_PLANS).find(p => p.id === planId);
  if (!plan) {
    throw new Error("Invalid plan ID");
  }

  const now = new Date();
  const periodEnd = new Date(now);
  if (planId === "annual") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  const activatedCharge = result.recurring_application_charge;

  await db.subscription.upsert({
    where: { shop: session.shop },
    update: {
      planId,
      status: "active",
      billingType: plan.billingType,
      chargeId: String(activatedCharge.id),
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      maxAnnouncements: plan.maxAnnouncements,
    },
    create: {
      shop: session.shop,
      planId,
      status: "active",
      billingType: plan.billingType,
      chargeId: String(activatedCharge.id),
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      maxAnnouncements: plan.maxAnnouncements,
    },
  });

  return result.recurring_application_charge;
}

export async function cancelSubscription(request: Request) {
  const { admin, session } = await authenticate.admin(request);

  const subscription = await db.subscription.findUnique({
    where: { shop: session.shop },
  });

  if (!subscription || !subscription.chargeId) {
    throw new Error("No active subscription found");
  }

  if (subscription.status === "cancelled") {
    throw new Error("Subscription is already cancelled");
  }

  // DO NOT cancel in Shopify yet - only mark as cancelled in our database
  // The actual Shopify cancellation will happen when the period ends
  
  await db.subscription.update({
    where: { shop: session.shop },
    data: {
      status: "cancelled", // Mark as cancelled but keep current plan active until period end
      // Keep all other fields the same - planId, maxAnnouncements, etc.
    },
  });

  // Subscription marked for cancellation at period end
  return subscription;
}

export async function reactivateSubscription(request: Request) {
  const { admin, session } = await authenticate.admin(request);

  const subscription = await db.subscription.findUnique({
    where: { shop: session.shop },
  });

  if (!subscription || subscription.status !== "cancelled") {
    throw new Error("No cancelled subscription found");
  }

  // Check if still in active period
  const now = new Date();
  const isStillActive = subscription.currentPeriodEnd && now <= subscription.currentPeriodEnd;
  
  if (!isStillActive) {
    throw new Error("Cannot reactivate - subscription period has already ended");
  }

  // Reactivate by changing status back to active
  await db.subscription.update({
    where: { shop: session.shop },
    data: {
      status: "active", // Reactivate subscription
    },
  });

  // Subscription reactivated
  return subscription;
}

export async function processExpiredCancellations(accessToken?: string) {
  const now = new Date();
  
  // Find all cancelled subscriptions that have passed their period end
  const expiredCancellations = await db.subscription.findMany({
    where: {
      status: "cancelled",
      currentPeriodEnd: {
        lt: now,
      },
      chargeId: {
        not: null, // Only process subscriptions that still have a charge ID
      },
    },
  });

  for (const subscription of expiredCancellations) {
    try {
      // Now cancel in Shopify since the period has ended
      if (subscription.chargeId && accessToken) {
        const response = await fetch(`https://${subscription.shop}/admin/api/2023-10/recurring_application_charges/${subscription.chargeId}.json`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
          },
        });

        if (!response.ok) {
          // Failed to cancel charge in Shopify
        } else {
          // Successfully cancelled charge in Shopify
        }
      }
    } catch (error) {
      // Error cancelling charge in Shopify
    }

    // Update to free plan regardless of Shopify API success/failure
    await db.subscription.update({
      where: { id: subscription.id },
      data: {
        planId: BILLING_PLANS.FREE.id,
        status: "active",
        billingType: BILLING_PLANS.FREE.billingType,
        chargeId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        maxAnnouncements: BILLING_PLANS.FREE.maxAnnouncements,
      },
    });
    
    // Processed expired cancellation
  }

  return expiredCancellations.length;
}

export async function checkAnnouncementLimit(shop: string) {
  // Process any expired cancellations first (without access token - will only update database)
  await processExpiredCancellations();
  
  const subscription = await getOrCreateSubscription(shop);
  const announcementCount = await db.announcementBar.count({
    where: { shop },
  });

  // Check if subscription is cancelled but still in active period
  const now = new Date();
  const isInActivePeriod = subscription.currentPeriodEnd && now <= subscription.currentPeriodEnd;
  const effectiveMaxAnnouncements = (subscription.status === "cancelled" && !isInActivePeriod) 
    ? BILLING_PLANS.FREE.maxAnnouncements 
    : subscription.maxAnnouncements;

  const isLimitReached = effectiveMaxAnnouncements !== -1 && 
                        announcementCount >= effectiveMaxAnnouncements;

  return {
    subscription,
    announcementCount,
    isLimitReached,
    remainingCount: effectiveMaxAnnouncements === -1 ? 
                   Infinity : 
                   Math.max(0, effectiveMaxAnnouncements - announcementCount),
    isCancelledButActive: subscription.status === "cancelled" && isInActivePeriod,
  };
}
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
    console.error(`Billing Error - Create Charge Failed: ${response.status}`, {
      shop: session.shop,
      planId,
      error: errorText
    });
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
    console.error(`Billing Error - Activate Charge Failed: ${response.status}`, {
      shop: session.shop,
      chargeId,
      planId,
      error: errorText
    });
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
    periodEnd.setDate(periodEnd.getDate() + 30);
  }

  await db.subscription.upsert({
    where: { shop: session.shop },
    update: {
      planId,
      status: "active",
      billingType: plan.billingType,
      chargeId: String(charge.id),
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      maxAnnouncements: plan.maxAnnouncements,
    },
    create: {
      shop: session.shop,
      planId,
      status: "active",
      billingType: plan.billingType,
      chargeId: String(charge.id),
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

  // Cancel charge using REST API
  const response = await fetch(`https://${session.shop}/admin/api/2023-10/recurring_application_charges/${subscription.chargeId}.json`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": session.accessToken,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to cancel charge: ${response.status} ${errorText}`);
  }

  await db.subscription.update({
    where: { shop: session.shop },
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

  return subscription;
}

export async function checkAnnouncementLimit(shop: string) {
  const subscription = await getOrCreateSubscription(shop);
  const announcementCount = await db.announcementBar.count({
    where: { shop },
  });

  const isLimitReached = subscription.maxAnnouncements !== -1 && 
                        announcementCount >= subscription.maxAnnouncements;

  return {
    subscription,
    announcementCount,
    isLimitReached,
    remainingCount: subscription.maxAnnouncements === -1 ? 
                   Infinity : 
                   Math.max(0, subscription.maxAnnouncements - announcementCount),
  };
}
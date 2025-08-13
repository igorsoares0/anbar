import { authenticate } from "../shopify.server";
import db from "../db.server";
import { BILLING_PLANS } from "./billing.server";

export async function autoSyncSubscription(request: Request) {
  try {
    const { session } = await authenticate.admin(request);
    
    // Get current subscription from database
    const dbSubscription = await db.subscription.findUnique({
      where: { shop: session.shop },
    });

    // If already on paid plan, no need to check
    if (dbSubscription && dbSubscription.planId !== "free") {
      return dbSubscription;
    }

    // Check Shopify for active charges
    const response = await fetch(`https://${session.shop}/admin/api/2023-10/recurring_application_charges.json`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": session.accessToken,
      },
    });

    if (!response.ok) {
      // If we can't check, return existing subscription
      return dbSubscription;
    }

    const result = await response.json();
    const charges = result.recurring_application_charges;

    // Find most recent active charge
    const activeCharge = charges
      .filter((charge: any) => charge.status === "active")
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    if (!activeCharge) {
      // No active charges, ensure free plan
      return await db.subscription.upsert({
        where: { shop: session.shop },
        update: {
          planId: "free",
          status: "active",
          billingType: "free",
          chargeId: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          maxAnnouncements: 1,
        },
        create: {
          shop: session.shop,
          planId: "free",
          status: "active",
          billingType: "free",
          maxAnnouncements: 1,
        },
      });
    }

    // Active charge found - sync to database
    const planId = parseFloat(activeCharge.price) === 99 ? "annual" : "monthly";
    console.log(`Auto-sync: Charge price=${activeCharge.price}, detected planId=${planId}`);
    
    const plan = BILLING_PLANS[planId.toUpperCase() as keyof typeof BILLING_PLANS];
    const periodEnd = new Date(activeCharge.billing_on);
    const periodStart = new Date(activeCharge.activated_on);

    const updatedSubscription = await db.subscription.upsert({
      where: { shop: session.shop },
      update: {
        planId,
        status: "active",
        billingType: plan.billingType,
        chargeId: String(activeCharge.id),
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        maxAnnouncements: plan.maxAnnouncements,
      },
      create: {
        shop: session.shop,
        planId,
        status: "active",
        billingType: plan.billingType,
        chargeId: String(activeCharge.id),
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        maxAnnouncements: plan.maxAnnouncements,
      },
    });

    console.log(`Auto-synced subscription for ${session.shop}: ${planId}`);
    return updatedSubscription;

  } catch (error) {
    console.error("Auto-sync failed:", error);
    // Return existing or create free plan as fallback
    const { session } = await authenticate.admin(request);
    return await db.subscription.upsert({
      where: { shop: session.shop },
      update: {},
      create: {
        shop: session.shop,
        planId: "free",
        status: "active",
        billingType: "free",
        maxAnnouncements: 1,
      },
    });
  }
}
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { BILLING_PLANS } from "../utils/billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  const url = new URL(request.url);
  const shouldRedirect = url.searchParams.get("redirect");

  try {
    // Get all recurring charges for this shop
    const response = await fetch(`https://${session.shop}/admin/api/2023-10/recurring_application_charges.json`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": session.accessToken,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get charges: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    const charges = result.recurring_application_charges;

    // Find active charge
    const activeCharge = charges.find((charge: any) => charge.status === "active");

    if (!activeCharge) {
      return json({ error: "No active charges found" });
    }

    // Determine plan based on price
    const planId = parseFloat(activeCharge.price) === 99 ? "annual" : "monthly";
    console.log(`Manual sync: Charge price=${activeCharge.price}, detected planId=${planId}`);
    
    const plan = BILLING_PLANS[planId.toUpperCase() as keyof typeof BILLING_PLANS];
    
    // Calculate period end based on plan type
    const periodStart = new Date(activeCharge.activated_on);
    const periodEnd = new Date(periodStart);
    if (planId === "annual") {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const subscription = await db.subscription.upsert({
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

    if (shouldRedirect) {
      return redirect("/app/billing?success=subscription_activated");
    }

    return json({ 
      success: true, 
      activeCharge,
      subscription,
      message: "Subscription synced successfully!"
    });

  } catch (error) {
    // Log error but don't expose internal details
    console.error("Subscription sync failed:", error);
    
    if (shouldRedirect) {
      return redirect("/app/billing?error=sync_failed");
    }
    
    return json({ 
      error: "Failed to sync subscription"
    }, { status: 500 });
  }
};

export default function SyncPage() {
  return <div>Sync endpoint - check console</div>;
}
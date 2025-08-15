import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { BILLING_PLANS } from "../utils/billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const url = new URL(request.url);
    const chargeId = url.searchParams.get("charge_id");
    const planId = url.searchParams.get("plan_id");

    if (!chargeId || !planId) {
      return redirect("/app/billing?error=missing_parameters");
    }

    // Try to authenticate - if fails, sync via webhook later
    let session;
    try {
      const auth = await authenticate.admin(request);
      session = auth.session;
    } catch (authError) {
      console.log("Auth failed in callback, will sync via webhook");
      return redirect("/app/billing?pending=true");
    }

    // Get charge status from Shopify
    const response = await fetch(`https://${session.shop}/admin/api/2023-10/recurring_application_charges/${chargeId}.json`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": session.accessToken,
      },
    });

    if (!response.ok) {
      console.error("Failed to get charge status:", response.status);
      return redirect("/app/billing?error=charge_not_found");
    }

    const result = await response.json();
    const charge = result.recurring_application_charge;

    // Only proceed if charge is active
    if (charge.status !== "active") {
      return redirect("/app/billing?error=charge_not_active");
    }

    // Update subscription in database
    const plan = BILLING_PLANS[planId.toUpperCase() as keyof typeof BILLING_PLANS];
    if (!plan) {
      return redirect("/app/billing?error=invalid_plan");
    }

    // Calculate period end based on plan type
    const periodStart = new Date(charge.activated_on);
    const periodEnd = new Date(periodStart);
    if (planId === "annual") {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    await db.subscription.upsert({
      where: { shop: session.shop },
      update: {
        planId,
        status: "active",
        billingType: plan.billingType,
        chargeId: String(charge.id),
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        maxAnnouncements: plan.maxAnnouncements,
      },
      create: {
        shop: session.shop,
        planId,
        status: "active",
        billingType: plan.billingType,
        chargeId: String(charge.id),
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        maxAnnouncements: plan.maxAnnouncements,
      },
    });

    return redirect("/app/billing?success=subscription_activated");

  } catch (error) {
    console.error("Callback error:", error);
    return redirect("/app/billing?error=callback_failed");
  }
};
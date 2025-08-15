import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { BILLING_PLANS } from "../utils/billing.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for shop ${shop}`, {
    chargeId: payload.id,
    status: payload.status,
    price: payload.price
  });

  try {
    const charge = payload;
    
    if (charge.status === "cancelled" || charge.status === "declined") {
      await db.subscription.update({
        where: { shop },
        data: {
          status: "cancelled",
          planId: "free",
          billingType: "free",
          chargeId: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          maxAnnouncements: 1,
        },
      });
      console.log(`Subscription cancelled for shop ${shop}`);
    } else if (charge.status === "active") {
      // Determine plan based on price
      const planId = parseFloat(charge.price) === 99 ? "annual" : "monthly";
      console.log(`Webhook: Charge price=${charge.price}, detected planId=${planId}`);
      
      const plan = BILLING_PLANS[planId.toUpperCase() as keyof typeof BILLING_PLANS];
      
      // Calculate period end based on plan type
      const periodStart = charge.activated_on ? new Date(charge.activated_on) : new Date();
      const periodEnd = new Date(periodStart);
      if (planId === "annual") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      await db.subscription.upsert({
        where: { shop },
        update: {
          status: "active",
          planId,
          billingType: plan.billingType,
          chargeId: String(charge.id),
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          maxAnnouncements: plan.maxAnnouncements,
        },
        create: {
          shop,
          status: "active",
          planId,
          billingType: plan.billingType,
          chargeId: String(charge.id),
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          maxAnnouncements: plan.maxAnnouncements,
        },
      });
      console.log(`Subscription activated via webhook for shop ${shop} with plan ${planId}`);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error processing charges webhook:", error);
    return new Response("Error", { status: 500 });
  }
};
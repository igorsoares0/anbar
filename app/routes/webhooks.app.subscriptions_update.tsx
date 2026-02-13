import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { planKeyFromSubscriptionName } from "../utils/billing.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);

  console.log(`[WEBHOOK] app_subscriptions/update for ${shop}`, JSON.stringify(payload));

  if (!shop) return new Response();

  const status = (payload as any)?.app_subscription?.status;
  const name = (payload as any)?.app_subscription?.name;
  const adminGraphqlApiId = (payload as any)?.app_subscription?.admin_graphql_api_id;

  // Check if the shop record exists
  const shopRecord = await prisma.shop.findUnique({ where: { shop } });
  if (!shopRecord) {
    console.log(`[WEBHOOK] No shop record for ${shop}, skipping`);
    return new Response();
  }

  if (status === "ACTIVE") {
    const planKey = name ? planKeyFromSubscriptionName(name) : shopRecord.plan;
    await prisma.shop.update({
      where: { shop },
      data: {
        plan: planKey,
        subscriptionId: adminGraphqlApiId || shopRecord.subscriptionId,
        subscriptionStatus: status,
      },
    });
    console.log(`[WEBHOOK] Activated plan ${planKey} for ${shop}`);
  } else if (
    status === "CANCELLED" ||
    status === "DECLINED" ||
    status === "EXPIRED" ||
    status === "FROZEN"
  ) {
    await prisma.shop.update({
      where: { shop },
      data: {
        plan: "free",
        subscriptionId: null,
        subscriptionStatus: null,
      },
    });
    console.log(`[WEBHOOK] Reverted ${shop} to free (status: ${status})`);
  }

  return new Response();
};

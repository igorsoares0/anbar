import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { planKeyFromSubscriptionName, syncBarsToMetafields } from "../utils/billing.server";

const MAX_SYNC_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function syncBarsWithRetry(shop: string): Promise<void> {
  for (let attempt = 1; attempt <= MAX_SYNC_RETRIES; attempt++) {
    try {
      await syncBarsToMetafields(shop);
      console.log(`[WEBHOOK] Restored bars for ${shop} (attempt ${attempt})`);
      return;
    } catch (err) {
      console.error(`[WEBHOOK] Failed to restore bars for ${shop} (attempt ${attempt}/${MAX_SYNC_RETRIES}):`, err);
      if (attempt < MAX_SYNC_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
      }
    }
  }
  console.error(`[WEBHOOK] Exhausted retries restoring bars for ${shop}`);
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);

  console.log(`[WEBHOOK] app_subscriptions/update for ${shop}`, JSON.stringify(payload));

  if (!shop) return new Response(null, { status: 200 });

  const status = (payload as any)?.app_subscription?.status;
  const name = (payload as any)?.app_subscription?.name;
  const adminGraphqlApiId = (payload as any)?.app_subscription?.admin_graphql_api_id;

  // Check if the shop record exists
  const shopRecord = await prisma.shop.findUnique({ where: { shop } });
  if (!shopRecord) {
    console.log(`[WEBHOOK] No shop record for ${shop}, skipping`);
    return new Response(null, { status: 200 });
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

    // Await sync with retries so bars are restored after upgrade
    await syncBarsWithRetry(shop);
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

  return new Response(null, { status: 200 });
};

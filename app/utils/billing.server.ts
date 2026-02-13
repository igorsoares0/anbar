import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";
import { PLANS, type PlanKey } from "./plans";

export { PLANS, type PlanKey };

type AdminGraphQL = {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function getOrCreateShop(shopDomain: string) {
  return prisma.shop.upsert({
    where: { shop: shopDomain },
    create: { shop: shopDomain },
    update: {},
  });
}

export async function getMonthlyUsage(shopDomain: string): Promise<number> {
  const month = getCurrentMonth();
  const usage = await prisma.monthlyUsage.findUnique({
    where: { shop_month: { shop: shopDomain, month } },
  });
  return usage?.viewCount ?? 0;
}

export async function incrementViewCount(shopDomain: string): Promise<{
  viewCount: number;
  limitExceeded: boolean;
}> {
  const month = getCurrentMonth();

  // Ensure shop record exists
  await getOrCreateShop(shopDomain);

  const usage = await prisma.monthlyUsage.upsert({
    where: { shop_month: { shop: shopDomain, month } },
    create: { shop: shopDomain, month, viewCount: 1 },
    update: { viewCount: { increment: 1 } },
  });

  const shop = await prisma.shop.findUnique({ where: { shop: shopDomain } });
  const plan = PLANS[(shop?.plan as PlanKey) ?? "free"] ?? PLANS.free;
  const limitExceeded = usage.viewCount > plan.viewLimit;

  return { viewCount: usage.viewCount, limitExceeded };
}

export async function isViewLimitExceeded(shopDomain: string): Promise<boolean> {
  const shop = await prisma.shop.findUnique({ where: { shop: shopDomain } });
  const plan = PLANS[(shop?.plan as PlanKey) ?? "free"] ?? PLANS.free;
  if (plan.viewLimit === Infinity) return false;

  const viewCount = await getMonthlyUsage(shopDomain);
  return viewCount > plan.viewLimit;
}

export async function getShopPlan(shopDomain: string) {
  const shop = await getOrCreateShop(shopDomain);
  const planKey = (shop.plan as PlanKey) || "free";
  return {
    ...PLANS[planKey] ?? PLANS.free,
    key: planKey,
    subscriptionId: shop.subscriptionId,
    subscriptionStatus: shop.subscriptionStatus,
  };
}

export async function createSubscription(
  admin: AdminGraphQL,
  planKey: PlanKey,
  returnUrl: string,
): Promise<{ confirmationUrl: string | null; error?: string }> {
  const plan = PLANS[planKey];
  if (!plan || planKey === "free") {
    return { confirmationUrl: null, error: "Invalid plan" };
  }

  const response = await admin.graphql(
    `mutation appSubscriptionCreate($name: String!, $returnUrl: URL!, $trialDays: Int!, $lineItems: [AppSubscriptionLineItemInput!]!) {
      appSubscriptionCreate(
        name: $name
        returnUrl: $returnUrl
        trialDays: $trialDays
        test: true
        lineItems: $lineItems
      ) {
        appSubscription {
          id
        }
        confirmationUrl
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        name: `Anbar ${plan.name}`,
        returnUrl,
        trialDays: 7,
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                price: { amount: plan.price, currencyCode: "USD" },
              },
            },
          },
        ],
      },
    },
  );

  const result = await response.json();
  const data = result.data?.appSubscriptionCreate;

  if (data?.userErrors?.length > 0) {
    return { confirmationUrl: null, error: data.userErrors[0].message };
  }

  return { confirmationUrl: data?.confirmationUrl ?? null };
}

export async function cancelSubscription(
  admin: AdminGraphQL,
  subscriptionId: string,
): Promise<{ success: boolean; error?: string }> {
  const response = await admin.graphql(
    `mutation appSubscriptionCancel($id: ID!) {
      appSubscriptionCancel(id: $id) {
        appSubscription {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }`,
    { variables: { id: subscriptionId } },
  );

  const result = await response.json();
  const data = result.data?.appSubscriptionCancel;

  if (data?.userErrors?.length > 0) {
    return { success: false, error: data.userErrors[0].message };
  }

  return { success: true };
}

export async function getActiveSubscription(
  admin: AdminGraphQL,
): Promise<{ id: string; name: string; status: string } | null> {
  const response = await admin.graphql(
    `query {
      currentAppInstallation {
        activeSubscriptions {
          id
          name
          status
          test
          lineItems {
            plan {
              pricingDetails {
                ... on AppRecurringPricing {
                  price {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
      }
    }`,
  );

  const result = await response.json();
  const subs = result.data?.currentAppInstallation?.activeSubscriptions ?? [];

  if (subs.length === 0) return null;

  return {
    id: subs[0].id,
    name: subs[0].name,
    status: subs[0].status,
  };
}

export async function syncEmptyBarsToMetafields(shopDomain: string) {
  try {
    const { admin } = await unauthenticated.admin(shopDomain);

    const shopResult = await admin.graphql(
      `query { shop { id } }`,
    );
    const shopData = await shopResult.json();
    const shopId = shopData.data.shop.id;

    await admin.graphql(
      `mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          metafields: [
            {
              ownerId: shopId,
              namespace: "anbar",
              key: "bars",
              value: JSON.stringify([]),
              type: "json",
            },
          ],
        },
      },
    );

    console.log(`[BILLING] Cleared metafields for ${shopDomain} (limit exceeded)`);
  } catch (error) {
    console.error(`[BILLING] Failed to clear metafields for ${shopDomain}:`, error);
  }
}

export async function syncBarsToMetafields(shopDomain: string) {
  try {
    const { admin } = await unauthenticated.admin(shopDomain);

    const bars = await prisma.announcementBar.findMany({
      where: { shop: shopDomain, isActive: true, isPublished: true },
      orderBy: { createdAt: "desc" },
    });

    const shopResult = await admin.graphql(`query { shop { id } }`);
    const shopData = await shopResult.json();
    const shopId = shopData.data.shop.id;

    await admin.graphql(
      `mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          metafields: [
            {
              ownerId: shopId,
              namespace: "anbar",
              key: "bars",
              value: JSON.stringify(bars),
              type: "json",
            },
          ],
        },
      },
    );

    console.log(`[BILLING] Restored ${bars.length} bars to metafields for ${shopDomain}`);
  } catch (error) {
    console.error(`[BILLING] Failed to restore bars for ${shopDomain}:`, error);
  }
}

export function planKeyFromSubscriptionName(name: string): PlanKey {
  const lower = name.toLowerCase();
  if (lower.includes("enterprise")) return "enterprise";
  if (lower.includes("professional")) return "professional";
  if (lower.includes("starter")) return "starter";
  return "free";
}

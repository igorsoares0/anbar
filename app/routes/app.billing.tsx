import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  ProgressBar,
  Banner,
  Button,
  Badge,
  Box,
  InlineGrid,
  Divider,
} from "@shopify/polaris";
import { authenticate, BILLING_PLANS } from "../shopify.server";
import {
  getOrCreateShop,
  getMonthlyUsage,
  getActiveSubscription,
  planKeyFromSubscriptionName,
  isViewLimitExceeded,
} from "../utils/billing.server";
import { syncAnnouncementBarsToMetafields } from "../utils/syncAnnouncementBars.server";
import { PLANS, type PlanKey } from "../utils/plans";
import prisma from "../db.server";

const PLAN_KEY_TO_BILLING_NAME = {
  starter: BILLING_PLANS.STARTER,
  professional: BILLING_PLANS.PROFESSIONAL,
  enterprise: BILLING_PLANS.ENTERPRISE,
} as const;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  // Ensure shop record exists
  const shopRecord = await getOrCreateShop(shop);
  const viewCount = await getMonthlyUsage(shop);

  // Sync subscription status from Shopify
  const activeSub = await getActiveSubscription(admin);
  if (activeSub && activeSub.status === "ACTIVE") {
    const planKey = planKeyFromSubscriptionName(activeSub.name);
    if (shopRecord.plan !== planKey || shopRecord.subscriptionId !== activeSub.id) {
      await prisma.shop.update({
        where: { shop },
        data: {
          plan: planKey,
          subscriptionId: activeSub.id,
          subscriptionStatus: activeSub.status,
        },
      });
    }

    // Restore bars to metafields if view limit is no longer exceeded on this plan
    const limitExceeded = await isViewLimitExceeded(shop);
    if (!limitExceeded) {
      await syncAnnouncementBarsToMetafields({ shop }, admin);
    }

    // Calculate trial days remaining based on createdAt + trialDays
    let trialDaysRemaining: number | null = null;
    if (activeSub.trialDays > 0 && activeSub.createdAt) {
      const createdAt = new Date(activeSub.createdAt);
      const trialEnd = new Date(createdAt.getTime() + activeSub.trialDays * 24 * 60 * 60 * 1000);
      const now = new Date();
      const msRemaining = trialEnd.getTime() - now.getTime();
      trialDaysRemaining = msRemaining > 0 ? Math.ceil(msRemaining / (1000 * 60 * 60 * 24)) : null;
    }

    return json({
      shopRecord: { ...shopRecord, plan: planKey, subscriptionId: activeSub.id, subscriptionStatus: activeSub.status },
      viewCount,
      trialDaysRemaining,
      isTestCharge: activeSub.test,
    });
  } else if (shopRecord.plan !== "free") {
    await prisma.shop.update({
      where: { shop },
      data: { plan: "free", subscriptionId: null, subscriptionStatus: null },
    });
    return json({
      shopRecord: { ...shopRecord, plan: "free", subscriptionId: null, subscriptionStatus: null },
      viewCount,
      trialDaysRemaining: null,
      isTestCharge: false,
    });
  }

  return json({ shopRecord, viewCount, trialDaysRemaining: null, isTestCharge: false });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "subscribe" || intent === "change") {
    const planKey = formData.get("plan") as PlanKey;
    if (!planKey || planKey === "free" || !PLANS[planKey]) {
      return json({ error: "Invalid plan" }, { status: 400 });
    }

    // When changing between paid plans, cancel the existing subscription first
    // to prevent the merchant from being charged for two plans simultaneously.
    if (intent === "change") {
      const shopRecord = await prisma.shop.findUnique({ where: { shop } });
      if (shopRecord?.subscriptionId) {
        await billing.cancel({
          subscriptionId: shopRecord.subscriptionId,
          isTest: process.env.NODE_ENV !== "production",
          prorate: true,
        });
      }
    }

    const billingPlanName = PLAN_KEY_TO_BILLING_NAME[planKey as keyof typeof PLAN_KEY_TO_BILLING_NAME];

    // billing.request() creates the subscription and redirects automatically.
    // It throws a redirect Response internally — do NOT wrap in try/catch.
    await billing.request({
      plan: billingPlanName,
      isTest: process.env.NODE_ENV !== "production",
    });
  }

  if (intent === "cancel") {
    const shopRecord = await prisma.shop.findUnique({ where: { shop } });
    if (shopRecord?.subscriptionId) {
      // billing.cancel() cancels the subscription on Shopify's side.
      // The APP_SUBSCRIPTIONS_UPDATE webhook will handle updating the local DB.
      await billing.cancel({
        subscriptionId: shopRecord.subscriptionId,
        isTest: process.env.NODE_ENV !== "production",
        prorate: true,
      });
    }
    return json({ success: true });
  }

  return json({ error: "Unknown intent" }, { status: 400 });
};

export default function BillingPage() {
  const { shopRecord, viewCount, trialDaysRemaining, isTestCharge } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";

  const currentPlanKey = (shopRecord.plan || "free") as PlanKey;
  const currentPlan = PLANS[currentPlanKey] ?? PLANS.free;
  const usagePercent = currentPlan.viewLimit === Infinity ? 0 : Math.min((viewCount / currentPlan.viewLimit) * 100, 100);
  const isNearLimit = usagePercent > 80;

  function handleSubscribe(planKey: PlanKey) {
    const formData = new FormData();
    if (currentPlanKey !== "free" && currentPlanKey !== planKey) {
      formData.set("intent", "change");
    } else {
      formData.set("intent", "subscribe");
    }
    formData.set("plan", planKey);
    submit(formData, { method: "post" });
  }

  function handleCancel() {
    if (!confirm("Are you sure you want to cancel your subscription? You will be downgraded to the Free plan.")) {
      return;
    }
    const formData = new FormData();
    formData.set("intent", "cancel");
    submit(formData, { method: "post" });
  }

  function formatNumber(n: number): string {
    return n.toLocaleString("en-US");
  }

  function formatLimit(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return n.toString();
  }

  const planEntries = Object.entries(PLANS) as [PlanKey, typeof PLANS[PlanKey]][];

  return (
    <Page title="Billing & Usage" backAction={{ url: "/app" }}>
      <BlockStack gap="500">
        {isNearLimit && currentPlan.viewLimit !== Infinity && (
          <Banner title="Approaching view limit" tone="warning">
            <p>
              You've used {usagePercent.toFixed(0)}% of your monthly views.
              {viewCount > currentPlan.viewLimit
                ? " Your bars are currently hidden. Upgrade to restore them."
                : " Consider upgrading to avoid interruptions."}
            </p>
          </Banner>
        )}

        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">Current Plan</Text>
                <InlineStack gap="200" blockAlign="center">
                  <Text as="span" variant="headingLg">{currentPlan.name}</Text>
                  {currentPlanKey !== "free" && trialDaysRemaining !== null && trialDaysRemaining > 0 ? (
                    <Badge tone="attention">Trial - {trialDaysRemaining} day{trialDaysRemaining !== 1 ? "s" : ""} left</Badge>
                  ) : currentPlanKey !== "free" ? (
                    <Badge tone="success">Active</Badge>
                  ) : null}
                  {isTestCharge && (
                    <Badge tone="info">Test</Badge>
                  )}
                </InlineStack>
              </BlockStack>
              <Text as="span" variant="headingLg">
                {currentPlan.price === 0 ? "Free" : `$${currentPlan.price}/mo`}
              </Text>
            </InlineStack>

            <Divider />

            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="span" variant="bodyMd">Monthly Views</Text>
                <Text as="span" variant="bodyMd">
                  {formatNumber(viewCount)} / {currentPlan.viewLimit === Infinity ? "Unlimited" : formatLimit(currentPlan.viewLimit)}
                </Text>
              </InlineStack>
              {currentPlan.viewLimit !== Infinity && (
                <ProgressBar
                  progress={usagePercent}
                  tone={usagePercent > 100 ? "critical" : "primary"}
                  size="small"
                />
              )}
            </BlockStack>

            {currentPlanKey !== "free" && (
              <>
                <Divider />
                <InlineStack align="end">
                  <Button
                    variant="plain"
                    tone="critical"
                    onClick={handleCancel}
                    loading={isSubmitting}
                  >
                    Cancel Subscription
                  </Button>
                </InlineStack>
              </>
            )}
          </BlockStack>
        </Card>

        <Text as="h2" variant="headingMd">Choose a Plan</Text>

        <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
          {planEntries.map(([key, plan]) => {
            const isCurrent = key === currentPlanKey;
            const isUpgrade = plan.price > currentPlan.price;
            const isDowngrade = plan.price < currentPlan.price && key !== "free";

            return (
              <Card key={key}>
                <BlockStack gap="400">
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h3" variant="headingMd">{plan.name}</Text>
                      {isCurrent && <Badge tone="info">Current</Badge>}
                    </InlineStack>
                    <Text as="p" variant="headingLg">
                      {plan.price === 0 ? "Free" : `$${plan.price}`}
                      {plan.price > 0 && (
                        <Text as="span" variant="bodySm" tone="subdued"> /month</Text>
                      )}
                    </Text>
                  </BlockStack>

                  <Divider />

                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd">
                      {plan.viewLimit === Infinity
                        ? "Unlimited views/month"
                        : `${formatLimit(plan.viewLimit)} views/month`}
                    </Text>
                    {plan.price > 0 && (
                      <Text as="p" variant="bodySm" tone="subdued">
                        7-day free trial
                      </Text>
                    )}
                  </BlockStack>

                  <Box paddingBlockStart="200">
                    {isCurrent ? (
                      <Button disabled fullWidth>
                        Current Plan
                      </Button>
                    ) : key === "free" ? (
                      currentPlanKey !== "free" ? (
                        <Button
                          onClick={handleCancel}
                          loading={isSubmitting}
                          fullWidth
                        >
                          Downgrade to Free
                        </Button>
                      ) : (
                        <Button disabled fullWidth>
                          Current Plan
                        </Button>
                      )
                    ) : (
                      <Button
                        variant={isUpgrade ? "primary" : undefined}
                        onClick={() => handleSubscribe(key)}
                        loading={isSubmitting}
                        fullWidth
                      >
                        {isUpgrade ? "Upgrade" : isDowngrade ? "Downgrade" : "Subscribe"}
                      </Button>
                    )}
                  </Box>
                </BlockStack>
              </Card>
            );
          })}
        </InlineGrid>
      </BlockStack>
    </Page>
  );
}

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
  ProgressBar,
  Divider,
  Badge,
} from "@shopify/polaris";
import { PlusIcon, ViewIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { getOrCreateShop, getMonthlyUsage } from "../utils/billing.server";
import { PLANS, type PlanKey } from "../utils/plans";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopRecord = await getOrCreateShop(session.shop);
  const viewCount = await getMonthlyUsage(session.shop);
  return json({ shopRecord, viewCount });
};

export default function Index() {
  const { shopRecord, viewCount } = useLoaderData<typeof loader>();
  const planKey = (shopRecord.plan || "free") as PlanKey;
  const plan = PLANS[planKey] ?? PLANS.free;
  const usagePercent = plan.viewLimit === Infinity ? 0 : Math.min((viewCount / plan.viewLimit) * 100, 100);

  function formatViews(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return n.toString();
  }

  return (
    <Page>
      <BlockStack gap="500">
        <Card>
          <BlockStack gap="400">
            <Text as="h1" variant="headingLg">
              Welcome to Anbar
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Create beautiful announcement bars to promote sales, important messages, and special offers across your store. Customize colors, positions, and targeting to maximize engagement with your customers.
            </Text>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">Plan &amp; Usage</Text>
              <InlineStack gap="200" blockAlign="center">
                <Badge tone={planKey === "free" ? "info" : "success"}>{plan.name}</Badge>
                <Button variant="plain" url="/app/billing">Manage Billing</Button>
              </InlineStack>
            </InlineStack>

            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="span" variant="bodyMd">Monthly Views</Text>
                <Text as="span" variant="bodyMd">
                  {formatViews(viewCount)} / {plan.viewLimit === Infinity ? "Unlimited" : formatViews(plan.viewLimit)}
                </Text>
              </InlineStack>
              {plan.viewLimit !== Infinity && (
                <ProgressBar
                  progress={usagePercent}
                  tone={usagePercent > 100 ? "critical" : "primary"}
                  size="small"
                />
              )}
            </BlockStack>

            {usagePercent > 80 && plan.viewLimit !== Infinity && (
              <>
                <Divider />
                <Text as="p" variant="bodySm" tone="caution">
                  {viewCount > plan.viewLimit
                    ? "View limit exceeded — your bars are currently hidden. Upgrade your plan to restore them."
                    : "You're approaching your view limit. Consider upgrading to avoid interruptions."}
                </Text>
              </>
            )}
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Quick Actions
            </Text>
            <InlineStack gap="300">
              <Button
                variant="primary"
                size="large"
                icon={PlusIcon}
                url="/app/announcements/new"
              >
                Create New Bar
              </Button>
              <Button
                size="large"
                icon={ViewIcon}
                url="/app/announcements"
              >
                Manage All Bars
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Setup Guide
            </Text>
            <BlockStack gap="300">
              <InlineStack gap="200" blockAlign="start">
                <Text as="span" variant="bodyMd" fontWeight="semibold">1.</Text>
                <Text as="p" variant="bodyMd">Create your first announcement bar</Text>
              </InlineStack>
              <InlineStack gap="200" blockAlign="start">
                <Text as="span" variant="bodyMd" fontWeight="semibold">2.</Text>
                <Text as="p" variant="bodyMd">Customize colors and design</Text>
              </InlineStack>
              <InlineStack gap="200" blockAlign="start">
                <Text as="span" variant="bodyMd" fontWeight="semibold">3.</Text>
                <Text as="p" variant="bodyMd">Set targeting rules (pages, collections)</Text>
              </InlineStack>
              <InlineStack gap="200" blockAlign="start">
                <Text as="span" variant="bodyMd" fontWeight="semibold">4.</Text>
                <Text as="p" variant="bodyMd">Activate and publish your bar</Text>
              </InlineStack>
              <InlineStack gap="200" blockAlign="start">
                <Text as="span" variant="bodyMd" fontWeight="semibold">5.</Text>
                <Text as="p" variant="bodyMd">Monitor performance in your store</Text>
              </InlineStack>
            </BlockStack>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Integration Options
            </Text>
            <BlockStack gap="400">
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" fontWeight="semibold">
                  App Embed (Automatic)
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Displays announcement bars automatically based on your targeting rules.
                </Text>
              </BlockStack>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" fontWeight="semibold">
                  App Block (Manual)
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Use the unique ID to position bars exactly where you want in your theme.
                </Text>
              </BlockStack>
            </BlockStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

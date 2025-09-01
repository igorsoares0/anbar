import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";
import {
  Page,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Icon,
} from "@shopify/polaris";
import { PlusIcon, ViewIcon, BillingStatementDollarIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
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
            <Text as="h2" variant="headingMd">
              Quick Actions
            </Text>
            <InlineStack gap="300">
              <Button 
                variant="primary" 
                size="large"
                icon={PlusIcon}
                as={Link}
                to="/app/announcements/new"
              >
                Create New Bar
              </Button>
              <Button 
                size="large"
                icon={ViewIcon}
                as={Link}
                to="/app/announcements"
              >
                Manage All Bars
              </Button>
              <Button 
                size="large"
                icon={BillingStatementDollarIcon}
              >
                Billing & Plans
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

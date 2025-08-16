import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link as RemixLink } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  List,
  Link,
  InlineStack,
  Badge,
  Icon,
  Grid,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { 
  PlusIcon, 
  ViewIcon,
  SettingsIcon
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  
  return null;
};


export default function Index() {

  return (
    <Page>
      <TitleBar title="Anbar - Announcement Bars" />
      <BlockStack gap="500">
        {/* Welcome Section */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h1" variant="headingLg">
                  Welcome to Anbar
                </Text>
                <Text variant="bodyMd" as="p">
                  Create beautiful announcement bars to promote sales, important messages, 
                  and special offers across your store. Customize colors, positions, and targeting 
                  to maximize engagement with your customers.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>


        {/* Quick Actions */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Quick Actions
                </Text>
                <Grid columns={{ xs: 1, sm: 2, lg: 3 }}>
                  <Button
                    variant="primary"
                    size="large"
                    url="/app/announcements/new"
                    icon={PlusIcon}
                  >
                    Create New Bar
                  </Button>
                  <Button
                    size="large"
                    url="/app/announcements"
                    icon={ViewIcon}
                  >
                    Manage All Bars
                  </Button>
                  <Button
                    size="large"
                    url="/app/billing"
                    icon={SettingsIcon}
                  >
                    Billing & Plans
                  </Button>
                </Grid>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Setup Guide */}
        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Setup Guide
                  </Text>
                  <List type="number">
                    <List.Item>
                      Create your first announcement bar
                    </List.Item>
                    <List.Item>
                      Customize colors and design
                    </List.Item>
                    <List.Item>
                      Set targeting rules (pages, collections)
                    </List.Item>
                    <List.Item>
                      Activate and publish your bar
                    </List.Item>
                    <List.Item>
                      Monitor performance in your store
                    </List.Item>
                  </List>
                </BlockStack>
              </Card>
              
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Integration Options
                  </Text>
                  <BlockStack gap="200">
                    <Box
                      padding="300"
                      background="bg-surface-secondary"
                      borderRadius="200"
                    >
                      <BlockStack gap="100">
                        <Text as="h3" variant="headingSm">
                          App Embed (Automatic)
                        </Text>
                        <Text variant="bodySm" tone="subdued">
                          Displays announcement bars automatically based on your targeting rules.
                        </Text>
                      </BlockStack>
                    </Box>
                    
                    <Box
                      padding="300"
                      background="bg-surface-secondary"
                      borderRadius="200"
                    >
                      <BlockStack gap="100">
                        <Text as="h3" variant="headingSm">
                          App Block (Manual)
                        </Text>
                        <Text variant="bodySm" tone="subdued">
                          Use the unique ID to position bars exactly where you want in your theme.
                        </Text>
                      </BlockStack>
                    </Box>
                  </BlockStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

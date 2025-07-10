import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  DataTable,
  Badge,
  ButtonGroup,
  EmptyState,
  Text,
  InlineStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  const announcementBars = await prisma.announcementBar.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
  });

  return json({ announcementBars });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "sync") {
    try {
      // Get all active and published announcement bars
      const announcementBars = await prisma.announcementBar.findMany({
        where: { 
          shop: session.shop,
          isActive: true,
          isPublished: true,
        },
        orderBy: { createdAt: "desc" },
      });

      console.log('Syncing announcement bars:', announcementBars.length);
      console.log('Shop:', session.shop);

      // First, get the shop ID
      const shopResult = await admin.graphql(`
        query {
          shop {
            id
            myshopifyDomain
          }
        }
      `);
      
      const shopData = await shopResult.json();
      console.log('Shop data:', JSON.stringify(shopData, null, 2));
      const shopId = shopData.data.shop.id;

      // Store bars in shop metafields for theme access
      const metafieldsResult = await admin.graphql(`
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              id
              key
              value
            }
            userErrors {
              field
              message
            }
          }
        }
      `, {
        variables: {
          metafields: [
            {
              ownerId: shopId,
              namespace: "anbar",
              key: "bars",
              value: JSON.stringify(announcementBars),
              type: "json",
            },
          ],
        },
      });

      const result = await metafieldsResult.json();
      console.log('Sync metafields result:', JSON.stringify(result, null, 2));

      return json({ success: true, synced: announcementBars.length, result });
    } catch (error) {
      console.error("Error syncing announcement bars:", error);
      return json({ error: error.message }, { status: 400 });
    }
  }

  return json({ error: "Unknown action" }, { status: 400 });
};

export default function AnnouncementBarsIndex() {
  const { announcementBars } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const rows = announcementBars.map((bar) => [
    bar.name,
    <Text as="span" variant="bodySm" fontWeight="medium" color="subdued">
      {bar.id}
    </Text>,
    bar.announcementType,
    bar.isPublished ? (
      <Badge status="success">Published</Badge>
    ) : (
      <Badge>Draft</Badge>
    ),
    bar.isActive ? (
      <Badge status="success">Active</Badge>
    ) : (
      <Badge status="critical">Inactive</Badge>
    ),
    bar.createdAt.split("T")[0],
    <ButtonGroup>
      <Button size="micro" url={`/app/announcements/${bar.id}`}>
        Edit
      </Button>
      <Button
        size="micro"
        variant="primary"
        tone={bar.isActive ? "critical" : "success"}
      >
        {bar.isActive ? "Deactivate" : "Activate"}
      </Button>
    </ButtonGroup>,
  ]);

  const handleSync = () => {
    const formData = new FormData();
    formData.append("intent", "sync");
    submit(formData, { method: "post" });
  };

  return (
    <Page>
      <TitleBar
        title="Announcement Bars"
        primaryAction={{
          content: "Create announcement bar",
          url: "/app/announcements/new",
        }}
        secondaryActions={[
          {
            content: "Sync to Theme",
            onAction: handleSync,
          },
        ]}
      />
      <Layout>
        <Layout.Section>
          <Card>
            <InlineStack gap="400" align="start">
              <Button 
                variant="primary" 
                onClick={handleSync}
                size="large"
              >
                Sync to Theme (Click this first!)
              </Button>
              <Text as="p" variant="bodyMd" color="subdued">
                Click this button to sync your announcement bars to your theme so they can be displayed.
              </Text>
            </InlineStack>
          </Card>
        </Layout.Section>
        <Layout.Section>
          {announcementBars.length === 0 ? (
            <Card>
              <EmptyState
                heading="Create your first announcement bar"
                action={{
                  content: "Create announcement bar",
                  url: "/app/announcements/new",
                }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <Text as="p" variant="bodyMd">
                  Announcement bars help you communicate important messages to your customers.
                </Text>
              </EmptyState>
            </Card>
          ) : (
            <Card padding="0">
              <DataTable
                columnContentTypes={[
                  "text",
                  "text",
                  "text", 
                  "text",
                  "text",
                  "text",
                  "text",
                ]}
                headings={[
                  "Name",
                  "ID",
                  "Type",
                  "Status",
                  "Active",
                  "Created",
                  "Actions",
                ]}
                rows={rows}
              />
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  DataTable,
  Badge,
  EmptyState,
  Text,
  Icon,
  Tooltip,
  Box,
  InlineStack,
  BlockStack,
  ResourceList,
  ResourceItem,
  Thumbnail,
} from "@shopify/polaris";
import {
  EditIcon,
  DuplicateIcon,
  ViewIcon,
} from "@shopify/polaris-icons";
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

export default function AnnouncementBarsIndex() {
  const { announcementBars } = useLoaderData<typeof loader>();

  const getTypeVariant = (type: string) => {
    switch (type) {
      case 'continuous': return { tone: 'info' as const, content: 'Continuous Scroll' };
      case 'simple': return { tone: 'subdued' as const, content: 'Simple' };
      case 'multiple': return { tone: 'warning' as const, content: 'Multiple' };
      default: return { tone: 'subdued' as const, content: type };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Page>
      <TitleBar
        title="Announcement Bars"
        primaryAction={{
          content: "Create announcement bar",
          url: "/app/announcements/new",
        }}
      />
      <Layout>
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
                  Announcement bars help you communicate important messages to your customers across your store.
                </Text>
              </EmptyState>
            </Card>
          ) : (
            <BlockStack gap="400">
              <Card>
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingLg">
                      Announcement Bars
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      {announcementBars.length} announcement bar{announcementBars.length !== 1 ? 's' : ''}
                    </Text>
                  </BlockStack>
                  <Button 
                    variant="primary" 
                    url="/app/announcements/new"
                    size="large"
                  >
                    Create announcement bar
                  </Button>
                </InlineStack>
              </Card>
              
              <Card padding="0">
                <ResourceList
                  resourceName={{ singular: 'announcement bar', plural: 'announcement bars' }}
                  items={announcementBars}
                  renderItem={(bar) => {
                    const typeInfo = getTypeVariant(bar.announcementType);
                    return (
                      <ResourceItem
                        id={bar.id}
                        url={`/app/announcements/${bar.id}`}
                        media={
                          <Thumbnail
                            source="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                            alt="Announcement bar"
                            size="small"
                          />
                        }
                      >
                        <InlineStack align="space-between" blockAlign="start">
                          <BlockStack gap="100">
                            <InlineStack gap="200" blockAlign="center">
                              <Text as="h3" variant="bodyMd" fontWeight="semibold">
                                {bar.name || 'Untitled'}
                              </Text>
                              <Badge tone={typeInfo.tone}>
                                {typeInfo.content}
                              </Badge>
                              {bar.isPublished ? (
                                <Badge tone="success">Published</Badge>
                              ) : (
                                <Badge tone="subdued">Draft</Badge>
                              )}
                            </InlineStack>
                            
                            <InlineStack gap="400">
                              <Box>
                                <Text as="p" variant="bodySm" tone="subdued">
                                  ID: {bar.id.slice(0, 8)}...
                                </Text>
                              </Box>
                              <Box>
                                <Text as="p" variant="bodySm" tone="subdued">
                                  Created {formatDate(bar.createdAt)}
                                </Text>
                              </Box>
                            </InlineStack>
                          </BlockStack>
                          
                          <InlineStack gap="200">
                            <Tooltip content="Edit announcement bar">
                              <Button
                                variant="tertiary"
                                size="micro"
                                icon={EditIcon}
                                url={`/app/announcements/${bar.id}`}
                                accessibilityLabel="Edit announcement bar"
                              />
                            </Tooltip>
                          </InlineStack>
                        </InlineStack>
                      </ResourceItem>
                    );
                  }}
                />
              </Card>
            </BlockStack>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
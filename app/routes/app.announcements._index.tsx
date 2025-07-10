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
  ButtonGroup,
  EmptyState,
  Text,
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

export default function AnnouncementBarsIndex() {
  const { announcementBars } = useLoaderData<typeof loader>();

  const rows = announcementBars.map((bar) => [
    bar.name,
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
                ]}
                headings={[
                  "Name",
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
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  
  if (!session?.shop) {
    return json({ bars: [] });
  }

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

    // Found announcement bars

    // Always store bars in shop metafields for theme access (even if empty)
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
            ownerId: `gid://shopify/Shop/${session.shop.split('.')[0]}`,
            namespace: "anbar",
            key: "bars",
            value: JSON.stringify(announcementBars),
            type: "json",
          },
        ],
      },
    });

    const result = await metafieldsResult.json();
    // Metafields result processed

    return json({ bars: announcementBars });
  } catch (error) {
    // Error fetching announcement bars
    return json({ bars: [] });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  
  if (!session?.shop) {
    return json({ success: false, error: "No shop session" });
  }

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

    // Syncing announcement bars

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
            ownerId: `gid://shopify/Shop/${session.shop.split('.')[0]}`,
            namespace: "anbar",
            key: "bars",
            value: JSON.stringify(announcementBars),
            type: "json",
          },
        ],
      },
    });

    const result = await metafieldsResult.json();
    // Sync metafields result processed

    return json({ success: true, bars: announcementBars, metafields: result });
  } catch (error) {
    // Error syncing announcement bars
    return json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
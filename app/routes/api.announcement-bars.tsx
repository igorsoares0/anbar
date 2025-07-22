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

    console.log('Found announcement bars:', announcementBars.length);

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
    console.log('Metafields result:', JSON.stringify(result, null, 2));

    return json({ bars: announcementBars });
  } catch (error) {
    console.error("Error fetching announcement bars:", error);
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

    console.log('Syncing announcement bars:', announcementBars.length);

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
    console.log('Sync metafields result:', JSON.stringify(result, null, 2));

    return json({ success: true, bars: announcementBars, metafields: result });
  } catch (error) {
    console.error("Error syncing announcement bars:", error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
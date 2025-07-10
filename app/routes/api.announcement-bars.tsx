import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.public.appProxy(request);
  
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

    // Store bars in shop metafields for theme access
    if (announcementBars.length > 0) {
      await admin.graphql(`
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              id
              key
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
              ownerId: `gid://shopify/Shop/${session.shop.replace('.myshopify.com', '')}`,
              namespace: "anbar",
              key: "bars",
              value: JSON.stringify(announcementBars),
              type: "json",
            },
          ],
        },
      });
    }

    return json({ bars: announcementBars });
  } catch (error) {
    console.error("Error fetching announcement bars:", error);
    return json({ bars: [] });
  }
};
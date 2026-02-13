import prisma from "../db.server";
import { isViewLimitExceeded } from "./billing.server";

type AdminGraphQL = {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

export interface SyncSession {
  shop: string;
}

export async function syncAnnouncementBarsToMetafields(
  session: SyncSession,
  admin: AdminGraphQL
): Promise<{ success: boolean; error?: string; synced?: number }> {
  try {
    // Check if view limit is exceeded — if so, sync empty array
    const limitExceeded = await isViewLimitExceeded(session.shop);

    if (limitExceeded) {
      console.log(`[SYNC] View limit exceeded for ${session.shop}, syncing empty bars`);
    }

    // Get all active and published announcement bars
    const announcementBars = limitExceeded ? [] : await prisma.announcementBar.findMany({
      where: { 
        shop: session.shop,
        isActive: true,
        isPublished: true,
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(`[SYNC] Syncing ${announcementBars.length} announcement bars for shop: ${session.shop}`);

    // Get the shop ID
    const shopResult = await admin.graphql(`
      query {
        shop {
          id
          myshopifyDomain
        }
      }
    `);
    
    const shopData = await shopResult.json();
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
    
    if (result.data.metafieldsSet.userErrors.length > 0) {
      console.error('[SYNC] Metafields errors:', result.data.metafieldsSet.userErrors);
      return { 
        success: false, 
        error: result.data.metafieldsSet.userErrors[0].message 
      };
    }

    console.log(`[SYNC] Successfully synced ${announcementBars.length} announcement bars`);
    return { success: true, synced: announcementBars.length };

  } catch (error) {
    console.error("[SYNC] Error syncing announcement bars:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}
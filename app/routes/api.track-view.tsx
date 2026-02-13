import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { incrementViewCount, syncEmptyBarsToMetafields } from "../utils/billing.server";

// 1x1 transparent GIF (43 bytes)
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);

  if (!session?.shop) {
    return new Response(TRANSPARENT_GIF, {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  }

  const shop = session.shop;

  // Increment view count and check limit
  const { limitExceeded } = await incrementViewCount(shop);

  // If limit exceeded, clear metafields asynchronously so bars stop showing
  if (limitExceeded) {
    syncEmptyBarsToMetafields(shop).catch((err) =>
      console.error(`[TRACK] Failed to sync empty bars for ${shop}:`, err),
    );
  }

  return new Response(TRANSPARENT_GIF, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
};

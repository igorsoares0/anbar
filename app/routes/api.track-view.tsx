import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { incrementViewCount, syncEmptyBarsToMetafields, syncBarsToMetafields } from "../utils/billing.server";
import { PLANS } from "../utils/plans";

// 1x1 transparent GIF (43 bytes)
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

const GIF_HEADERS = {
  "Content-Type": "image/gif",
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

// Track shops whose bars have been restored this process, to avoid syncing on every view
const restoredShops = new Set<string>();

// Rate limiting: max 1 tracked view per IP per shop per 5 seconds
const RATE_LIMIT_WINDOW_MS = 5_000;
const recentViews = new Map<string, number>();

// Clean up stale entries every 60 seconds to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentViews) {
    if (now - timestamp > RATE_LIMIT_WINDOW_MS) {
      recentViews.delete(key);
    }
  }
}, 60_000);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);

  if (!session?.shop) {
    return new Response(TRANSPARENT_GIF, { headers: GIF_HEADERS });
  }

  const shop = session.shop;

  // Rate limit by IP + shop to prevent view count exhaustion attacks
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimitKey = `${shop}:${ip}`;
  const now = Date.now();
  const lastView = recentViews.get(rateLimitKey);

  if (lastView && now - lastView < RATE_LIMIT_WINDOW_MS) {
    // Already counted a view from this IP recently — return without incrementing
    return new Response(TRANSPARENT_GIF, { headers: GIF_HEADERS });
  }

  recentViews.set(rateLimitKey, now);

  const { viewCount, limitExceeded } = await incrementViewCount(shop);

  if (limitExceeded) {
    // Bars should be hidden — clear metafields and mark shop as needing restore later
    restoredShops.delete(shop);
    syncEmptyBarsToMetafields(shop).catch((err) =>
      console.error(`[TRACK] Failed to sync empty bars for ${shop}:`, err),
    );
  } else if (!restoredShops.has(shop) && viewCount > PLANS.free.viewLimit) {
    // Paid plan with views above free limit — bars may have been cleared, restore them once
    syncBarsToMetafields(shop)
      .then(() => restoredShops.add(shop))
      .catch((err) =>
        console.error(`[TRACK] Failed to restore bars for ${shop}:`, err),
      );
  }

  return new Response(TRANSPARENT_GIF, { headers: GIF_HEADERS });
};

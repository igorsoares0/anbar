import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { syncAnnouncementBarsToMetafields } from "../utils/syncAnnouncementBars.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  if (!session?.shop) {
    return json({ bars: [] });
  }

  const result = await syncAnnouncementBarsToMetafields({ shop: session.shop }, admin);

  if (!result.success) {
    return json({ bars: [], error: result.error });
  }

  return json({ bars: [], synced: result.synced });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  if (!session?.shop) {
    return json({ success: false, error: "No shop session" });
  }

  const result = await syncAnnouncementBarsToMetafields({ shop: session.shop }, admin);
  return json(result);
};

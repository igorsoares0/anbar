import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  // Clean up all shop data (GDPR compliance)
  try {
    await db.announcementBar.deleteMany({ where: { shop } });
    await db.monthlyUsage.deleteMany({ where: { shop } });
    await db.shop.deleteMany({ where: { shop } });
    console.log(`[UNINSTALL] Cleaned up all data for ${shop}`);
  } catch (error) {
    console.error(`[UNINSTALL] Error cleaning up data for ${shop}:`, error);
  }

  return new Response();
};

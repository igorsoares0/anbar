import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { topic, shop, payload } = await authenticate.webhook(request);

    if (topic !== "SHOP_REDACT") {
      return new Response("Webhook topic not supported", { status: 400 });
    }

    console.log(`Received ${topic} webhook for ${shop}`);
    console.log("Payload:", JSON.stringify(payload, null, 2));

    // Log the shop redaction request for compliance tracking
    const shopRedactionRequest = {
      shopId: payload.shop_id,
      shopDomain: payload.shop_domain,
      requestedAt: new Date(),
    };

    console.log("Shop data redaction request received:", shopRedactionRequest);

    // TODO: Implement your logic here to:
    // 1. Delete all data associated with this shop from your database
    // 2. Remove all customer data from this shop
    // 3. Remove all sessions and authentication data
    // 4. Log the redaction for compliance tracking

    // Example implementation for this app:
    try {
      // Delete all announcement bars for this shop
      await prisma.announcementBar.deleteMany({
        where: {
          shop: payload.shop_domain,
        },
      });

      // Delete all sessions for this shop
      await prisma.session.deleteMany({
        where: {
          shop: payload.shop_domain,
        },
      });

      console.log(`Successfully deleted all data for shop: ${payload.shop_domain}`);
    } catch (dbError) {
      console.error("Error deleting shop data from database:", dbError);
      // Continue execution to acknowledge receipt even if deletion fails
      // You might want to implement retry logic or manual cleanup procedures
    }

    // In production, you should also:
    // - Remove any cached data associated with this shop
    // - Delete any files or assets stored for this shop
    // - Remove any third-party integrations or API keys for this shop
    // - Update any analytics or reporting systems to exclude this shop's data

    return new Response("Shop data redaction acknowledged and processed", { 
      status: 200,
      headers: {
        "Content-Type": "text/plain"
      }
    });
  } catch (error) {
    console.error("Error processing shop redaction webhook:", error);
    return new Response("Internal server error", { status: 500 });
  }
};
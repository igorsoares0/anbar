import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { topic, shop, payload } = await authenticate.webhook(request);

    if (topic !== "CUSTOMERS_DATA_REQUEST") {
      return new Response("Webhook topic not supported", { status: 400 });
    }

    console.log(`Received ${topic} webhook for ${shop}`);
    console.log("Payload:", JSON.stringify(payload, null, 2));

    // Log the data request for compliance tracking
    const dataRequest = {
      shopId: payload.shop_id,
      shopDomain: payload.shop_domain,
      customerId: payload.customer?.id,
      customerEmail: payload.customer?.email,
      ordersRequested: payload.orders_requested || [],
      requestedAt: new Date(),
    };

    console.log("Customer data request received:", dataRequest);

    // TODO: Implement your logic here to:
    // 1. Collect the requested customer data from your database
    // 2. Generate a report or export of the customer's data
    // 3. Send the data to the store owner via email or secure method
    // 4. Log the request for compliance tracking

    // For now, we just log and acknowledge receipt
    // In production, you should:
    // - Query your database for customer data using the provided customer ID
    // - Compile all personal data associated with this customer
    // - Send it to the store owner within 30 days as required by GDPR

    return new Response("Customer data request acknowledged", { 
      status: 200,
      headers: {
        "Content-Type": "text/plain"
      }
    });
  } catch (error) {
    console.error("Error processing customer data request webhook:", error);
    return new Response("Internal server error", { status: 500 });
  }
};
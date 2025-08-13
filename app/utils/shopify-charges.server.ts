import { authenticate } from "../shopify.server";

export async function getChargeStatus(request: Request, chargeId: string) {
  const { session } = await authenticate.admin(request);
  
  const response = await fetch(`https://${session.shop}/admin/api/2023-10/recurring_application_charges/${chargeId}.json`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": session.accessToken,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get charge status: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  return result.recurring_application_charge;
}
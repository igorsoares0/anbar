import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData, useNavigation } from "@remix-run/react";
import { useEffect } from "react";
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  Banner,
  Badge,
  Divider,
  List,
  BlockStack,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  getOrCreateSubscription,
  createRecurringCharge,
  activateRecurringCharge,
  cancelSubscription,
  BILLING_PLANS,
} from "../utils/billing.server";
import { autoSyncSubscription } from "../utils/auto-sync.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  // Auto-sync subscription on every page load
  const subscription = await autoSyncSubscription(request);
  
  const url = new URL(request.url);
  const chargeId = url.searchParams.get("charge_id");
  const planId = url.searchParams.get("plan_id");
  const status = url.searchParams.get("status");
  const success = url.searchParams.get("success");
  const error = url.searchParams.get("error");
  const pending = url.searchParams.get("pending");

  // If we have a pending charge from callback, try to activate it
  if (chargeId && planId && status === "pending") {
    try {
      await activateRecurringCharge(request, chargeId, planId);
      // Reload subscription after activation
      const updatedSubscription = await getOrCreateSubscription(session.shop);
      return json({
        subscription: updatedSubscription,
        plans: BILLING_PLANS,
        success: "Subscription activated successfully!",
      });
    } catch (error) {
      return json({
        subscription,
        plans: BILLING_PLANS,
        error: `Failed to activate subscription: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  // Handle URL parameters for feedback
  let feedbackMessage = null;
  let feedbackType = null;

  if (success === "subscription_activated") {
    feedbackMessage = "Subscription activated successfully!";
    feedbackType = "success";
  } else if (error) {
    switch (error) {
      case "missing_parameters":
        feedbackMessage = "Invalid callback parameters. Please try again.";
        break;
      case "charge_not_found":
        feedbackMessage = "Could not find charge. Please contact support.";
        break;
      case "charge_not_active":
        feedbackMessage = "Payment not completed. Please try again.";
        break;
      case "invalid_plan":
        feedbackMessage = "Invalid plan selected. Please try again.";
        break;
      case "callback_failed":
        feedbackMessage = "Callback failed. Your subscription may still be processing.";
        break;
      default:
        feedbackMessage = "An error occurred. Please refresh the page.";
    }
    feedbackType = "critical";
  } else if (pending) {
    feedbackMessage = "Your subscription is being processed. Please refresh the page in a moment.";
    feedbackType = "info";
  }

  return json({
    subscription,
    plans: BILLING_PLANS,
    feedbackMessage,
    feedbackType,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "subscribe") {
    const planId = formData.get("planId") as "monthly" | "annual";
    
    try {
      const charge = await createRecurringCharge(request, planId);
      return json({ 
        success: true, 
        confirmationUrl: charge.confirmation_url 
      });
    } catch (error) {
      return json(
        { error: "Failed to create subscription" },
        { status: 500 }
      );
    }
  }

  if (action === "cancel") {
    try {
      await cancelSubscription(request);
      return json({ success: true });
    } catch (error) {
      return json(
        { error: "Failed to cancel subscription" },
        { status: 500 }
      );
    }
  }

  return json({ error: "Invalid action" }, { status: 400 });
};

export default function BillingPage() {
  const { subscription, plans, feedbackMessage, feedbackType } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const shopify = useAppBridge();
  const isLoading = navigation.state === "submitting";

  const currentPlan = Object.values(plans).find(
    plan => plan.id === subscription.planId
  );

  // Handle redirect to Shopify billing confirmation
  useEffect(() => {
    if (actionData && 'confirmationUrl' in actionData && actionData.confirmationUrl) {
      window.open(actionData.confirmationUrl, "_top");
    }
  }, [actionData]);

  const handleSubscribe = (planId: string) => {
    const formData = new FormData();
    formData.set("action", "subscribe");
    formData.set("planId", planId);
    submit(formData, { method: "post" });
  };

  const handleCancel = () => {
    const formData = new FormData();
    formData.set("action", "cancel");
    submit(formData, { method: "post" });
  };

  return (
    <Page
      title="Billing & Plans"
      subtitle="Manage your subscription and billing preferences"
    >
      <Layout>
        <Layout.Section>
          {actionData?.error && (
            <Banner title="Error" status="critical">
              <p>{actionData.error}</p>
            </Banner>
          )}
          
          {feedbackMessage && (
            <Banner title={feedbackType === "success" ? "Success" : feedbackType === "critical" ? "Error" : "Info"} status={feedbackType as any}>
              <p>{feedbackMessage}</p>
            </Banner>
          )}
          
          {subscription.planId !== "free" && (
            <Banner title="Current Subscription" status="success">
              <Text as="p">
                You are currently on the {currentPlan?.name} plan.
                {subscription.currentPeriodEnd && (
                  <> Next billing date: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</>
                )}
              </Text>
            </Banner>
          )}
        </Layout.Section>

        <Layout.Section>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
            {Object.values(plans).map((plan) => (
              <Card key={plan.id}>
                <div style={{ padding: "1rem" }}>
                  <BlockStack gap="400">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Text variant="headingMd" as="h3">
                        {plan.name}
                      </Text>
                      {subscription.planId === plan.id && (
                        <Badge status="success">Current Plan</Badge>
                      )}
                    </div>

                    <Text variant="headingLg" as="p">
                      ${plan.price}
                      {plan.id !== "free" && (
                        <Text variant="bodyMd" as="span" color="subdued">
                          {plan.id === "annual" ? "/year" : "/month"}
                        </Text>
                      )}
                    </Text>

                    <List>
                      {plan.features.map((feature, index) => (
                        <List.Item key={index}>{feature}</List.Item>
                      ))}
                    </List>

                    <Divider />

                    {subscription.planId === plan.id ? (
                      plan.id !== "free" ? (
                        <Button
                          destructive
                          onClick={handleCancel}
                          size="large"
                          fullWidth
                        >
                          Cancel Subscription
                        </Button>
                      ) : (
                        <Button disabled size="large" fullWidth>
                          Current Plan
                        </Button>
                      )
                    ) : plan.id !== "free" ? (
                      <Button
                        primary
                        loading={isLoading}
                        onClick={() => handleSubscribe(plan.id)}
                        size="large"
                        fullWidth
                      >
                        {subscription.planId === "free" ? "Upgrade" : "Switch"} to {plan.name}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleCancel()}
                        size="large"
                        fullWidth
                        disabled={subscription.planId === "free"}
                      >
                        Downgrade to Free
                      </Button>
                    )}
                  </BlockStack>
                </div>
              </Card>
            ))}
          </div>
        </Layout.Section>

        {subscription.planId !== "free" && subscription.currentPeriodEnd && (
          <Layout.Section>
            <Card>
              <div style={{ padding: "1rem" }}>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h3">
                    Billing Information
                  </Text>
                  <div>
                    <Text as="p">
                      <strong>Status:</strong> {subscription.status}
                    </Text>
                    <Text as="p">
                      <strong>Current Period:</strong>{" "}
                      {new Date(subscription.currentPeriodStart!).toLocaleDateString()} -{" "}
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                    </Text>
                  </div>
                </BlockStack>
              </div>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
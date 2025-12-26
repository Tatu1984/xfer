import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { constructWebhookEvent, handleStripeEvent, onStripeEvent } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// Register Stripe event handlers
onStripeEvent("payment_intent.succeeded", async (event) => {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  logger.info("Payment succeeded", {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
  });

  // Update transaction status if we have metadata
  const transactionId = paymentIntent.metadata?.transactionId;
  if (transactionId) {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: "COMPLETED" },
    });
  }
});

onStripeEvent("payment_intent.payment_failed", async (event) => {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  logger.warn("Payment failed", {
    paymentIntentId: paymentIntent.id,
    error: paymentIntent.last_payment_error?.message,
  });

  const transactionId = paymentIntent.metadata?.transactionId;
  if (transactionId) {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: "FAILED",
        failureReason: paymentIntent.last_payment_error?.message,
      },
    });
  }
});

onStripeEvent("charge.refunded", async (event) => {
  const charge = event.data.object as Stripe.Charge;
  logger.info("Charge refunded", {
    chargeId: charge.id,
    amountRefunded: charge.amount_refunded,
  });
});

onStripeEvent("customer.subscription.created", async (event) => {
  const subscription = event.data.object as Stripe.Subscription;
  logger.info("Subscription created", {
    subscriptionId: subscription.id,
    customerId: subscription.customer as string,
  });
});

onStripeEvent("customer.subscription.updated", async (event) => {
  const subscription = event.data.object as Stripe.Subscription;
  logger.info("Subscription updated", {
    subscriptionId: subscription.id,
    status: subscription.status,
  });

  // Update local subscription status - look up by external ID in metadata
  // Note: You'll need to store stripeSubscriptionId when creating subscriptions
  logger.debug("Would update local subscription", {
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
  });
});

onStripeEvent("customer.subscription.deleted", async (event) => {
  const subscription = event.data.object as Stripe.Subscription;
  logger.info("Subscription deleted", {
    subscriptionId: subscription.id,
  });

  // Note: Update local subscription based on metadata or external ID lookup
  logger.debug("Would cancel local subscription", {
    stripeSubscriptionId: subscription.id,
  });
});

onStripeEvent("invoice.payment_succeeded", async (event) => {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = typeof invoice.parent?.subscription_details === "object"
    ? invoice.parent?.subscription_details?.subscription
    : undefined;
  logger.info("Invoice payment succeeded", {
    invoiceId: invoice.id,
    subscriptionId,
  });
});

onStripeEvent("invoice.payment_failed", async (event) => {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = typeof invoice.parent?.subscription_details === "object"
    ? invoice.parent?.subscription_details?.subscription
    : undefined;
  logger.warn("Invoice payment failed", {
    invoiceId: invoice.id,
    subscriptionId,
  });

  // Trigger dunning notification based on metadata lookup
  logger.debug("Would trigger dunning for subscription", {
    subscriptionId,
  });
});

onStripeEvent("payout.paid", async (event) => {
  const payout = event.data.object as Stripe.Payout;
  logger.info("Payout paid", {
    payoutId: payout.id,
    amount: payout.amount,
  });

  // Note: Update local payout based on metadata or external ID lookup
  logger.debug("Would update local payout", {
    stripePayoutId: payout.id,
  });
});

onStripeEvent("payout.failed", async (event) => {
  const payout = event.data.object as Stripe.Payout;
  logger.error("Payout failed", undefined, {
    payoutId: payout.id,
    failureCode: payout.failure_code,
  });

  // Note: Update local payout based on metadata or external ID lookup
  logger.debug("Would mark local payout as failed", {
    stripePayoutId: payout.id,
    failureCode: payout.failure_code,
  });
});

// Webhook endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      logger.warn("Stripe webhook missing signature");
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    const event = constructWebhookEvent(body, signature);

    if (!event) {
      logger.warn("Stripe webhook signature verification failed");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    logger.webhook.received(event.type, event.id);

    // Handle the event
    await handleStripeEvent(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("Stripe webhook error", error as Error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

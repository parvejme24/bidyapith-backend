import { config } from '../../../config';
import { stripe } from '../../../config/stripe';
import type {
  CheckoutSession,
  CreateSessionParams,
  GatewayEvent,
  PaymentGatewayAdapter,
} from './gateway.interface';

const ignoredEvent = (raw: unknown): GatewayEvent => ({
  gatewayTransactionId: '',
  transactionRef: '',
  status: 'FAILED',
  amountMinor: 0,
  currency: config.DEFAULT_CURRENCY,
  raw,
});

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

export class StripeAdapter implements PaymentGatewayAdapter {
  async createSession(params: CreateSessionParams): Promise<CheckoutSession> {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: params.transactionRef,
      customer_email: params.customerEmail,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: { transactionRef: params.transactionRef },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: params.currency.toLowerCase(),
            unit_amount: params.amountMinor,
            product_data: { name: params.description },
          },
        },
      ],
    });

    if (session.url === null || session.url.length === 0) {
      throw new Error('Stripe did not return a checkout URL');
    }

    return { sessionId: session.id, redirectUrl: session.url };
  }

  async verifyWebhook(rawBody: Buffer, signature: string): Promise<GatewayEvent> {
    const event = stripe.webhooks.constructEvent(rawBody, signature, config.STRIPE_WEBHOOK_SECRET);

    if (
      event.type !== 'checkout.session.completed' &&
      event.type !== 'checkout.session.expired' &&
      event.type !== 'checkout.session.async_payment_failed'
    ) {
      return ignoredEvent(event);
    }

    const session = event.data.object;
    const paymentIntent = session.payment_intent;
    const gatewayTransactionId =
      typeof paymentIntent === 'string'
        ? paymentIntent
        : paymentIntent !== null && typeof paymentIntent === 'object' && 'id' in paymentIntent
          ? asString(paymentIntent.id)
          : session.id;

    const metadataRef = session.metadata?.['transactionRef'];
    const transactionRef =
      typeof metadataRef === 'string' && metadataRef.length > 0
        ? metadataRef
        : (session.client_reference_id ?? '');

    const status: GatewayEvent['status'] =
      event.type === 'checkout.session.completed' && session.payment_status === 'paid'
        ? 'SUCCESS'
        : event.type === 'checkout.session.expired'
          ? 'CANCELLED'
          : 'FAILED';

    return {
      gatewayTransactionId: gatewayTransactionId.length > 0 ? gatewayTransactionId : session.id,
      transactionRef,
      status,
      amountMinor: session.amount_total ?? 0,
      currency: (session.currency ?? config.DEFAULT_CURRENCY).toUpperCase(),
      raw: event,
    };
  }
}

export const stripeAdapter = new StripeAdapter();

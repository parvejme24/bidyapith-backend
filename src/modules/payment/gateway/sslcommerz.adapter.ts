import { config } from '../../../config';
import type {
  CheckoutSession,
  CreateSessionParams,
  GatewayEvent,
  PaymentGatewayAdapter,
} from './gateway.interface';

export class SslCommerzAdapter implements PaymentGatewayAdapter {
  async createSession(params: CreateSessionParams): Promise<CheckoutSession> {
    const sessionId = `sslcz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const redirectUrl = `${params.successUrl}&val_id=${sessionId}`;
    return {
      sessionId,
      redirectUrl,
    };
  }

  async verifyWebhook(rawBody: Buffer, _signature: string): Promise<GatewayEvent> {
    let payload: Record<string, any>;
    try {
      payload = JSON.parse(rawBody.toString('utf-8'));
    } catch {
      payload = {};
    }

    const transactionRef = String(payload['tran_id'] || payload['transactionRef'] || '');
    const valId = String(payload['val_id'] || payload['gatewayTransactionId'] || `sslcz_${Date.now()}`);
    const statusRaw = String(payload['status'] || '').toUpperCase();
    const status: GatewayEvent['status'] =
      statusRaw === 'VALID' || statusRaw === 'VALIDATED' || statusRaw === 'SUCCESS'
        ? 'SUCCESS'
        : statusRaw === 'CANCELLED'
          ? 'CANCELLED'
          : 'FAILED';

    const amount = Number(payload['amount'] || 0);
    const amountMinor = amount > 0 ? Math.round(amount * 100) : Number(payload['amountMinor'] || 0);

    return {
      gatewayTransactionId: valId,
      transactionRef,
      status,
      amountMinor,
      currency: String(payload['currency'] || config.DEFAULT_CURRENCY).toUpperCase(),
      raw: payload,
    };
  }
}

export const sslCommerzAdapter = new SslCommerzAdapter();

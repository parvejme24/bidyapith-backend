import type {
  CheckoutSession,
  CreateSessionParams,
  GatewayEvent,
  PaymentGatewayAdapter,
} from './gateway.interface';

export class SslCommerzAdapter implements PaymentGatewayAdapter {
  async createSession(_params: CreateSessionParams): Promise<CheckoutSession> {
    throw new Error('Not implemented');
  }

  async verifyWebhook(_rawBody: Buffer, _signature: string): Promise<GatewayEvent> {
    throw new Error('Not implemented');
  }
}

export const sslCommerzAdapter = new SslCommerzAdapter();

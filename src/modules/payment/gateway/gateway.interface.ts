export type CheckoutSession = {
  sessionId: string;
  redirectUrl: string;
};

export type GatewayEvent = {
  gatewayTransactionId: string;
  transactionRef: string;
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
  amountMinor: number;
  currency: string;
  raw: unknown;
};

export type CreateSessionParams = {
  transactionRef: string;
  amountMinor: number;
  currency: string;
  description: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
};

export interface PaymentGatewayAdapter {
  createSession(params: CreateSessionParams): Promise<CheckoutSession>;
  verifyWebhook(rawBody: Buffer, signature: string): Promise<GatewayEvent>;
}

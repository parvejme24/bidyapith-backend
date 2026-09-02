import { config } from '../../../config';
import type { PaymentGatewayAdapter } from './gateway.interface';
import { sslCommerzAdapter } from './sslcommerz.adapter';
import { stripeAdapter } from './stripe.adapter';

export const getPaymentGateway = (): PaymentGatewayAdapter => {
  if (config.PAYMENT_GATEWAY === 'SSLCOMMERZ') {
    return sslCommerzAdapter;
  }
  return stripeAdapter;
};

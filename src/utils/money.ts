import { Prisma } from '@prisma/client';

const DEFAULT_DECIMALS = 2;

const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND']);

export const minorDecimals = (currency: string): number => {
  const code = currency.trim().toUpperCase();
  if (ZERO_DECIMAL.has(code)) {
    return 0;
  }
  return DEFAULT_DECIMALS;
};

const factorFor = (currency: string): Prisma.Decimal =>
  new Prisma.Decimal(10).pow(minorDecimals(currency));

export const toMinor = (amount: Prisma.Decimal, currency: string): number => {
  const minor = amount.mul(factorFor(currency)).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
  const value = minor.toNumber();
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Amount ${amount.toFixed()} ${currency} is not a safe minor-unit integer`);
  }
  return value;
};

export const fromMinor = (minor: number, currency: string): Prisma.Decimal => {
  if (!Number.isInteger(minor)) {
    throw new Error('Minor units must be an integer');
  }
  return new Prisma.Decimal(minor).div(factorFor(currency));
};

export const formatMajor = (amount: Prisma.Decimal): string => amount.toFixed(DEFAULT_DECIMALS);

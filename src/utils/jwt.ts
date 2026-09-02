import { createHash, randomBytes, randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { config } from '../config';
import { ApiError } from '../shared/ApiError';

export type AccessTokenPayload = {
  userId: string;
  role: Role;
  iat: number;
  exp: number;
};

const isRole = (value: unknown): value is Role =>
  typeof value === 'string' && (Object.values(Role) as string[]).includes(value);

export const signAccessToken = (userId: string, role: Role): string => {
  return jwt.sign({ userId, role }, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES_IN,
  } as jwt.SignOptions);
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  try {
    const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET);
    if (
      typeof decoded === 'string' ||
      typeof decoded.userId !== 'string' ||
      !isRole(decoded.role) ||
      typeof decoded.iat !== 'number' ||
      typeof decoded.exp !== 'number'
    ) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid access token');
    }

    return {
      userId: decoded.userId,
      role: decoded.role,
      iat: decoded.iat,
      exp: decoded.exp,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid or expired access token');
  }
};

export const generateOpaqueToken = (): string => randomBytes(32).toString('base64url');

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export const newTokenFamily = (): string => randomUUID();

export const refreshTokenExpiryDate = (): Date => {
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  return expires;
};

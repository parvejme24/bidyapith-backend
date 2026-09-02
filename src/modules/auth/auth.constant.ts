import type { CookieOptions, Response } from 'express';
import { config } from '../../config';

export const REFRESH_TOKEN_COOKIE = 'refreshToken';

export const AUTH_MESSAGES = {
  invalidCredentials: 'Invalid email or password',
  blocked: 'Your account has been blocked. Contact the university administration.',
  googleOnly: 'This account was created with Google. Please sign in with Google.',
  duplicateEmail: 'An account with this email already exists',
  programNotFound: 'Program not found',
  invalidRefresh: 'Invalid refresh token',
  expiredRefresh: 'Refresh token has expired',
  reuseDetected: 'Refresh token reuse detected. All sessions have been revoked.',
  invalidReset: 'Invalid reset token',
  expiredReset: 'Reset token has expired',
  usedReset: 'Reset token has already been used',
  invalidVerify: 'Invalid verification token',
  expiredVerify: 'Verification token has expired',
  usedVerify: 'Verification token has already been used',
  googleUnverified: 'Google account email is not verified',
  googleNotConfigured: 'Google sign-in is not configured',
  googleSignupRequiresRegister:
    'Google sign-in is only available for existing accounts. Register with email first and provide a program.',
  currentPasswordWrong: 'Current password is incorrect',
  googlePasswordChange: 'This account uses Google sign-in and has no password to change',
} as const;

export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

const refreshCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: config.NODE_ENV === 'production',
  path: '/',
  maxAge: 30 * 24 * 60 * 60 * 1000,
});

export const setRefreshTokenCookie = (res: Response, token: string): void => {
  res.cookie(REFRESH_TOKEN_COOKIE, token, refreshCookieOptions());
};

export const clearRefreshTokenCookie = (res: Response): void => {
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.NODE_ENV === 'production',
    path: '/',
  });
};

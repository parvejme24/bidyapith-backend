import type { AuthProvider, Role, UserStatus } from '@prisma/client';
import type { z } from 'zod';
import type { AuthValidation } from './auth.validation';

export type RequestMeta = {
  ipAddress?: string;
  userAgent?: string;
};

export type RegisterInput = z.infer<typeof AuthValidation.register>['body'];
export type LoginInput = z.infer<typeof AuthValidation.login>['body'];
export type GoogleInput = z.infer<typeof AuthValidation.google>['body'];
export type ChangePasswordInput = z.infer<typeof AuthValidation.changePassword>['body'];
export type ResetPasswordInput = z.infer<typeof AuthValidation.resetPassword>['body'];

export type PublicUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: Role;
  status: UserStatus;
  provider: AuthProvider;
  emailVerified: boolean;
  avatarUrl: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
};

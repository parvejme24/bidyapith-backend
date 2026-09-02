import {
  AuditAction,
  AuthProvider,
  Prisma,
  Role,
  TokenPurpose,
  UserStatus,
  type User,
} from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import { StatusCodes } from 'http-status-codes';
import bcrypt from 'bcryptjs';
import { config } from '../../config';
import { ApiError } from '../../shared/ApiError';
import { prisma } from '../../shared/prisma';
import { createAuditLog } from '../../utils/auditLog';
import {
  generateOpaqueToken,
  hashToken,
  newTokenFamily,
  refreshTokenExpiryDate,
  signAccessToken,
} from '../../utils/jwt';
import { comparePassword, hashPassword } from '../../utils/password';
import { sendEmail } from '../../utils/sendEmail';
import {
  AUTH_MESSAGES,
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  STUDENT_ID_SEQUENCE_PAD,
} from './auth.constant';
import type {
  AuthSession,
  ChangePasswordInput,
  GoogleInput,
  LoginInput,
  PublicUser,
  RegisterInput,
  RequestMeta,
  ResetPasswordInput,
} from './auth.interface';

const googleClient = new OAuth2Client();

const dummyPasswordHash = bcrypt.hashSync('__timing_safe_dummy__', config.BCRYPT_SALT_ROUNDS);

const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.status,
  provider: user.provider,
  emailVerified: user.emailVerified,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const isUniqueConstraint = (error: unknown, field: string): boolean => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  const target = error.meta?.['target'];
  if (typeof target === 'string') {
    return target.includes(field);
  }
  if (Array.isArray(target)) {
    return target.some((item) => String(item).includes(field));
  }
  return true;
};

const generateStudentId = async (
  tx: Prisma.TransactionClient,
  programId: string,
  programCode: string,
  admissionYear: number,
): Promise<string> => {
  const lockKey = `${programId}:${admissionYear}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

  const prefix = `${admissionYear}-${programCode.toUpperCase()}-`;
  const latest = await tx.studentProfile.findFirst({
    where: {
      programId,
      admissionYear,
      studentId: { startsWith: prefix },
    },
    orderBy: { studentId: 'desc' },
    select: { studentId: true },
  });

  let next = 1;
  if (latest?.studentId !== null && latest?.studentId !== undefined) {
    const sequencePart = latest.studentId.split('-')[2];
    const parsed = sequencePart === undefined ? Number.NaN : Number.parseInt(sequencePart, 10);
    if (Number.isFinite(parsed)) {
      next = parsed + 1;
    }
  }

  return `${prefix}${String(next).padStart(STUDENT_ID_SEQUENCE_PAD, '0')}`;
};

const createSession = async (
  tx: Prisma.TransactionClient,
  user: User,
  family?: string,
): Promise<{ accessToken: string; refreshToken: string }> => {
  const refreshToken = generateOpaqueToken();
  await tx.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      family: family ?? newTokenFamily(),
      expiresAt: refreshTokenExpiryDate(),
    },
  });

  return {
    accessToken: signAccessToken(user.id, user.role),
    refreshToken,
  };
};

const revokeFamily = async (tx: Prisma.TransactionClient, family: string): Promise<void> => {
  await tx.refreshToken.updateMany({
    where: { family, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

const revokeAllUserSessions = async (
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> => {
  await tx.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

const assertActiveUser = (user: User): void => {
  if (user.deletedAt !== null) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, AUTH_MESSAGES.invalidCredentials);
  }
  if (user.status === UserStatus.BLOCKED) {
    throw new ApiError(StatusCodes.FORBIDDEN, AUTH_MESSAGES.blocked);
  }
};

const register = async (input: RegisterInput): Promise<{ user: PublicUser; studentId: string }> => {
  const passwordHash = await hashPassword(input.password);
  const verificationToken = generateOpaqueToken();
  const admissionYear = new Date().getFullYear();

  let created: { user: User; studentId: string };

  try {
    created = await prisma.$transaction(async (tx) => {
      const program = await tx.program.findUnique({ where: { id: input.programId } });
      if (program === null) {
        throw new ApiError(StatusCodes.NOT_FOUND, AUTH_MESSAGES.programNotFound);
      }

      const studentId = await generateStudentId(tx, program.id, program.code, admissionYear);

      const user = await tx.user.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          password: passwordHash,
          role: Role.STUDENT,
          status: UserStatus.PENDING_VERIFICATION,
          provider: AuthProvider.CREDENTIALS,
          emailVerified: false,
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
        },
      });

      await tx.studentProfile.create({
        data: {
          userId: user.id,
          programId: program.id,
          studentId,
          admissionYear,
        },
      });

      await tx.verificationToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(verificationToken),
          purpose: TokenPurpose.EMAIL_VERIFICATION,
          expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
        },
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AuditAction.REGISTER,
        entity: 'User',
        entityId: user.id,
        metadata: { studentId, programId: program.id },
      });

      return { user, studentId };
    });
  } catch (error) {
    if (isUniqueConstraint(error, 'email')) {
      throw new ApiError(StatusCodes.CONFLICT, AUTH_MESSAGES.duplicateEmail);
    }
    throw error;
  }

  await sendEmail({
    to: created.user.email,
    subject: 'Verify your Bidyapith account',
    template: 'welcome',
    data: {
      firstName: created.user.firstName,
      verificationUrl: `${config.CLIENT_URL}/verify-email?token=${verificationToken}`,
      expiresIn: '24 hours',
    },
  });

  return { user: toPublicUser(created.user), studentId: created.studentId };
};

const login = async (input: LoginInput, meta: RequestMeta): Promise<AuthSession> => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (user === null || user.deletedAt !== null) {
    await comparePassword(input.password, dummyPasswordHash);
    throw new ApiError(StatusCodes.UNAUTHORIZED, AUTH_MESSAGES.invalidCredentials);
  }

  if (user.password === null) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, AUTH_MESSAGES.googleOnly);
  }

  const matches = await comparePassword(input.password, user.password);
  if (!matches) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, AUTH_MESSAGES.invalidCredentials);
  }

  if (user.status === UserStatus.BLOCKED) {
    throw new ApiError(StatusCodes.FORBIDDEN, AUTH_MESSAGES.blocked);
  }

  const now = new Date();
  const { accessToken, refreshToken, updated } = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: { lastLoginAt: now },
    });

    await createAuditLog(tx, {
      userId: user.id,
      action: AuditAction.LOGIN,
      entity: 'User',
      entityId: user.id,
      metadata: { provider: AuthProvider.CREDENTIALS },
      ...(meta.ipAddress !== undefined ? { ipAddress: meta.ipAddress } : {}),
      ...(meta.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
    });

    const session = await createSession(tx, updatedUser);
    return { ...session, updated: updatedUser };
  });

  return { accessToken, refreshToken, user: toPublicUser(updated) };
};

const googleLogin = async (input: GoogleInput, meta: RequestMeta): Promise<AuthSession> => {
  if (config.GOOGLE_CLIENT_ID.length === 0) {
    throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, AUTH_MESSAGES.googleNotConfigured);
  }

  let email: string;
  let emailVerified = false;
  let firstName = 'Student';
  let lastName = 'User';
  let googleId: string;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: input.idToken,
      audience: config.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (payload === undefined || payload.email === undefined || payload.sub === undefined) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid Google token');
    }
    email = payload.email.toLowerCase().trim();
    emailVerified = payload.email_verified === true;
    googleId = payload.sub;
    if (payload.given_name !== undefined && payload.given_name.length > 0) {
      firstName = payload.given_name;
    } else if (payload.name !== undefined) {
      const parts = payload.name.trim().split(/\s+/);
      const head = parts[0];
      if (head !== undefined) {
        firstName = head;
      }
    }
    if (payload.family_name !== undefined && payload.family_name.length > 0) {
      lastName = payload.family_name;
    } else if (payload.name !== undefined) {
      const parts = payload.name.trim().split(/\s+/);
      if (parts.length > 1) {
        lastName = parts.slice(1).join(' ');
      }
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid Google token');
  }

  if (!emailVerified) {
    throw new ApiError(StatusCodes.FORBIDDEN, AUTH_MESSAGES.googleUnverified);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  const now = new Date();

  if (existing !== null) {
    assertActiveUser(existing);

    const { accessToken, refreshToken, updated } = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: existing.id },
        data: {
          lastLoginAt: now,
          emailVerified: true,
          ...(existing.googleId === null ? { googleId } : {}),
        },
      });

      await createAuditLog(tx, {
        userId: existing.id,
        action: AuditAction.GOOGLE_LOGIN,
        entity: 'User',
        entityId: existing.id,
        ...(meta.ipAddress !== undefined ? { ipAddress: meta.ipAddress } : {}),
        ...(meta.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
      });

      const session = await createSession(tx, updatedUser);
      return { ...session, updated: updatedUser };
    });

    return { accessToken, refreshToken, user: toPublicUser(updated) };
  }

  try {
    const { accessToken, refreshToken, created } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          firstName,
          lastName,
          email,
          password: null,
          role: Role.STUDENT,
          status: UserStatus.ACTIVE,
          provider: AuthProvider.GOOGLE,
          googleId,
          emailVerified: true,
          lastLoginAt: now,
        },
      });

      await tx.studentProfile.create({
        data: { userId: user.id },
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: AuditAction.GOOGLE_LOGIN,
        entity: 'User',
        entityId: user.id,
        metadata: { created: true },
        ...(meta.ipAddress !== undefined ? { ipAddress: meta.ipAddress } : {}),
        ...(meta.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
      });

      const session = await createSession(tx, user);
      return { ...session, created: user };
    });

    return { accessToken, refreshToken, user: toPublicUser(created) };
  } catch (error) {
    if (isUniqueConstraint(error, 'email') || isUniqueConstraint(error, 'googleId')) {
      throw new ApiError(StatusCodes.CONFLICT, AUTH_MESSAGES.duplicateEmail);
    }
    throw error;
  }
};

const refreshToken = async (rawToken: string): Promise<AuthSession> => {
  const tokenHash = hashToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (stored === null) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, AUTH_MESSAGES.invalidRefresh);
  }

  if (stored.revokedAt !== null) {
    await prisma.$transaction(async (tx) => {
      await revokeFamily(tx, stored.family);
      await createAuditLog(tx, {
        userId: stored.userId,
        action: AuditAction.TOKEN_REUSE_DETECTED,
        entity: 'RefreshToken',
        entityId: stored.id,
        metadata: { family: stored.family },
      });
    });
    throw new ApiError(StatusCodes.UNAUTHORIZED, AUTH_MESSAGES.reuseDetected);
  }

  if (stored.expiresAt.getTime() <= Date.now()) {
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    throw new ApiError(StatusCodes.UNAUTHORIZED, AUTH_MESSAGES.expiredRefresh);
  }

  assertActiveUser(stored.user);

  const { accessToken, refreshToken: nextRefresh, updated } = await prisma.$transaction(
    async (tx) => {
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });

      const updatedUser = await tx.user.findUnique({ where: { id: stored.userId } });
      if (updatedUser === null) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, AUTH_MESSAGES.invalidRefresh);
      }

      await createAuditLog(tx, {
        userId: stored.userId,
        action: AuditAction.TOKEN_REFRESH,
        entity: 'RefreshToken',
        entityId: stored.id,
      });

      const session = await createSession(tx, updatedUser, stored.family);
      return { ...session, updated: updatedUser };
    },
  );

  return { accessToken, refreshToken: nextRefresh, user: toPublicUser(updated) };
};

const logout = async (rawToken: string, userId: string): Promise<null> => {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });

  if (stored === null || stored.userId !== userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, AUTH_MESSAGES.invalidRefresh);
  }

  if (stored.revokedAt === null) {
    await prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      await createAuditLog(tx, {
        userId,
        action: AuditAction.LOGOUT,
        entity: 'RefreshToken',
        entityId: stored.id,
      });
    });
  }

  return null;
};

const changePassword = async (
  userId: string,
  input: ChangePasswordInput,
): Promise<AuthSession> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user === null || user.deletedAt !== null) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, AUTH_MESSAGES.invalidCredentials);
  }

  if (user.password === null) {
    throw new ApiError(StatusCodes.BAD_REQUEST, AUTH_MESSAGES.googlePasswordChange);
  }

  const matches = await comparePassword(input.currentPassword, user.password);
  if (!matches) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, AUTH_MESSAGES.currentPasswordWrong);
  }

  const nextHash = await hashPassword(input.newPassword);
  const now = new Date();

  const { accessToken, refreshToken, updated } = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        password: nextHash,
        passwordChangedAt: now,
      },
    });

    await revokeAllUserSessions(tx, userId);

    await createAuditLog(tx, {
      userId,
      action: AuditAction.PASSWORD_CHANGE,
      entity: 'User',
      entityId: userId,
    });

    const session = await createSession(tx, updatedUser);
    return { ...session, updated: updatedUser };
  });

  return { accessToken, refreshToken, user: toPublicUser(updated) };
};

const forgotPassword = async (email: string): Promise<null> => {
  const user = await prisma.user.findUnique({ where: { email } });
  const generic = null;

  if (user === null || user.deletedAt !== null || user.status === UserStatus.BLOCKED) {
    return generic;
  }

  const resetToken = generateOpaqueToken();

  await prisma.$transaction(async (tx) => {
    await tx.verificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(resetToken),
        purpose: TokenPurpose.PASSWORD_RESET,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });
    await createAuditLog(tx, {
      userId: user.id,
      action: AuditAction.PASSWORD_RESET_REQUEST,
      entity: 'User',
      entityId: user.id,
    });
  });

  await sendEmail({
    to: user.email,
    subject: 'Reset your Bidyapith password',
    template: 'passwordReset',
    data: {
      firstName: user.firstName,
      resetUrl: `${config.CLIENT_URL}/reset-password?token=${resetToken}`,
      expiresIn: '15 minutes',
    },
  });

  return generic;
};

const resetPassword = async (input: ResetPasswordInput): Promise<null> => {
  const tokenHash = hashToken(input.token);
  const stored = await prisma.verificationToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (stored === null || stored.purpose !== TokenPurpose.PASSWORD_RESET) {
    throw new ApiError(StatusCodes.BAD_REQUEST, AUTH_MESSAGES.invalidReset);
  }
  if (stored.usedAt !== null) {
    throw new ApiError(StatusCodes.BAD_REQUEST, AUTH_MESSAGES.usedReset);
  }
  if (stored.expiresAt.getTime() <= Date.now()) {
    throw new ApiError(StatusCodes.BAD_REQUEST, AUTH_MESSAGES.expiredReset);
  }

  const nextHash = await hashPassword(input.newPassword);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.verificationToken.update({
      where: { id: stored.id },
      data: { usedAt: now },
    });
    await tx.user.update({
      where: { id: stored.userId },
      data: {
        password: nextHash,
        passwordChangedAt: now,
        provider: AuthProvider.CREDENTIALS,
      },
    });
    await revokeAllUserSessions(tx, stored.userId);
    await createAuditLog(tx, {
      userId: stored.userId,
      action: AuditAction.PASSWORD_RESET,
      entity: 'User',
      entityId: stored.userId,
    });
  });

  return null;
};

const verifyEmail = async (token: string): Promise<PublicUser> => {
  const stored = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (stored === null || stored.purpose !== TokenPurpose.EMAIL_VERIFICATION) {
    throw new ApiError(StatusCodes.BAD_REQUEST, AUTH_MESSAGES.invalidVerify);
  }
  if (stored.usedAt !== null) {
    throw new ApiError(StatusCodes.BAD_REQUEST, AUTH_MESSAGES.usedVerify);
  }
  if (stored.expiresAt.getTime() <= Date.now()) {
    throw new ApiError(StatusCodes.BAD_REQUEST, AUTH_MESSAGES.expiredVerify);
  }

  const now = new Date();
  const user = await prisma.$transaction(async (tx) => {
    await tx.verificationToken.update({
      where: { id: stored.id },
      data: { usedAt: now },
    });
    const updated = await tx.user.update({
      where: { id: stored.userId },
      data: {
        emailVerified: true,
        status: UserStatus.ACTIVE,
      },
    });
    await createAuditLog(tx, {
      userId: stored.userId,
      action: AuditAction.EMAIL_VERIFIED,
      entity: 'User',
      entityId: stored.userId,
    });
    return updated;
  });

  return toPublicUser(user);
};

export const AuthService = {
  register,
  login,
  googleLogin,
  refreshToken,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
};

import { Role, UserStatus } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../shared/ApiError';
import { catchAsync } from '../shared/catchAsync';
import { prisma } from '../shared/prisma';
import { verifyAccessToken } from '../utils/jwt';

const isRole = (value: string): value is Role => (Object.values(Role) as string[]).includes(value);

export const auth = catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Access token is required');
  }

  const token = header.slice('Bearer '.length).trim();
  if (token.length === 0) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Access token is required');
  }

  const payload = verifyAccessToken(token);
  if (!isRole(payload.role)) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid access token');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      deletedAt: true,
      passwordChangedAt: true,
      studentProfile: { select: { id: true, deletedAt: true } },
      instructorProfile: { select: { id: true, deletedAt: true } },
    },
  });

  if (!user || user.deletedAt !== null) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid access token');
  }

  if (user.status === UserStatus.BLOCKED) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Your account has been blocked');
  }

  if (
    user.passwordChangedAt !== null &&
    payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)
  ) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Password was changed. Please log in again.');
  }

  const studentProfileId =
    user.studentProfile !== null && user.studentProfile.deletedAt === null
      ? user.studentProfile.id
      : undefined;
  const instructorProfileId =
    user.instructorProfile !== null && user.instructorProfile.deletedAt === null
      ? user.instructorProfile.id
      : undefined;

  req.user = {
    userId: user.id,
    email: user.email,
    role: user.role,
    ...(studentProfileId !== undefined ? { studentProfileId } : {}),
    ...(instructorProfileId !== undefined ? { instructorProfileId } : {}),
  };

  next();
});

import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../shared/ApiError';

export const authorize = (...roles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.user === undefined) {
      next(new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ApiError(StatusCodes.FORBIDDEN, 'You are not allowed to perform this action'));
      return;
    }

    next();
  };
};

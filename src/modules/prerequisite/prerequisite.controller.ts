import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../shared/ApiError';
import { catchAsync } from '../../shared/catchAsync';
import { sendResponse } from '../../shared/sendResponse';
import { PrerequisiteService } from './prerequisite.service';

const requireUserId = (req: Request): string => {
  if (req.user === undefined) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required');
  }
  return req.user.userId;
};

const create = catchAsync(async (req: Request, res: Response) => {
  const data = await PrerequisiteService.create(
    requireUserId(req),
    String(req.params['id']),
    req.body,
  );
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Prerequisite added successfully',
    data,
  });
});

const tree = catchAsync(async (req: Request, res: Response) => {
  const data = await PrerequisiteService.getTree(String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Prerequisites retrieved successfully',
    data,
  });
});

const dependents = catchAsync(async (req: Request, res: Response) => {
  const data = await PrerequisiteService.getDependents(String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Dependent courses retrieved successfully',
    data,
  });
});

const remove = catchAsync(async (req: Request, res: Response) => {
  const data = await PrerequisiteService.remove(
    requireUserId(req),
    String(req.params['id']),
    String(req.params['prerequisiteId']),
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Prerequisite removed successfully',
    data,
  });
});

export const PrerequisiteController = {
  create,
  tree,
  dependents,
  remove,
};

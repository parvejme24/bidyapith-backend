import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../shared/ApiError';
import { catchAsync } from '../../shared/catchAsync';
import { sendResponse } from '../../shared/sendResponse';
import { InstructorService } from './instructor.service';

const requireUserId = (req: Request): string => {
  if (req.user === undefined) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required');
  }
  return req.user.userId;
};

const getMe = catchAsync(async (req: Request, res: Response) => {
  const data = await InstructorService.getMe(requireUserId(req));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Instructor profile retrieved successfully',
    data,
  });
});

const updateMe = catchAsync(async (req: Request, res: Response) => {
  const data = await InstructorService.updateMe(requireUserId(req), req.body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Instructor profile updated successfully',
    data,
  });
});

const list = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await InstructorService.listInstructors(
    req.query as Parameters<typeof InstructorService.listInstructors>[0],
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Instructors retrieved successfully',
    meta,
    data,
  });
});

const getById = catchAsync(async (req: Request, res: Response) => {
  const data = await InstructorService.getById(String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Instructor retrieved successfully',
    data,
  });
});

const adminUpdate = catchAsync(async (req: Request, res: Response) => {
  const data = await InstructorService.adminUpdate(String(req.params['id']), req.body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Instructor updated successfully',
    data,
  });
});

export const InstructorController = {
  getMe,
  updateMe,
  list,
  getById,
  adminUpdate,
};

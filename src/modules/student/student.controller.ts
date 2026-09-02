import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../shared/ApiError';
import { catchAsync } from '../../shared/catchAsync';
import { sendResponse } from '../../shared/sendResponse';
import { StudentService } from './student.service';

const requireUserId = (req: Request): string => {
  if (req.user === undefined) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required');
  }
  return req.user.userId;
};

const getMe = catchAsync(async (req: Request, res: Response) => {
  const data = await StudentService.getMe(requireUserId(req));
  sendResponse(res, { statusCode: StatusCodes.OK, success: true, message: 'Student profile retrieved successfully', data });
});

const updateMe = catchAsync(async (req: Request, res: Response) => {
  const data = await StudentService.updateMe(requireUserId(req), req.body);
  sendResponse(res, { statusCode: StatusCodes.OK, success: true, message: 'Student profile updated successfully', data });
});

const list = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await StudentService.listStudents(req.query as Parameters<typeof StudentService.listStudents>[0]);
  sendResponse(res, { statusCode: StatusCodes.OK, success: true, message: 'Students retrieved successfully', meta, data });
});

const getById = catchAsync(async (req: Request, res: Response) => {
  const data = await StudentService.getById(String(req.params['id']));
  sendResponse(res, { statusCode: StatusCodes.OK, success: true, message: 'Student retrieved successfully', data });
});

const adminUpdate = catchAsync(async (req: Request, res: Response) => {
  const data = await StudentService.adminUpdate(String(req.params['id']), req.body);
  sendResponse(res, { statusCode: StatusCodes.OK, success: true, message: 'Student updated successfully', data });
});

export const StudentController = {
  getMe,
  updateMe,
  list,
  getById,
  adminUpdate,
};

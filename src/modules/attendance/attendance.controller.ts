import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../shared/ApiError';
import { catchAsync } from '../../shared/catchAsync';
import { sendResponse } from '../../shared/sendResponse';
import { AttendanceService } from './attendance.service';

const requireUserId = (req: Request): string => {
  if (req.user === undefined) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required');
  }
  return req.user.userId;
};

const requireStudentProfileId = (req: Request): string => {
  if (req.user === undefined) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required');
  }
  if (req.user.studentProfileId === undefined) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Student profile not found');
  }
  return req.user.studentProfileId;
};

const mark = catchAsync(async (req: Request, res: Response) => {
  const data = await AttendanceService.markSession(
    requireUserId(req),
    String(req.params['id']),
    req.body,
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Attendance recorded successfully',
    data,
  });
});

const getSession = catchAsync(async (req: Request, res: Response) => {
  const data = await AttendanceService.getSession(
    String(req.params['id']),
    String(req.query['date']),
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Attendance session retrieved successfully',
    data,
  });
});

const getSummary = catchAsync(async (req: Request, res: Response) => {
  const data = await AttendanceService.getSummary(String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Attendance summary retrieved successfully',
    data,
  });
});

const getMine = catchAsync(async (req: Request, res: Response) => {
  const data = await AttendanceService.getMine(requireStudentProfileId(req));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Attendance retrieved successfully',
    data,
  });
});

const removeSession = catchAsync(async (req: Request, res: Response) => {
  const data = await AttendanceService.deleteSession(
    requireUserId(req),
    String(req.params['id']),
    String(req.query['date']),
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Attendance session deleted successfully',
    data,
  });
});

export const AttendanceController = {
  mark,
  getSession,
  getSummary,
  getMine,
  removeSession,
};

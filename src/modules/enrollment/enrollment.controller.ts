import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../shared/ApiError';
import { catchAsync } from '../../shared/catchAsync';
import { sendResponse } from '../../shared/sendResponse';
import { EnrollmentService } from './enrollment.service';

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

const create = catchAsync(async (req: Request, res: Response) => {
  const data = await EnrollmentService.registerSelf(
    requireUserId(req),
    requireStudentProfileId(req),
    req.body.offeringId,
  );
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: `Registered for ${data.course.code}`,
    data,
  });
});

const createAdmin = catchAsync(async (req: Request, res: Response) => {
  const data = await EnrollmentService.registerAdmin(requireUserId(req), req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: `Registered for ${data.course.code}`,
    data,
  });
});

const listMine = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await EnrollmentService.listMyCourses(
    requireStudentProfileId(req),
    req.query as Parameters<typeof EnrollmentService.listMyCourses>[1],
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Enrollments retrieved successfully',
    meta,
    data,
  });
});

const listAvailable = catchAsync(async (req: Request, res: Response) => {
  const data = await EnrollmentService.listAvailable(
    requireStudentProfileId(req),
    req.query as Parameters<typeof EnrollmentService.listAvailable>[1],
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Available courses retrieved successfully',
    data,
  });
});

const listAll = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await EnrollmentService.listAll(
    req.query as Parameters<typeof EnrollmentService.listAll>[0],
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Enrollments retrieved successfully',
    meta,
    data,
  });
});

const listRoster = catchAsync(async (req: Request, res: Response) => {
  const { offering, data, meta } = await EnrollmentService.listRoster(
    String(req.params['id']),
    req.query as Parameters<typeof EnrollmentService.listRoster>[1],
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Offering roster retrieved successfully',
    meta,
    data: { offering, students: data },
  });
});

const drop = catchAsync(async (req: Request, res: Response) => {
  const data = await EnrollmentService.drop(requireUserId(req), String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Course dropped successfully',
    data,
  });
});

export const EnrollmentController = {
  create,
  createAdmin,
  listMine,
  listAvailable,
  listAll,
  listRoster,
  drop,
};

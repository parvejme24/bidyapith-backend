import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../shared/ApiError';
import { catchAsync } from '../../shared/catchAsync';
import { sendResponse } from '../../shared/sendResponse';
import { ExamService } from './exam.service';

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
  const data = await ExamService.create(requireUserId(req), String(req.params['id']), req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Exam created successfully',
    data,
  });
});

const listByOffering = catchAsync(async (req: Request, res: Response) => {
  if (req.user === undefined) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required');
  }
  const { data, meta, weightRemaining } = await ExamService.listByOffering(
    String(req.params['id']),
    req.query as Parameters<typeof ExamService.listByOffering>[1],
    {
      role: req.user.role,
      ...(req.user.instructorProfileId !== undefined
        ? { instructorProfileId: req.user.instructorProfileId }
        : {}),
    },
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Exams retrieved successfully',
    meta,
    data: { weightRemaining, exams: data },
  });
});

const update = catchAsync(async (req: Request, res: Response) => {
  const data = await ExamService.update(requireUserId(req), String(req.params['id']), req.body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Exam updated successfully',
    data,
  });
});

const remove = catchAsync(async (req: Request, res: Response) => {
  const data = await ExamService.softDelete(requireUserId(req), String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Exam deleted successfully',
    data,
  });
});

const publish = catchAsync(async (req: Request, res: Response) => {
  const data = await ExamService.publish(
    requireUserId(req),
    String(req.params['id']),
    req.body.isPublished,
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: req.body.isPublished ? 'Exam published successfully' : 'Exam unpublished successfully',
    data,
  });
});

const enterResults = catchAsync(async (req: Request, res: Response) => {
  const data = await ExamService.enterResults(
    requireUserId(req),
    String(req.params['id']),
    req.body,
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Exam results saved successfully',
    data,
  });
});

const listResults = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await ExamService.listResults(
    String(req.params['id']),
    req.query as Parameters<typeof ExamService.listResults>[1],
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Exam results retrieved successfully',
    meta,
    data,
  });
});

const listMine = catchAsync(async (req: Request, res: Response) => {
  const data = await ExamService.listMine(
    requireStudentProfileId(req),
    req.query as Parameters<typeof ExamService.listMine>[1],
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Exam results retrieved successfully',
    data,
  });
});

export const ExamController = {
  create,
  listByOffering,
  update,
  remove,
  publish,
  enterResults,
  listResults,
  listMine,
};

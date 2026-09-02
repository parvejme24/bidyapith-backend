import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../shared/ApiError';
import { catchAsync } from '../../shared/catchAsync';
import { sendResponse } from '../../shared/sendResponse';
import { ResultService } from './result.service';

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

const previewGrades = catchAsync(async (req: Request, res: Response) => {
  const data = await ResultService.previewGrades(String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Grade preview retrieved successfully',
    data,
  });
});

const submitGrades = catchAsync(async (req: Request, res: Response) => {
  const data = await ResultService.submitGrades(
    requireUserId(req),
    String(req.params['id']),
    req.body,
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Final grades submitted successfully',
    data,
  });
});

const patchGrade = catchAsync(async (req: Request, res: Response) => {
  const data = await ResultService.patchGrade(
    requireUserId(req),
    String(req.params['id']),
    req.body,
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Grade updated successfully',
    data,
  });
});

const getReadiness = catchAsync(async (req: Request, res: Response) => {
  const data = await ResultService.getReadiness(String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Result readiness retrieved successfully',
    data,
  });
});

const publishResults = catchAsync(async (req: Request, res: Response) => {
  const data = await ResultService.publishResults(requireUserId(req), String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Semester results published successfully',
    data,
  });
});

const getMyResults = catchAsync(async (req: Request, res: Response) => {
  const data = await ResultService.getMyResults(
    requireStudentProfileId(req),
    req.query as Parameters<typeof ResultService.getMyResults>[1],
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Results retrieved successfully',
    data,
  });
});

const getMyTranscript = catchAsync(async (req: Request, res: Response) => {
  const data = await ResultService.getMyTranscript(requireStudentProfileId(req));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Transcript retrieved successfully',
    data,
  });
});

const getTranscriptByStudentId = catchAsync(async (req: Request, res: Response) => {
  const data = await ResultService.getTranscriptByStudentId(String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Transcript retrieved successfully',
    data,
  });
});

export const ResultController = {
  previewGrades,
  submitGrades,
  patchGrade,
  getReadiness,
  publishResults,
  getMyResults,
  getMyTranscript,
  getTranscriptByStudentId,
};

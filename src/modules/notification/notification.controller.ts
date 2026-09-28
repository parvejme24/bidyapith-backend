import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../shared/ApiError';
import { catchAsync } from '../../shared/catchAsync';
import { sendResponse } from '../../shared/sendResponse';
import { NotificationService } from './notification.service';

const requireUserId = (req: Request): string => {
  if (!req.user?.userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required');
  }
  return req.user.userId;
};

const getMyNotifications = catchAsync(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const data = await NotificationService.getMyNotifications(userId);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notifications retrieved successfully',
    data,
  });
});

const markAsRead = catchAsync(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const id = String(req.params['id']);
  const data = await NotificationService.markAsRead(userId, id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notification marked as read',
    data,
  });
});

const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const data = await NotificationService.markAllAsRead(userId);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'All notifications marked as read',
    data,
  });
});

const createBroadcast = catchAsync(async (req: Request, res: Response) => {
  const { title, body, target, type, link } = req.body;
  if (!title || !body) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Title and body are required');
  }
  const data = await NotificationService.createBroadcast({
    title,
    body,
    target,
    type,
    link,
  });
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Broadcast notification dispatched successfully',
    data,
  });
});

export const NotificationController = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  createBroadcast,
};

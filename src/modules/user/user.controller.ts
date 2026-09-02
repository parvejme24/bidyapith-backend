import type { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../shared/ApiError';
import { catchAsync } from '../../shared/catchAsync';
import { sendResponse } from '../../shared/sendResponse';
import type { AdminUserListQuery } from './user.interface';
import { UserService } from './user.service';

const requireAuth = (req: Request) => {
  if (req.user === undefined) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required');
  }
  return req.user;
};

const requireFile = (req: Request) => {
  if (req.file === undefined) {
    throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'Avatar file is required');
  }
  return req.file;
};

const getMe = catchAsync(async (req: Request, res: Response) => {
  const data = await UserService.getMe(requireAuth(req).userId);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Profile retrieved successfully',
    data,
  });
});

const updateMe = catchAsync(async (req: Request, res: Response) => {
  const data = await UserService.updateMe(requireAuth(req).userId, req.body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Profile updated successfully',
    data,
  });
});

const uploadAvatar = catchAsync(async (req: Request, res: Response) => {
  const data = await UserService.uploadAvatar(requireAuth(req).userId, requireFile(req));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Avatar uploaded successfully',
    data,
  });
});

const deleteAvatar = catchAsync(async (req: Request, res: Response) => {
  const data = await UserService.deleteAvatar(requireAuth(req).userId);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Avatar removed successfully',
    data,
  });
});

const createStaff = catchAsync(async (req: Request, res: Response) => {
  const data = await UserService.createStaff(requireAuth(req).userId, req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'User created successfully',
    data,
  });
});

const listUsers = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await UserService.listUsers(req.query as AdminUserListQuery);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Users retrieved successfully',
    meta,
    data,
  });
});

const getUserById = catchAsync(async (req: Request, res: Response) => {
  const data = await UserService.getUserById(String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'User retrieved successfully',
    data,
  });
});

const changeRole = catchAsync(async (req: Request, res: Response) => {
  const data = await UserService.changeRole(
    requireAuth(req).userId,
    String(req.params['id']),
    req.body.role as Role,
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'User role updated successfully',
    data,
  });
});

const changeStatus = catchAsync(async (req: Request, res: Response) => {
  const data = await UserService.changeStatus(
    requireAuth(req).userId,
    String(req.params['id']),
    req.body.status,
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'User status updated successfully',
    data,
  });
});

const softDelete = catchAsync(async (req: Request, res: Response) => {
  const data = await UserService.softDeleteUser(requireAuth(req).userId, String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'User deleted successfully',
    data,
  });
});

export const UserController = {
  getMe,
  updateMe,
  uploadAvatar,
  deleteAvatar,
  createStaff,
  listUsers,
  getUserById,
  changeRole,
  changeStatus,
  softDelete,
};

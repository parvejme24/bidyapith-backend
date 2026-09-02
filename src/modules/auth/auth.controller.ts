import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../shared/catchAsync';
import { ApiError } from '../../shared/ApiError';
import { sendResponse } from '../../shared/sendResponse';
import { clearRefreshTokenCookie, REFRESH_TOKEN_COOKIE, setRefreshTokenCookie } from './auth.constant';
import type { RequestMeta } from './auth.interface';
import { AuthService } from './auth.service';

const requestMeta = (req: Request): RequestMeta => {
  const ipAddress = req.ip;
  const userAgent = req.get('user-agent');
  return {
    ...(ipAddress !== undefined && ipAddress.length > 0 ? { ipAddress } : {}),
    ...(userAgent !== undefined && userAgent.length > 0 ? { userAgent } : {}),
  };
};

const requireUserId = (req: Request): string => {
  if (req.user === undefined) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required');
  }
  return req.user.userId;
};

const cookieToken = (req: Request): string => {
  const token = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (typeof token !== 'string' || token.length === 0) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Refresh token is required');
  }
  return token;
};

const register = catchAsync(async (req: Request, res: Response) => {
  const data = await AuthService.register(req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Registration successful. Please verify your email.',
    data,
  });
});

const login = catchAsync(async (req: Request, res: Response) => {
  const { refreshToken, ...data } = await AuthService.login(req.body, requestMeta(req));
  setRefreshTokenCookie(res, refreshToken);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Login successful',
    data,
  });
});

const google = catchAsync(async (req: Request, res: Response) => {
  const { refreshToken, ...data } = await AuthService.googleLogin(req.body, requestMeta(req));
  setRefreshTokenCookie(res, refreshToken);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Login successful',
    data,
  });
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const { refreshToken: nextRefresh, ...data } = await AuthService.refreshToken(cookieToken(req));
  setRefreshTokenCookie(res, nextRefresh);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Token refreshed',
    data,
  });
});

const logout = catchAsync(async (req: Request, res: Response) => {
  const data = await AuthService.logout(cookieToken(req), requireUserId(req));
  clearRefreshTokenCookie(res);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Logout successful',
    data,
  });
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
  const { refreshToken, ...data } = await AuthService.changePassword(requireUserId(req), req.body);
  setRefreshTokenCookie(res, refreshToken);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Password changed successfully',
    data,
  });
});

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const data = await AuthService.forgotPassword(req.body.email);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'If an account exists for this email, a reset link has been sent.',
    data,
  });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const data = await AuthService.resetPassword(req.body);
  clearRefreshTokenCookie(res);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Password reset successful. Please log in with your new password.',
    data,
  });
});

const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  const data = await AuthService.verifyEmail(req.body.token);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Email verified successfully',
    data,
  });
});

export const AuthController = {
  register,
  login,
  google,
  refreshToken,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
};

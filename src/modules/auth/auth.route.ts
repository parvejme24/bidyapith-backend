import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { forgotPasswordLimiter, loginLimiter } from '../../middlewares/rateLimiter';
import { validateRequest } from '../../middlewares/validateRequest';
import { AuthController } from './auth.controller';
import { AuthValidation } from './auth.validation';

const router = Router();

router.post('/register', validateRequest(AuthValidation.register), AuthController.register);

router.post('/login', loginLimiter, validateRequest(AuthValidation.login), AuthController.login);

router.post('/google', validateRequest(AuthValidation.google), AuthController.google);

router.post(
  '/refresh-token',
  validateRequest(AuthValidation.refreshToken),
  AuthController.refreshToken,
);

router.post('/logout', auth, AuthController.logout);

router.post(
  '/change-password',
  auth,
  validateRequest(AuthValidation.changePassword),
  AuthController.changePassword,
);

router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  validateRequest(AuthValidation.forgotPassword),
  AuthController.forgotPassword,
);

router.post(
  '/reset-password',
  validateRequest(AuthValidation.resetPassword),
  AuthController.resetPassword,
);

router.post(
  '/verify-email',
  validateRequest(AuthValidation.verifyEmail),
  AuthController.verifyEmail,
);

export const AuthRoutes = router;

import { Role } from '@prisma/client';
import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { authorize } from '../../middlewares/authorize';
import { uploadAvatar } from '../../middlewares/upload';
import { validateRequest } from '../../middlewares/validateRequest';
import { UserController } from './user.controller';
import { UserValidation } from './user.validation';

const router = Router();

router.get('/me', auth, UserController.getMe);
router.patch('/me', auth, validateRequest(UserValidation.updateMe), UserController.updateMe);
router.post('/me/avatar', auth, uploadAvatar, UserController.uploadAvatar);
router.delete('/me/avatar', auth, UserController.deleteAvatar);

export const UserSelfRoutes = router;

const adminRouter = Router();

adminRouter.post(
  '/',
  auth,
  authorize(Role.ADMIN),
  validateRequest(UserValidation.createStaff),
  UserController.createStaff,
);
adminRouter.get('/', auth, authorize(Role.ADMIN), validateRequest(UserValidation.list), UserController.listUsers);
adminRouter.get(
  '/:id',
  auth,
  authorize(Role.ADMIN),
  validateRequest(UserValidation.idParam),
  UserController.getUserById,
);
adminRouter.patch(
  '/:id/role',
  auth,
  authorize(Role.ADMIN),
  validateRequest(UserValidation.changeRole),
  UserController.changeRole,
);
adminRouter.patch(
  '/:id/status',
  auth,
  authorize(Role.ADMIN),
  validateRequest(UserValidation.changeStatus),
  UserController.changeStatus,
);
adminRouter.delete(
  '/:id',
  auth,
  authorize(Role.ADMIN),
  validateRequest(UserValidation.idParam),
  UserController.softDelete,
);

export const UserAdminRoutes = adminRouter;

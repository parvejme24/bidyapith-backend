import { Role } from '@prisma/client';
import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { authorize } from '../../middlewares/authorize';
import { validateRequest } from '../../middlewares/validateRequest';
import { StudentController } from './student.controller';
import { StudentValidation } from './student.validation';

const router = Router();

router.get('/me', auth, authorize(Role.STUDENT), StudentController.getMe);
router.patch(
  '/me',
  auth,
  authorize(Role.STUDENT),
  validateRequest(StudentValidation.updateMe),
  StudentController.updateMe,
);
router.get(
  '/',
  auth,
  authorize(Role.ADMIN, Role.INSTRUCTOR),
  validateRequest(StudentValidation.list),
  StudentController.list,
);
router.get(
  '/:id',
  auth,
  authorize(Role.ADMIN, Role.INSTRUCTOR),
  validateRequest(StudentValidation.idParam),
  StudentController.getById,
);
router.patch(
  '/:id',
  auth,
  authorize(Role.ADMIN),
  validateRequest(StudentValidation.adminUpdate),
  StudentController.adminUpdate,
);

export const StudentRoutes = router;

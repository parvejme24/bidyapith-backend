import { Role } from '@prisma/client';
import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { authorize } from '../../middlewares/authorize';
import { validateRequest } from '../../middlewares/validateRequest';
import { InstructorController } from './instructor.controller';
import { InstructorValidation } from './instructor.validation';

const router = Router();

router.get('/me', auth, authorize(Role.INSTRUCTOR), InstructorController.getMe);
router.patch(
  '/me',
  auth,
  authorize(Role.INSTRUCTOR),
  validateRequest(InstructorValidation.updateMe),
  InstructorController.updateMe,
);
router.get('/', auth, validateRequest(InstructorValidation.list), InstructorController.list);
router.get('/:id', auth, validateRequest(InstructorValidation.idParam), InstructorController.getById);
router.patch(
  '/:id',
  auth,
  authorize(Role.ADMIN),
  validateRequest(InstructorValidation.adminUpdate),
  InstructorController.adminUpdate,
);

export const InstructorRoutes = router;

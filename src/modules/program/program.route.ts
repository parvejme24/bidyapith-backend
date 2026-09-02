import { Role } from '@prisma/client';
import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { authorize } from '../../middlewares/authorize';
import { validateRequest } from '../../middlewares/validateRequest';
import { ProgramController } from './program.controller';
import { ProgramValidation } from './program.validation';

const router = Router();

router.post(
  '/',
  auth,
  authorize(Role.ADMIN),
  validateRequest(ProgramValidation.create),
  ProgramController.create,
);
router.get('/', auth, validateRequest(ProgramValidation.list), ProgramController.list);
router.get(
  '/:id/curriculum',
  auth,
  validateRequest(ProgramValidation.idParam),
  ProgramController.curriculum,
);
router.post(
  '/:id/courses',
  auth,
  authorize(Role.ADMIN),
  validateRequest(ProgramValidation.addCourse),
  ProgramController.addCourse,
);
router.patch(
  '/:id/courses/:courseId',
  auth,
  authorize(Role.ADMIN),
  validateRequest(ProgramValidation.patchCourse),
  ProgramController.patchCourse,
);
router.delete(
  '/:id/courses/:courseId',
  auth,
  authorize(Role.ADMIN),
  validateRequest(ProgramValidation.courseParam),
  ProgramController.removeCourse,
);
router.get('/:id', auth, validateRequest(ProgramValidation.idParam), ProgramController.getById);
router.patch(
  '/:id',
  auth,
  authorize(Role.ADMIN),
  validateRequest(ProgramValidation.update),
  ProgramController.update,
);
router.delete(
  '/:id',
  auth,
  authorize(Role.ADMIN),
  validateRequest(ProgramValidation.idParam),
  ProgramController.remove,
);

export const ProgramRoutes = router;

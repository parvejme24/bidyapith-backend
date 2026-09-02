import { Role } from '@prisma/client';
import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { authorize } from '../../middlewares/authorize';
import { validateRequest } from '../../middlewares/validateRequest';
import { DepartmentController } from './department.controller';
import { DepartmentValidation } from './department.validation';

const router = Router();

router.post(
  '/',
  auth,
  authorize(Role.ADMIN),
  validateRequest(DepartmentValidation.create),
  DepartmentController.create,
);
router.get('/', auth, validateRequest(DepartmentValidation.list), DepartmentController.list);
router.get(
  '/:id',
  auth,
  validateRequest(DepartmentValidation.idParam),
  DepartmentController.getById,
);
router.patch(
  '/:id',
  auth,
  authorize(Role.ADMIN),
  validateRequest(DepartmentValidation.update),
  DepartmentController.update,
);
router.delete(
  '/:id',
  auth,
  authorize(Role.ADMIN),
  validateRequest(DepartmentValidation.idParam),
  DepartmentController.remove,
);

export const DepartmentRoutes = router;

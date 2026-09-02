import { Role } from '@prisma/client';
import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { authorize } from '../../middlewares/authorize';
import { validateRequest } from '../../middlewares/validateRequest';
import { OfferingController } from './offering.controller';
import { OfferingValidation } from './offering.validation';

const router = Router();

router.post(
  '/',
  auth,
  authorize(Role.ADMIN),
  validateRequest(OfferingValidation.create),
  OfferingController.create,
);
router.get('/', auth, validateRequest(OfferingValidation.list), OfferingController.list);
router.get(
  '/my-teaching',
  auth,
  authorize(Role.INSTRUCTOR),
  validateRequest(OfferingValidation.myTeaching),
  OfferingController.listMyTeaching,
);
router.get('/:id', auth, validateRequest(OfferingValidation.idParam), OfferingController.getById);
router.patch(
  '/:id/instructor',
  auth,
  authorize(Role.ADMIN),
  validateRequest(OfferingValidation.assignInstructor),
  OfferingController.assignInstructor,
);
router.patch(
  '/:id/status',
  auth,
  authorize(Role.ADMIN),
  validateRequest(OfferingValidation.changeStatus),
  OfferingController.changeStatus,
);
router.patch(
  '/:id',
  auth,
  authorize(Role.ADMIN),
  validateRequest(OfferingValidation.update),
  OfferingController.update,
);
router.post(
  '/:id/schedules',
  auth,
  authorize(Role.ADMIN),
  validateRequest(OfferingValidation.addSchedule),
  OfferingController.addSchedule,
);
router.delete(
  '/:id/schedules/:scheduleId',
  auth,
  authorize(Role.ADMIN),
  validateRequest(OfferingValidation.scheduleParam),
  OfferingController.removeSchedule,
);
router.delete(
  '/:id',
  auth,
  authorize(Role.ADMIN),
  validateRequest(OfferingValidation.idParam),
  OfferingController.remove,
);

export const OfferingRoutes = router;

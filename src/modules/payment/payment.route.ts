import { Role } from '@prisma/client';
import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { authorize } from '../../middlewares/authorize';
import { ownership } from '../../middlewares/ownership';
import { validateRequest } from '../../middlewares/validateRequest';
import { PaymentController } from './payment.controller';
import { PaymentValidation } from './payment.validation';

const router = Router();

router.post(
  '/initiate',
  auth,
  authorize(Role.STUDENT),
  validateRequest(PaymentValidation.initiate),
  PaymentController.initiate,
);
router.get(
  '/verify/:transactionRef',
  auth,
  authorize(Role.STUDENT),
  validateRequest(PaymentValidation.verify),
  PaymentController.verify,
);
router.get(
  '/my-history',
  auth,
  authorize(Role.STUDENT),
  validateRequest(PaymentValidation.myHistory),
  PaymentController.listMine,
);
router.get(
  '/',
  auth,
  authorize(Role.ADMIN),
  validateRequest(PaymentValidation.list),
  PaymentController.listAll,
);
router.post(
  '/:id/refund',
  auth,
  authorize(Role.ADMIN),
  validateRequest(PaymentValidation.refund),
  PaymentController.refund,
);
router.get(
  '/:id',
  auth,
  authorize(Role.STUDENT, Role.ADMIN),
  validateRequest(PaymentValidation.idParam),
  ownership('payment'),
  PaymentController.getById,
);

export const PaymentRoutes = router;

import { Role } from '@prisma/client';
import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { authorize } from '../../middlewares/authorize';
import { NotificationController } from './notification.controller';

const router = Router();

router.get('/public', NotificationController.getPublicNotices);
router.get('/my', auth, NotificationController.getMyNotifications);
router.get('/', auth, NotificationController.getMyNotifications);
router.post('/broadcast', auth, authorize(Role.ADMIN), NotificationController.createBroadcast);
router.patch('/read-all', auth, NotificationController.markAllAsRead);
router.patch('/:id/read', auth, NotificationController.markAsRead);

export const NotificationRoutes = router;

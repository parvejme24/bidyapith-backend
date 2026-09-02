import { Router } from 'express';
import { AuthRoutes } from '../modules/auth/auth.route';
import { InstructorRoutes } from '../modules/instructor/instructor.route';
import { StudentRoutes } from '../modules/student/student.route';
import { UserAdminRoutes, UserSelfRoutes } from '../modules/user/user.route';

const router = Router();

router.use('/auth', AuthRoutes);
router.use('/users', UserSelfRoutes);
router.use('/admin/users', UserAdminRoutes);
router.use('/students', StudentRoutes);
router.use('/instructors', InstructorRoutes);

export const AppRoutes = router;

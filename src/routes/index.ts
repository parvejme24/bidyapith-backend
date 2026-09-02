import { Router } from 'express';
import {
  OfferingAttendanceRoutes,
  StudentAttendanceRoutes,
} from '../modules/attendance/attendance.route';
import { AuthRoutes } from '../modules/auth/auth.route';
import { CourseRoutes } from '../modules/course/course.route';
import { DepartmentRoutes } from '../modules/department/department.route';
import { InstructorRoutes } from '../modules/instructor/instructor.route';
import { OfferingRoutes } from '../modules/offering/offering.route';
import { PrerequisiteRoutes } from '../modules/prerequisite/prerequisite.route';
import { ProgramRoutes } from '../modules/program/program.route';
import { SemesterRoutes } from '../modules/semester/semester.route';
import { StudentRoutes } from '../modules/student/student.route';
import { UserAdminRoutes, UserSelfRoutes } from '../modules/user/user.route';

const router = Router();

router.use('/auth', AuthRoutes);
router.use('/users', UserSelfRoutes);
router.use('/admin/users', UserAdminRoutes);
router.use('/students', StudentAttendanceRoutes);
router.use('/students', StudentRoutes);
router.use('/instructors', InstructorRoutes);
router.use('/departments', DepartmentRoutes);
router.use('/programs', ProgramRoutes);
router.use('/courses', PrerequisiteRoutes);
router.use('/courses', CourseRoutes);
router.use('/semesters', SemesterRoutes);
router.use('/offerings', OfferingAttendanceRoutes);
router.use('/offerings', OfferingRoutes);

export const AppRoutes = router;

import { OfferingStatus } from '@prisma/client';

export const OFFERING_SORT_FIELDS = ['createdAt', 'updatedAt', 'section', 'status'] as const;

export const OFFERING_TRANSITIONS: Record<OfferingStatus, readonly OfferingStatus[]> = {
  DRAFT: [OfferingStatus.OPEN, OfferingStatus.CANCELLED],
  OPEN: [OfferingStatus.CLOSED, OfferingStatus.CANCELLED],
  CLOSED: [OfferingStatus.COMPLETED, OfferingStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

export const isLegalOfferingTransition = (from: OfferingStatus, to: OfferingStatus): boolean =>
  OFFERING_TRANSITIONS[from].includes(to);

export const COURSE_REF_SELECT = {
  id: true,
  code: true,
  title: true,
  credits: true,
} as const;

export const INSTRUCTOR_REF_SELECT = {
  id: true,
  employeeId: true,
  designation: true,
  user: {
    select: {
      firstName: true,
      lastName: true,
    },
  },
} as const;

export const SCHEDULE_SELECT = {
  id: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  room: true,
} as const;

export const OFFERING_SELECT = {
  id: true,
  courseId: true,
  semesterId: true,
  instructorId: true,
  section: true,
  capacity: true,
  enrolledCount: true,
  status: true,
  room: true,
  createdAt: true,
  updatedAt: true,
  course: { select: COURSE_REF_SELECT },
  instructor: { select: INSTRUCTOR_REF_SELECT },
} as const;

export const OFFERING_DETAIL_SELECT = {
  ...OFFERING_SELECT,
  semester: {
    select: {
      id: true,
      name: true,
      status: true,
    },
  },
  schedules: {
    select: SCHEDULE_SELECT,
    orderBy: [{ dayOfWeek: 'asc' as const }, { startTime: 'asc' as const }],
  },
};

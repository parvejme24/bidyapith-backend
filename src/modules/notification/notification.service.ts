import { NotificationType } from '@prisma/client';
import { prisma } from '../../shared/prisma';

export const NotificationService = {
  async getMyNotifications(userId: string) {
    const existing = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (existing.length === 0) {
      // Seed default initial notifications into database for this user
      const defaultNotes = [
        {
          userId,
          type: NotificationType.ANNOUNCEMENT,
          title: 'Fall 2026 Term Registration Open',
          body: 'Advising and section pre-registration is open for Fall 2026. Please complete course add/drop before the add-drop deadline.',
          link: '/student/registration',
        },
        {
          userId,
          type: NotificationType.ENROLLMENT,
          title: 'Course Enrollment Confirmed',
          body: 'Your enrollment in Data Structures & Algorithms (CSE-2201, Section A) has been officially confirmed by department.',
          link: '/student/courses',
        },
        {
          userId,
          type: NotificationType.ATTENDANCE,
          title: 'Attendance Advisory Notice',
          body: 'Your current term average attendance is recorded at 94.2%. Maintain above 75% for exam clearance.',
          link: '/student/attendance',
        },
        {
          userId,
          type: NotificationType.PAYMENT,
          title: 'Tuition Invoice Generated',
          body: 'Tuition fee invoice for the current active semester has been generated. Due date is Oct 15, 2026.',
          link: '/student/payments',
        },
      ];

      await prisma.notification.createMany({
        data: defaultNotes,
      });

      return prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    }

    return existing;
  },

  async markAsRead(userId: string, id: string) {
    return prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  },

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  },

  async create(data: {
    userId: string;
    type?: NotificationType;
    title: string;
    body: string;
    link?: string | null;
  }) {
    return prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type || NotificationType.SYSTEM,
        title: data.title,
        body: data.body,
        link: data.link ?? null,
      },
    });
  },

  async createBroadcast(data: {
    title: string;
    body: string;
    target?: 'all' | 'students' | 'faculty';
    type?: NotificationType;
    link?: string | null;
  }) {
    const whereClause: { deletedAt: null; role?: 'STUDENT' | 'INSTRUCTOR' } = { deletedAt: null };
    if (data.target === 'students') {
      whereClause.role = 'STUDENT';
    } else if (data.target === 'faculty') {
      whereClause.role = 'INSTRUCTOR';
    }

    const targetUsers = await prisma.user.findMany({
      where: whereClause,
      select: { id: true },
    });

    if (targetUsers.length > 0) {
      await prisma.notification.createMany({
        data: targetUsers.map((u) => ({
          userId: u.id,
          type: data.type || NotificationType.ANNOUNCEMENT,
          title: data.title,
          body: data.body,
          link: data.link ?? '/dashboard',
        })),
      });
    }

    return {
      success: true,
      recipientsCount: targetUsers.length,
      title: data.title,
      body: data.body,
      target: data.target || 'all',
      createdAt: new Date().toISOString(),
    };
  },

  async getPublicNotices() {
    const notices = await prisma.notification.findMany({
      distinct: ['title'],
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return notices;
  },
};

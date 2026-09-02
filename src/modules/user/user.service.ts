import { randomBytes } from 'crypto';
import {
  AuditAction,
  EnrollmentStatus,
  Prisma,
  Role,
  SemesterStatus,
  UserStatus,
} from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { cloudinary } from '../../config/cloudinary';
import { config } from '../../config';
import { ApiError } from '../../shared/ApiError';
import { paginate, paginationMeta } from '../../shared/paginate';
import { prisma } from '../../shared/prisma';
import { buildWhere } from '../../shared/queryBuilder';
import { findUserIdsByNameEmail } from '../../shared/search';
import { createAuditLog } from '../../utils/auditLog';
import { generateEmployeeId } from '../../utils/generateId';
import { hashPassword } from '../../utils/password';
import { sendEmail } from '../../utils/sendEmail';
import {
  INSTRUCTOR_PROFILE_SELECT,
  STUDENT_PROFILE_SELECT,
  USER_PUBLIC_SELECT,
  USER_SORT_FIELDS,
} from './user.constant';
import type { AdminUserListQuery, CreateStaffInput, UpdateMeInput } from './user.interface';

const userWithProfileSelect = {
  ...USER_PUBLIC_SELECT,
  studentProfile: { select: STUDENT_PROFILE_SELECT },
  instructorProfile: { select: INSTRUCTOR_PROFILE_SELECT },
} as const;

const identitySelect = {
  id: true,
  role: true,
  status: true,
  studentProfile: { select: { id: true } },
  instructorProfile: { select: { id: true } },
} as const;

const generateTemporaryPassword = (): string => `${randomBytes(9).toString('base64url')}Aa1`;

const publicIdFromAvatarUrl = (url: string): string | null => {
  const marker = '/upload/';
  const index = url.indexOf(marker);
  if (index === -1) {
    return null;
  }
  let rest = url.slice(index + marker.length).replace(/^v\d+\//, '');
  rest = rest.replace(/\.[a-zA-Z0-9]+(?:\?.*)?$/, '');
  return rest.length > 0 ? rest : null;
};

const uploadToCloudinary = async (buffer: Buffer): Promise<string> => {
  if (
    config.CLOUDINARY_CLOUD_NAME.length === 0 ||
    config.CLOUDINARY_API_KEY.length === 0 ||
    config.CLOUDINARY_API_SECRET.length === 0
  ) {
    throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, 'Cloudinary is not configured');
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'bidyapith/avatars', resource_type: 'image' },
      (error, result) => {
        if (error != null || result === undefined) {
          reject(error ?? new Error('Cloudinary upload failed'));
          return;
        }
        resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });
};

const destroyCloudinaryAsset = async (url: string): Promise<void> => {
  const publicId = publicIdFromAvatarUrl(url);
  if (publicId === null) {
    return;
  }
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('[cloudinary] Failed to delete previous avatar', error);
  }
};

const requireUser = async (id: string) => {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: userWithProfileSelect,
  });
  if (user === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }
  return user;
};

const getMe = async (userId: string) => requireUser(userId);

const updateMe = async (userId: string, input: UpdateMeInput) => {
  await requireUser(userId);
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
    },
    select: userWithProfileSelect,
  });
};

const uploadAvatar = async (userId: string, file: Express.Multer.File) => {
  const user = await requireUser(userId);
  const previousUrl = user.avatarUrl;
  const secureUrl = await uploadToCloudinary(file.buffer);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: secureUrl },
    select: userWithProfileSelect,
  });
  if (previousUrl !== null) {
    await destroyCloudinaryAsset(previousUrl);
  }
  return updated;
};

const deleteAvatar = async (userId: string) => {
  const user = await requireUser(userId);
  if (user.avatarUrl !== null) {
    await destroyCloudinaryAsset(user.avatarUrl);
  }
  return prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: null },
    select: userWithProfileSelect,
  });
};

const createStaff = async (actorId: string, input: CreateStaffInput) => {
  if (input.role === Role.STUDENT) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Students must self-register through /auth/register');
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const year = new Date().getFullYear();

  try {
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          password: passwordHash,
          role: input.role,
          status: UserStatus.ACTIVE,
          emailVerified: true,
          passwordChangedAt: null,
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
        },
        select: USER_PUBLIC_SELECT,
      });

      if (input.role === Role.INSTRUCTOR) {
        if (
          input.departmentId === undefined ||
          input.designation === undefined ||
          input.joiningDate === undefined
        ) {
          throw new ApiError(StatusCodes.BAD_REQUEST, 'Instructor department, designation and joining date are required');
        }

        const department = await tx.department.findFirst({
          where: { id: input.departmentId, deletedAt: null },
        });
        if (department === null) {
          throw new ApiError(StatusCodes.NOT_FOUND, 'Department not found');
        }

        const employeeId = await generateEmployeeId(tx, year);
        await tx.instructorProfile.create({
          data: {
            userId: user.id,
            employeeId,
            departmentId: department.id,
            designation: input.designation,
            joiningDate: new Date(input.joiningDate),
            ...(input.specialization !== undefined ? { specialization: input.specialization } : {}),
          },
        });
      }

      await createAuditLog(tx, {
        actorId,
        action: AuditAction.CREATE,
        entity: 'User',
        entityId: user.id,
        after: { role: user.role, email: user.email },
      });

      return tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: userWithProfileSelect,
      });
    });

    await sendEmail({
      to: created.email,
      subject: 'Your Bidyapith account',
      template: 'accountCreated',
      data: {
        firstName: created.firstName,
        email: created.email,
        role: created.role,
        temporaryPassword,
      },
    });

    return { user: created, temporaryPassword };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ApiError(StatusCodes.CONFLICT, 'An account with this email already exists');
    }
    throw error;
  }
};

const listUsers = async (query: AdminUserListQuery) => {
  const pagination = paginate(query, USER_SORT_FIELDS);
  const searchTerm = query.search?.trim();
  let matchedIds: string[] | undefined;
  if (searchTerm !== undefined && searchTerm.length > 0) {
    matchedIds = await findUserIdsByNameEmail(searchTerm);
    if (matchedIds.length === 0) {
      return { data: [], meta: paginationMeta(pagination.page, pagination.limit, 0) };
    }
  }

  const where = buildWhere({
    searchFields: [],
    filters: {
      ...(query.role !== undefined ? { role: query.role } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
    },
    extra: matchedIds !== undefined ? [{ id: { in: matchedIds } }] : [],
  }) as Prisma.UserWhereInput;

  const [data, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: userWithProfileSelect,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: pagination.orderBy,
    }),
    prisma.user.count({ where }),
  ]);

  return { data, meta: paginationMeta(pagination.page, pagination.limit, total) };
};

const getUserById = async (id: string) => requireUser(id);

const changeRole = async (actorId: string, targetId: string, nextRole: Role) => {
  if (actorId === targetId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You cannot change your own role');
  }

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findFirst({
      where: { id: targetId, deletedAt: null },
      select: identitySelect,
    });
    if (target === null) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
    }

    if (target.role === nextRole) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'User already has this role');
    }

    const swappingIdentity =
      (target.role === Role.STUDENT && nextRole === Role.INSTRUCTOR) ||
      (target.role === Role.INSTRUCTOR && nextRole === Role.STUDENT);
    if (swappingIdentity) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Student and instructor profiles are not interchangeable. Only promotion to ADMIN or demotion from ADMIN is allowed.',
      );
    }

    const promotingToAdmin = nextRole === Role.ADMIN;
    const demotingFromAdmin = target.role === Role.ADMIN;
    if (!promotingToAdmin && !demotingFromAdmin) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Only promotion to ADMIN or demotion from ADMIN is allowed.',
      );
    }

    if (demotingFromAdmin && target.status === UserStatus.ACTIVE) {
      const activeAdmins = await tx.user.count({
        where: { role: Role.ADMIN, status: UserStatus.ACTIVE, deletedAt: null },
      });
      if (activeAdmins <= 1) {
        throw new ApiError(
          StatusCodes.CONFLICT,
          'Cannot demote the last remaining active admin.',
        );
      }
    }

    if (nextRole === Role.STUDENT && target.studentProfile === null) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'This account has no student profile and cannot be demoted to STUDENT.',
      );
    }
    if (nextRole === Role.INSTRUCTOR && target.instructorProfile === null) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'This account has no instructor profile and cannot be demoted to INSTRUCTOR.',
      );
    }

    const updated = await tx.user.update({
      where: { id: targetId },
      data: { role: nextRole },
      select: userWithProfileSelect,
    });

    await createAuditLog(tx, {
      actorId,
      action: AuditAction.ROLE_CHANGE,
      entity: 'User',
      entityId: targetId,
      before: { role: target.role },
      after: { role: nextRole },
    });

    return updated;
  });
};

const changeStatus = async (actorId: string, targetId: string, nextStatus: UserStatus) => {
  if (actorId === targetId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You cannot change your own status');
  }

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findFirst({
      where: { id: targetId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (target === null) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
    }

    const updated = await tx.user.update({
      where: { id: targetId },
      data: { status: nextStatus },
      select: userWithProfileSelect,
    });

    if (nextStatus === UserStatus.BLOCKED) {
      await tx.refreshToken.updateMany({
        where: { userId: targetId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await createAuditLog(tx, {
      actorId,
      action: AuditAction.STATUS_CHANGE,
      entity: 'User',
      entityId: targetId,
      before: { status: target.status },
      after: { status: nextStatus },
    });

    return updated;
  });
};

const softDeleteUser = async (actorId: string, targetId: string) => {
  if (actorId === targetId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You cannot delete your own account');
  }

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findFirst({
      where: { id: targetId, deletedAt: null },
      select: identitySelect,
    });
    if (target === null) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
    }

    if (target.role === Role.ADMIN && target.status === UserStatus.ACTIVE) {
      const activeAdmins = await tx.user.count({
        where: { role: Role.ADMIN, status: UserStatus.ACTIVE, deletedAt: null },
      });
      if (activeAdmins <= 1) {
        throw new ApiError(StatusCodes.CONFLICT, 'Cannot delete the last remaining active admin.');
      }
    }

    if (target.studentProfile !== null) {
      const liveEnrollments = await tx.enrollment.count({
        where: { studentId: target.studentProfile.id, status: EnrollmentStatus.ENROLLED },
      });
      if (liveEnrollments > 0) {
        throw new ApiError(
          StatusCodes.CONFLICT,
          `This student has ${liveEnrollments} enrollment(s) with status ENROLLED. Complete or drop them before deleting the account.`,
        );
      }
    }

    if (target.instructorProfile !== null) {
      const liveOfferings = await tx.courseOffering.count({
        where: {
          instructorId: target.instructorProfile.id,
          deletedAt: null,
          semester: { status: { not: SemesterStatus.COMPLETED }, deletedAt: null },
        },
      });
      if (liveOfferings > 0) {
        throw new ApiError(
          StatusCodes.CONFLICT,
          `This instructor is assigned to ${liveOfferings} offering(s) in a semester that is not COMPLETED.`,
        );
      }
    }

    const now = new Date();
    const updated = await tx.user.update({
      where: { id: targetId },
      data: { deletedAt: now, status: UserStatus.BLOCKED },
      select: USER_PUBLIC_SELECT,
    });

    await tx.refreshToken.updateMany({
      where: { userId: targetId, revokedAt: null },
      data: { revokedAt: now },
    });

    await createAuditLog(tx, {
      actorId,
      action: AuditAction.DELETE,
      entity: 'User',
      entityId: targetId,
      after: { deletedAt: now.toISOString() },
    });

    return updated;
  });
};

export const UserService = {
  getMe,
  updateMe,
  uploadAvatar,
  deleteAvatar,
  createStaff,
  listUsers,
  getUserById,
  changeRole,
  changeStatus,
  softDeleteUser,
};

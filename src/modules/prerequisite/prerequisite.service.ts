import { AuditAction, type CourseType, Prisma } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../shared/ApiError';
import { prisma } from '../../shared/prisma';
import { createAuditLog } from '../../utils/auditLog';
import {
  collectTree,
  type Edges,
  exceedsMaxChainDepth,
  MAX_PREREQ_DEPTH,
  type PrereqNode,
  withProposedEdge,
  wouldCreateCycle,
} from '../../utils/prerequisiteGraph';
import { COURSE_SUMMARY_SELECT } from './prerequisite.constant';
import type { IPrerequisiteCreate } from './prerequisite.interface';

type CourseSummary = {
  id: string;
  code: string;
  title: string;
  credits: Prisma.Decimal;
  type: CourseType;
  level: number;
  departmentId: string;
};

const gradeKey = (courseId: string, prerequisiteId: string): string =>
  `${courseId}:${prerequisiteId}`;

const serializeCourse = (course: CourseSummary) => ({
  id: course.id,
  code: course.code,
  title: course.title,
  credits: course.credits.toFixed(1),
  type: course.type,
  level: course.level,
  departmentId: course.departmentId,
});

const uniqueField = (error: unknown): string | null => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return null;
  }
  return 'edge';
};

const loadGraph = async (db: Prisma.TransactionClient | typeof prisma) => {
  const rows = await db.coursePrerequisite.findMany({
    where: {
      course: { deletedAt: null },
      prerequisite: { deletedAt: null },
    },
    select: {
      courseId: true,
      prerequisiteId: true,
      minGradePoint: true,
      course: { select: COURSE_SUMMARY_SELECT },
      prerequisite: { select: COURSE_SUMMARY_SELECT },
    },
  });

  const edges: Edges = new Map();
  const courses = new Map<string, CourseSummary>();
  const grades = new Map<string, string>();

  for (const row of rows) {
    const current = edges.get(row.courseId) ?? [];
    current.push(row.prerequisiteId);
    edges.set(row.courseId, current);
    courses.set(row.course.id, row.course);
    courses.set(row.prerequisite.id, row.prerequisite);
    grades.set(gradeKey(row.courseId, row.prerequisiteId), row.minGradePoint.toFixed(2));
  }

  return { edges, courses, grades };
};

const hydrateTree = (
  parentId: string,
  nodes: PrereqNode[],
  courses: Map<string, CourseSummary>,
  grades: Map<string, string>,
): unknown[] =>
  nodes.map((node) => {
    const course = courses.get(node.courseId);
    return {
      ...(course !== undefined
        ? serializeCourse(course)
        : { id: node.courseId, code: node.courseId }),
      minGradePoint: grades.get(gradeKey(parentId, node.courseId)) ?? '2.00',
      prerequisites: hydrateTree(node.courseId, node.prerequisites, courses, grades),
    };
  });

const requireLiveCourse = async (
  db: Prisma.TransactionClient | typeof prisma,
  id: string,
): Promise<CourseSummary> => {
  const course = await db.course.findFirst({
    where: { id, deletedAt: null },
    select: COURSE_SUMMARY_SELECT,
  });
  if (course === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Course not found');
  }
  return course;
};

const getTree = async (courseId: string) => {
  const course = await requireLiveCourse(prisma, courseId);
  const { edges, courses, grades } = await loadGraph(prisma);
  const tree = collectTree(edges, courseId, MAX_PREREQ_DEPTH);
  return {
    course: serializeCourse(course),
    prerequisites: hydrateTree(courseId, tree, courses, grades),
  };
};

const getDependents = async (courseId: string) => {
  await requireLiveCourse(prisma, courseId);
  const { edges, courses, grades } = await loadGraph(prisma);
  const dependents: unknown[] = [];
  for (const [from, tos] of edges) {
    if (!tos.includes(courseId)) {
      continue;
    }
    const course = courses.get(from);
    if (course === undefined) {
      continue;
    }
    dependents.push({
      ...serializeCourse(course),
      minGradePoint: grades.get(gradeKey(from, courseId)) ?? '2.00',
    });
  }
  return dependents;
};

const create = async (actorId: string, courseId: string, input: IPrerequisiteCreate) => {
  if (courseId === input.prerequisiteId) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'A course cannot be its own prerequisite');
  }

  try {
    const created = await prisma.$transaction(
      async (tx) => {
        const course = await requireLiveCourse(tx, courseId);
        const prerequisite = await requireLiveCourse(tx, input.prerequisiteId);
        const { edges, courses } = await loadGraph(tx);
        courses.set(course.id, course);
        courses.set(prerequisite.id, prerequisite);

        const existing = edges.get(courseId) ?? [];
        if (existing.includes(input.prerequisiteId)) {
          throw new ApiError(
            StatusCodes.CONFLICT,
            'This prerequisite is already attached to the course',
          );
        }

        const cycle = wouldCreateCycle(edges, courseId, input.prerequisiteId);
        if (cycle !== null) {
          const named = cycle.map((id) => courses.get(id)?.code ?? id).join(' → ');
          throw new ApiError(
            StatusCodes.CONFLICT,
            `Adding this prerequisite would create a cycle: ${named}`,
          );
        }

        const proposed = withProposedEdge(edges, courseId, input.prerequisiteId);
        if (exceedsMaxChainDepth(proposed, MAX_PREREQ_DEPTH)) {
          throw new ApiError(
            StatusCodes.BAD_REQUEST,
            `Prerequisite chain cannot exceed ${MAX_PREREQ_DEPTH} courses`,
          );
        }

        const row = await tx.coursePrerequisite.create({
          data: {
            courseId,
            prerequisiteId: input.prerequisiteId,
            ...(input.minGradePoint !== undefined
              ? { minGradePoint: new Prisma.Decimal(input.minGradePoint) }
              : {}),
          },
          select: {
            id: true,
            minGradePoint: true,
            course: { select: COURSE_SUMMARY_SELECT },
            prerequisite: { select: COURSE_SUMMARY_SELECT },
          },
        });

        await createAuditLog(tx, {
          actorId,
          action: AuditAction.CREATE,
          entity: 'CoursePrerequisite',
          entityId: courseId,
          after: { prerequisiteId: input.prerequisiteId },
        });

        return row;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return {
      minGradePoint: created.minGradePoint.toFixed(2),
      course: serializeCourse(created.course),
      prerequisite: serializeCourse(created.prerequisite),
    };
  } catch (error) {
    if (uniqueField(error) !== null) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        'This prerequisite is already attached to the course',
      );
    }
    throw error;
  }
};

const remove = async (actorId: string, courseId: string, prerequisiteId: string) => {
  await requireLiveCourse(prisma, courseId);
  const existing = await prisma.coursePrerequisite.findUnique({
    where: { courseId_prerequisiteId: { courseId, prerequisiteId } },
    select: { id: true },
  });
  if (existing === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Prerequisite edge not found');
  }

  await prisma.$transaction(async (tx) => {
    await tx.coursePrerequisite.delete({
      where: { courseId_prerequisiteId: { courseId, prerequisiteId } },
    });
    await createAuditLog(tx, {
      actorId,
      action: AuditAction.DELETE,
      entity: 'CoursePrerequisite',
      entityId: courseId,
      after: { prerequisiteId },
    });
  });

  return null;
};

export const PrerequisiteService = {
  getTree,
  getDependents,
  create,
  remove,
};

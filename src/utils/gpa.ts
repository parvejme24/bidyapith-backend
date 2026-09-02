import { type LetterGrade, Prisma } from '@prisma/client';
import { GPA_SCALE, ROUND_GPA } from '../constants/grade';
import { countsTowardGpa, earnsCredits } from './gradeScale';

export type GradedCourse = {
  courseId: string;
  credits: Prisma.Decimal;
  letter: LetterGrade;
  point: Prisma.Decimal;
};

export type SemesterGpa = {
  gpa: Prisma.Decimal;
  creditsAttempted: Prisma.Decimal;
  creditsEarned: Prisma.Decimal;
};

export type CumulativeGpa = {
  cgpa: Prisma.Decimal;
  creditsEarned: Prisma.Decimal;
};

const zero = (): Prisma.Decimal => new Prisma.Decimal(0);

export const roundGpa = (value: Prisma.Decimal): Prisma.Decimal =>
  value.toDecimalPlaces(GPA_SCALE, ROUND_GPA);

export const semesterGpa = (courses: GradedCourse[]): SemesterGpa => {
  let quality = zero();
  let attempted = zero();
  let earned = zero();

  for (const course of courses) {
    if (countsTowardGpa(course.letter)) {
      quality = quality.add(course.point.mul(course.credits));
      attempted = attempted.add(course.credits);
    }
    if (earnsCredits(course.letter)) {
      earned = earned.add(course.credits);
    }
  }

  return {
    gpa: attempted.isZero() ? zero() : roundGpa(quality.div(attempted)),
    creditsAttempted: attempted,
    creditsEarned: earned,
  };
};

export const bestAttempts = (courses: GradedCourse[]): GradedCourse[] => {
  const winners = new Map<string, GradedCourse>();
  for (const course of courses) {
    if (!countsTowardGpa(course.letter)) {
      continue;
    }
    const current = winners.get(course.courseId);
    if (current === undefined || course.point.gt(current.point)) {
      winners.set(course.courseId, course);
    }
  }
  return [...winners.values()];
};

export const cumulativeGpa = (allCourses: GradedCourse[]): CumulativeGpa => {
  const unique = bestAttempts(allCourses);
  const semester = semesterGpa(unique);
  return {
    cgpa: semester.gpa,
    creditsEarned: semester.creditsEarned,
  };
};

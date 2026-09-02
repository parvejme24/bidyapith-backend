import { LetterGrade, Prisma } from '@prisma/client';
import { GRADE_SCALE } from '../constants/grade';

export const marksToGrade = (
  marks: Prisma.Decimal | number | string,
): { letter: LetterGrade; point: Prisma.Decimal } => {
  const value = new Prisma.Decimal(marks);
  for (const band of GRADE_SCALE) {
    if (value.gte(band.minMarks)) {
      return { letter: band.letter, point: band.point };
    }
  }
  const failing = GRADE_SCALE[GRADE_SCALE.length - 1];
  return { letter: LetterGrade.F, point: failing?.point ?? new Prisma.Decimal(0) };
};

export const gradeToPoint = (letter: LetterGrade): Prisma.Decimal | null => {
  if (letter === LetterGrade.I || letter === LetterGrade.W) {
    return null;
  }
  const band = GRADE_SCALE.find((row) => row.letter === letter);
  return band?.point ?? new Prisma.Decimal(0);
};

export const countsTowardGpa = (letter: LetterGrade): boolean =>
  letter !== LetterGrade.I && letter !== LetterGrade.W;

export const earnsCredits = (letter: LetterGrade): boolean =>
  countsTowardGpa(letter) && letter !== LetterGrade.F;

import { LetterGrade, Prisma } from '@prisma/client';

export type IGradeBand = {
  minMarks: Prisma.Decimal;
  letter: LetterGrade;
  point: Prisma.Decimal;
};

export const GRADE_SCALE: readonly IGradeBand[] = [
  {
    minMarks: new Prisma.Decimal('80'),
    letter: LetterGrade.A_PLUS,
    point: new Prisma.Decimal('4.00'),
  },
  { minMarks: new Prisma.Decimal('75'), letter: LetterGrade.A, point: new Prisma.Decimal('3.75') },
  {
    minMarks: new Prisma.Decimal('70'),
    letter: LetterGrade.A_MINUS,
    point: new Prisma.Decimal('3.50'),
  },
  {
    minMarks: new Prisma.Decimal('65'),
    letter: LetterGrade.B_PLUS,
    point: new Prisma.Decimal('3.25'),
  },
  { minMarks: new Prisma.Decimal('60'), letter: LetterGrade.B, point: new Prisma.Decimal('3.00') },
  {
    minMarks: new Prisma.Decimal('55'),
    letter: LetterGrade.B_MINUS,
    point: new Prisma.Decimal('2.75'),
  },
  {
    minMarks: new Prisma.Decimal('50'),
    letter: LetterGrade.C_PLUS,
    point: new Prisma.Decimal('2.50'),
  },
  { minMarks: new Prisma.Decimal('45'), letter: LetterGrade.C, point: new Prisma.Decimal('2.25') },
  { minMarks: new Prisma.Decimal('40'), letter: LetterGrade.D, point: new Prisma.Decimal('2.00') },
  { minMarks: new Prisma.Decimal('0'), letter: LetterGrade.F, point: new Prisma.Decimal('0.00') },
];

export const ROUND_GPA = Prisma.Decimal.ROUND_HALF_UP;
export const GPA_SCALE = 2;

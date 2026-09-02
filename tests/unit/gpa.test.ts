import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LetterGrade, Prisma } from '@prisma/client';
import { cumulativeGpa, type GradedCourse, semesterGpa } from '../../src/utils/gpa';
import {
  countsTowardGpa,
  earnsCredits,
  gradeToPoint,
  marksToGrade,
} from '../../src/utils/gradeScale';

const d = (value: string | number) => new Prisma.Decimal(value);

const course = (courseId: string, credits: string, letter: LetterGrade): GradedCourse => ({
  courseId,
  credits: d(credits),
  letter,
  point: gradeToPoint(letter) ?? d(0),
});

describe('gradeScale', () => {
  it('maps UGC mark bands', () => {
    assert.equal(marksToGrade(80).letter, LetterGrade.A_PLUS);
    assert.equal(marksToGrade(100).letter, LetterGrade.A_PLUS);
    assert.equal(marksToGrade(79).letter, LetterGrade.A);
    assert.equal(marksToGrade(75).letter, LetterGrade.A);
    assert.equal(marksToGrade(40).letter, LetterGrade.D);
    assert.equal(marksToGrade(39.99).letter, LetterGrade.F);
    assert.equal(marksToGrade(0).letter, LetterGrade.F);
  });

  it('returns 4.00 for A+ and null for I/W', () => {
    assert.equal(gradeToPoint(LetterGrade.A_PLUS)?.toFixed(2), '4.00');
    assert.equal(gradeToPoint(LetterGrade.I), null);
    assert.equal(gradeToPoint(LetterGrade.W), null);
  });

  it('treats F as attempted but not earned, and I/W as neither', () => {
    assert.equal(countsTowardGpa(LetterGrade.F), true);
    assert.equal(earnsCredits(LetterGrade.F), false);
    assert.equal(countsTowardGpa(LetterGrade.I), false);
    assert.equal(countsTowardGpa(LetterGrade.W), false);
    assert.equal(earnsCredits(LetterGrade.I), false);
    assert.equal(earnsCredits(LetterGrade.W), false);
  });
});

describe('semesterGpa', () => {
  it('computes a clean semester', () => {
    const result = semesterGpa([
      course('c1', '3.0', LetterGrade.A_PLUS),
      course('c2', '3.0', LetterGrade.B),
      course('c3', '1.5', LetterGrade.A),
    ]);
    assert.equal(result.creditsAttempted.toFixed(1), '7.5');
    assert.equal(result.creditsEarned.toFixed(1), '7.5');
    assert.equal(result.gpa.toFixed(2), '3.55');
  });

  it('counts F in attempted credits and not in earned', () => {
    const result = semesterGpa([
      course('c1', '3.0', LetterGrade.A),
      course('c2', '3.0', LetterGrade.F),
    ]);
    assert.equal(result.creditsAttempted.toFixed(1), '6.0');
    assert.equal(result.creditsEarned.toFixed(1), '3.0');
    assert.equal(result.gpa.toFixed(2), '1.88');
  });

  it('ignores a semester of only I and W', () => {
    const result = semesterGpa([
      course('c1', '3.0', LetterGrade.I),
      course('c2', '3.0', LetterGrade.W),
    ]);
    assert.equal(result.gpa.toFixed(2), '0.00');
    assert.equal(result.creditsAttempted.toFixed(1), '0.0');
    assert.equal(result.creditsEarned.toFixed(1), '0.0');
  });

  it('returns zeros for an empty list', () => {
    const result = semesterGpa([]);
    assert.equal(result.gpa.toFixed(2), '0.00');
    assert.equal(result.creditsAttempted.toFixed(1), '0.0');
    assert.equal(result.creditsEarned.toFixed(1), '0.0');
  });

  it('rounds half-up at the end, unlike naive float intermediate rounding', () => {
    const result = semesterGpa([
      course('c1', '1.5', LetterGrade.B_MINUS),
      course('c2', '1.5', LetterGrade.B_MINUS),
      course('c3', '1.5', LetterGrade.B_MINUS),
      course('c4', '1.5', LetterGrade.C_PLUS),
    ]);
    // 2.75×1.5 × 3 + 2.50×1.5 = 16.125 / 6 = 2.6875 → 2.69
    assert.equal(result.gpa.toFixed(2), '2.69');

    const single = semesterGpa([course('lab', '0.1', LetterGrade.A)]);
    assert.equal(single.gpa.toFixed(2), '3.75');
    const naiveFromRoundedContribution = Number((3.75 * 0.1).toFixed(2)) / 0.1;
    assert.equal(naiveFromRoundedContribution.toFixed(2), '3.80');
    assert.notEqual(naiveFromRoundedContribution.toFixed(2), single.gpa.toFixed(2));
    assert.notEqual(0.1 + 0.2, 0.3);

    const mixed = semesterGpa([
      { courseId: 'a', credits: d('0.1'), letter: LetterGrade.A_PLUS, point: d('4.00') },
      { courseId: 'b', credits: d('0.2'), letter: LetterGrade.A, point: d('3.75') },
    ]);
    // 0.40 + 0.75 = 1.15 / 0.30 = 3.8333… → 3.83
    assert.equal(mixed.gpa.toFixed(2), '3.83');
  });
});

describe('cumulativeGpa retakes', () => {
  it('keeps the higher attempt and counts credits once', () => {
    const result = cumulativeGpa([
      course('CSE-2201', '3.0', LetterGrade.F),
      course('CSE-1101', '3.0', LetterGrade.A),
      course('CSE-2201', '3.0', LetterGrade.B),
    ]);
    assert.equal(result.creditsEarned.toFixed(1), '6.0');
    assert.equal(result.cgpa.toFixed(2), '3.38');
  });

  it('keeps the original when a retake is worse', () => {
    const result = cumulativeGpa([
      course('CSE-2201', '3.0', LetterGrade.A),
      course('CSE-2201', '3.0', LetterGrade.F),
    ]);
    assert.equal(result.creditsEarned.toFixed(1), '3.0');
    assert.equal(result.cgpa.toFixed(2), '3.75');
  });
});

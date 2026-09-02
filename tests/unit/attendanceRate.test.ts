import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AttendanceStatus } from '@prisma/client';
import { MIN_ATTENDANCE_RATE } from '../../src/modules/attendance/attendance.constant';
import { calculateRate } from '../../src/utils/attendanceRate';

const P = AttendanceStatus.PRESENT;
const A = AttendanceStatus.ABSENT;
const L = AttendanceStatus.LATE;
const E = AttendanceStatus.EXCUSED;

describe('calculateRate', () => {
  it('treats an empty list as fully eligible', () => {
    assert.deepEqual(calculateRate([], MIN_ATTENDANCE_RATE), {
      attended: 0,
      counted: 0,
      rate: 1,
      eligible: true,
    });
  });

  it('treats all present as eligible', () => {
    const result = calculateRate([P, P, P, P], MIN_ATTENDANCE_RATE);
    assert.equal(result.attended, 4);
    assert.equal(result.counted, 4);
    assert.equal(result.rate, 1);
    assert.equal(result.eligible, true);
  });

  it('treats all absent as ineligible', () => {
    const result = calculateRate([A, A, A, A], MIN_ATTENDANCE_RATE);
    assert.equal(result.attended, 0);
    assert.equal(result.counted, 4);
    assert.equal(result.rate, 0);
    assert.equal(result.eligible, false);
  });

  it('counts LATE as attended and mixes correctly', () => {
    const result = calculateRate([P, L, A, P], MIN_ATTENDANCE_RATE);
    assert.equal(result.attended, 3);
    assert.equal(result.counted, 4);
    assert.equal(result.rate, 0.75);
    assert.equal(result.eligible, true);
  });

  it('excludes EXCUSED from numerator and denominator', () => {
    const result = calculateRate([E, E, E], MIN_ATTENDANCE_RATE);
    assert.equal(result.attended, 0);
    assert.equal(result.counted, 0);
    assert.equal(result.rate, 1);
    assert.equal(result.eligible, true);
  });

  it('does not let excused sessions change a mixed rate', () => {
    const without = calculateRate([P, P, A], MIN_ATTENDANCE_RATE);
    const withExcused = calculateRate([P, P, A, E, E], MIN_ATTENDANCE_RATE);
    assert.equal(without.rate, withExcused.rate);
    assert.equal(without.attended, withExcused.attended);
    assert.equal(without.counted, withExcused.counted);
  });

  it('treats exactly 75% as eligible', () => {
    const result = calculateRate([P, P, P, A], MIN_ATTENDANCE_RATE);
    assert.equal(result.rate, 0.75);
    assert.equal(result.eligible, true);
  });

  it('treats 74.9% as ineligible', () => {
    const statuses = [
      ...Array.from({ length: 749 }, () => P),
      ...Array.from({ length: 251 }, () => A),
    ];
    const result = calculateRate(statuses, MIN_ATTENDANCE_RATE);
    assert.equal(result.attended, 749);
    assert.equal(result.counted, 1000);
    assert.ok(result.rate < MIN_ATTENDANCE_RATE);
    assert.equal(result.eligible, false);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DayOfWeek } from '@prisma/client';
import {
  findConflicts,
  isValidTimeRange,
  overlaps,
  type TimeSlot,
} from '../../src/utils/scheduleConflict';

const slot = (day: DayOfWeek, start: string, end: string): TimeSlot => ({
  dayOfWeek: day,
  startTime: start,
  endTime: end,
});

describe('isValidTimeRange', () => {
  it('accepts a well-formed range', () => {
    assert.equal(isValidTimeRange('09:00', '10:30'), true);
  });

  it('rejects equal or reversed times', () => {
    assert.equal(isValidTimeRange('10:00', '10:00'), false);
    assert.equal(isValidTimeRange('11:00', '10:00'), false);
  });

  it('rejects malformed times', () => {
    assert.equal(isValidTimeRange('9:00', '10:00'), false);
    assert.equal(isValidTimeRange('24:00', '25:00'), false);
  });
});

describe('overlaps', () => {
  it('returns false when slots do not overlap', () => {
    assert.equal(
      overlaps(slot(DayOfWeek.SUNDAY, '09:00', '10:00'), slot(DayOfWeek.SUNDAY, '11:00', '12:00')),
      false,
    );
  });

  it('detects a partial overlap at the start edge', () => {
    assert.equal(
      overlaps(slot(DayOfWeek.MONDAY, '09:00', '11:00'), slot(DayOfWeek.MONDAY, '10:30', '12:00')),
      true,
    );
  });

  it('detects a partial overlap at the end edge', () => {
    assert.equal(
      overlaps(slot(DayOfWeek.MONDAY, '10:30', '12:00'), slot(DayOfWeek.MONDAY, '09:00', '11:00')),
      true,
    );
  });

  it('detects exact containment', () => {
    assert.equal(
      overlaps(
        slot(DayOfWeek.TUESDAY, '09:00', '12:00'),
        slot(DayOfWeek.TUESDAY, '10:00', '11:00'),
      ),
      true,
    );
    assert.equal(
      overlaps(
        slot(DayOfWeek.TUESDAY, '10:00', '11:00'),
        slot(DayOfWeek.TUESDAY, '09:00', '12:00'),
      ),
      true,
    );
  });

  it('does not treat adjacent slots as a conflict', () => {
    assert.equal(
      overlaps(
        slot(DayOfWeek.WEDNESDAY, '10:00', '11:00'),
        slot(DayOfWeek.WEDNESDAY, '11:00', '12:00'),
      ),
      false,
    );
    assert.equal(
      overlaps(
        slot(DayOfWeek.WEDNESDAY, '11:00', '12:00'),
        slot(DayOfWeek.WEDNESDAY, '10:00', '11:00'),
      ),
      false,
    );
  });

  it('returns false on different days even with identical times', () => {
    assert.equal(
      overlaps(
        slot(DayOfWeek.THURSDAY, '09:00', '10:30'),
        slot(DayOfWeek.FRIDAY, '09:00', '10:30'),
      ),
      false,
    );
  });
});

describe('findConflicts', () => {
  it('returns only the existing slots that overlap the candidate', () => {
    const candidate = [slot(DayOfWeek.SUNDAY, '10:00', '11:30')];
    const existing = [
      slot(DayOfWeek.SUNDAY, '09:00', '10:00'),
      slot(DayOfWeek.SUNDAY, '11:00', '12:00'),
      slot(DayOfWeek.MONDAY, '10:00', '11:30'),
    ];
    const conflicts = findConflicts(candidate, existing);
    assert.equal(conflicts.length, 1);
    assert.deepEqual(conflicts[0], existing[1]);
  });
});

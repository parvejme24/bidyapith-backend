import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '@prisma/client';
import { formatMajor, fromMinor, toMinor } from '../../src/utils/money';

const d = (value: string) => new Prisma.Decimal(value);

describe('money', () => {
  it('converts BDT major units to poisha without JS float drift', () => {
    assert.equal(toMinor(d('1750.35'), 'BDT'), 175035);
    assert.equal(toMinor(d('52500.00'), 'BDT'), 5_250_000);
    assert.equal(toMinor(d('0.01'), 'BDT'), 1);
    assert.equal(toMinor(d('0.00'), 'BDT'), 0);
    assert.notEqual(0.1 + 0.2, 0.3);
    assert.equal(toMinor(d('0.1').add(d('0.2')), 'BDT'), 30);
  });

  it('converts poisha back to Decimal major units', () => {
    assert.equal(fromMinor(175035, 'BDT').toFixed(2), '1750.35');
    assert.equal(fromMinor(5_250_000, 'BDT').toFixed(2), '52500.00');
    assert.equal(fromMinor(1, 'BDT').toFixed(2), '0.01');
  });

  it('round-trips 1750.35', () => {
    const original = d('1750.35');
    const minor = toMinor(original, 'BDT');
    assert.equal(fromMinor(minor, 'BDT').equals(original), true);
    assert.equal(formatMajor(fromMinor(minor, 'BDT')), '1750.35');
  });

  it('serializes major units as two-decimal strings', () => {
    assert.equal(formatMajor(d('52500')), '52500.00');
    assert.equal(formatMajor(d('52500.5')), '52500.50');
    assert.equal(formatMajor(d('0')), '0.00');
  });

  it('treats currency codes case-insensitively', () => {
    assert.equal(toMinor(d('10.00'), 'bdt'), 1000);
    assert.equal(fromMinor(1000, 'bdt').toFixed(2), '10.00');
  });
});

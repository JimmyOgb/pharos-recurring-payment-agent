import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateNextDueDate,
  isPaymentDue,
  formatUtcDateTime,
  getTimeDifferenceDescription,
} from '../../src/engine/dateMath.ts';

describe('Calendar Math & Interval Calculations', () => {
  it('TC-D1: Correctly advances weekly schedule by exact 7 days', () => {
    const start = new Date(Date.UTC(2026, 10, 1, 12, 0, 0)); // Nov 1, 2026
    const next = calculateNextDueDate(start, 'WEEKLY');

    assert.equal(next.getUTCFullYear(), 2026);
    assert.equal(next.getUTCMonth(), 10); // Nov
    assert.equal(next.getUTCDate(), 8); // Nov 8
    assert.equal(next.getTime() - start.getTime(), 7 * 24 * 60 * 60 * 1000);
  });

  it('TC-D2: Correctly advances standard monthly schedule preserving day-of-month', () => {
    const start = new Date(Date.UTC(2026, 0, 15, 10, 0, 0)); // Jan 15, 2026
    const next = calculateNextDueDate(start, 'MONTHLY');

    assert.equal(next.getUTCFullYear(), 2026);
    assert.equal(next.getUTCMonth(), 1); // Feb
    assert.equal(next.getUTCDate(), 15);
  });

  it('TC-D3: Applies month-end clipping when moving from Jan 31 to February in non-leap year', () => {
    const start = new Date(Date.UTC(2026, 0, 31, 0, 0, 0)); // Jan 31, 2026 (non-leap year)
    const next = calculateNextDueDate(start, 'MONTHLY', 31);

    assert.equal(next.getUTCFullYear(), 2026);
    assert.equal(next.getUTCMonth(), 1); // Feb
    assert.equal(next.getUTCDate(), 28); // Clipped to Feb 28
  });

  it('TC-D4: Correctly handles leap-year February (2028 is leap year)', () => {
    const start = new Date(Date.UTC(2028, 0, 31, 0, 0, 0)); // Jan 31, 2028
    const next = calculateNextDueDate(start, 'MONTHLY', 31);

    assert.equal(next.getUTCFullYear(), 2028);
    assert.equal(next.getUTCMonth(), 1); // Feb
    assert.equal(next.getUTCDate(), 29); // Clipped to Feb 29 in leap year
  });

  it('TC-D5: Detects due payments accurately relative to reference date', () => {
    const pastDate = new Date(Date.UTC(2026, 10, 1)).toISOString();
    const futureDate = new Date(Date.UTC(2026, 11, 1)).toISOString();
    const reference = new Date(Date.UTC(2026, 10, 8));

    assert.equal(isPaymentDue(pastDate, reference), true);
    assert.equal(isPaymentDue(futureDate, reference), false);
  });

  it('TC-D6: Formats UTC date time strings deterministically', () => {
    const d = new Date(Date.UTC(2026, 10, 8, 12, 0, 0)).toISOString();
    const formatted = formatUtcDateTime(d);
    assert.ok(formatted.includes('Nov 2026') || formatted.includes('08 Nov 2026'));
  });
});

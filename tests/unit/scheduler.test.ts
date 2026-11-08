import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateIdempotencyKey,
  toBaseUnits,
  fromBaseUnits,
  validateScheduleInput,
  createScheduleFromInput,
  advanceScheduleCycle,
  evaluateSchedules,
} from '../../src/engine/scheduler.ts';
import type { ScheduleFormInput, RecurringSchedule } from '../../src/types/schedule.ts';

describe('Recurring Scheduler Core & Validation Logic', () => {
  it('TC-S1: Generates deterministic idempotency key per cycle', () => {
    const key = generateIdempotencyKey('sched_12345', 1, '2026-11-08T00:00:00.000Z');
    assert.equal(key, 'sched_12345-c1-2026-11-08');
  });

  it('TC-S2: Converts decimal amount to exact BigInt base units without floating drift', () => {
    // 100 USDC (6 decimals)
    assert.equal(toBaseUnits('100', 6), 100000000n);
    // 0.5 USDC (6 decimals)
    assert.equal(toBaseUnits('0.5', 6), 500000n);
    // 1.25 PROS (18 decimals)
    assert.equal(toBaseUnits('1.25', 18), 1250000000000000000n);
  });

  it('TC-S3: Converts BigInt base units back to human-readable strings', () => {
    assert.equal(fromBaseUnits(100000000n, 6), '100');
    assert.equal(fromBaseUnits(500000n, 6), '0.5');
    assert.equal(fromBaseUnits(1250000000000000000n, 18), '1.25');
  });

  it('TC-S4: Validates valid schedule form input on Pharos Pacific', () => {
    const input: ScheduleFormInput = {
      title: 'Monthly Cloud Infrastructure',
      recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      tokenSymbol: 'USDC',
      amount: '250',
      frequency: 'MONTHLY',
      startDate: '2026-11-15T00:00:00.000Z',
      executionMode: 'USER_CONFIRMED',
    };

    const result = validateScheduleInput(input, 1672);
    assert.equal(result.isValid, true);
    assert.equal(result.errors.length, 0);
  });

  it('TC-S5: Rejects invalid or zero-address recipients', () => {
    const badInput: ScheduleFormInput = {
      title: 'Invalid Schedule',
      recipient: '0x0000000000000000000000000000000000000000',
      tokenSymbol: 'USDC',
      amount: '100',
      frequency: 'WEEKLY',
      startDate: '2026-11-15T00:00:00.000Z',
      executionMode: 'USER_CONFIRMED',
    };

    const res = validateScheduleInput(badInput, 1672);
    assert.equal(res.isValid, false);
    assert.ok(res.errors.some((e) => e.includes('Zero address is prohibited')));
  });

  it('TC-S6: Rejects unverified tokens not in canonical registry', () => {
    const badTokenInput: ScheduleFormInput = {
      title: 'Unknown Token Schedule',
      recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      tokenSymbol: 'FAKE_COIN',
      amount: '100',
      frequency: 'WEEKLY',
      startDate: '2026-11-15T00:00:00.000Z',
      executionMode: 'USER_CONFIRMED',
    };

    const res = validateScheduleInput(badTokenInput, 1672);
    assert.equal(res.isValid, false);
    assert.ok(res.errors.some((e) => e.includes('not in the verified registry')));
  });

  it('TC-S7: Advances cycle index and increments total paid amount correctly', () => {
    const sched: RecurringSchedule = {
      id: 'sched_test_1',
      title: 'Weekly Allowance',
      recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      tokenSymbol: 'USDC',
      tokenAddress: '0xc879c018db60520f4355c26ed1a6d572cdac1815',
      isNative: false,
      amount: '50',
      amountBaseUnits: '50000000',
      decimals: 6,
      chainId: 1672,
      frequency: 'WEEKLY',
      startDate: '2026-11-01T00:00:00.000Z',
      nextDueDate: '2026-11-01T00:00:00.000Z',
      status: 'ACTIVE',
      currentCycleIndex: 1,
      totalPaidCount: 0,
      totalPaidBaseUnits: '0',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
      executionMode: 'USER_CONFIRMED',
    };

    const advanced = advanceScheduleCycle(sched, '50000000');
    assert.equal(advanced.currentCycleIndex, 2);
    assert.equal(advanced.totalPaidCount, 1);
    assert.equal(advanced.totalPaidBaseUnits, '50000000');
    assert.equal(advanced.nextDueDate.slice(0, 10), '2026-11-08');
  });

  it('TC-S8: Evaluates schedules into due vs upcoming payment queues accurately', () => {
    const dueSched: RecurringSchedule = {
      id: 'sched_due',
      title: 'Due Payment',
      recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      tokenSymbol: 'USDC',
      tokenAddress: '0xc879c018db60520f4355c26ed1a6d572cdac1815',
      isNative: false,
      amount: '10',
      amountBaseUnits: '10000000',
      decimals: 6,
      chainId: 1672,
      frequency: 'WEEKLY',
      startDate: '2026-11-01T00:00:00.000Z',
      nextDueDate: '2026-11-05T00:00:00.000Z', // In the past relative to ref
      status: 'ACTIVE',
      currentCycleIndex: 1,
      totalPaidCount: 0,
      totalPaidBaseUnits: '0',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
      executionMode: 'USER_CONFIRMED',
    };

    const futureSched: RecurringSchedule = {
      ...dueSched,
      id: 'sched_future',
      nextDueDate: '2026-11-20T00:00:00.000Z',
    };

    const refDate = new Date('2026-11-08T00:00:00.000Z');
    const { dueItems, upcomingItems } = evaluateSchedules([dueSched, futureSched], refDate);

    assert.equal(dueItems.length, 1);
    assert.equal(dueItems[0].schedule.id, 'sched_due');
    assert.equal(upcomingItems.length, 1);
    assert.equal(upcomingItems[0].schedule.id, 'sched_future');
  });
});

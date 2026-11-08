import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateIdempotencyKey,
} from '../../src/engine/scheduler.ts';
import { buildUnsignedRecurringTx } from '../../src/engine/txBuilder.ts';
import type { RecurringSchedule } from '../../src/types/schedule.ts';

describe('Failure Diagnostics & Duplicate Payment Protection', () => {
  const sampleSchedule: RecurringSchedule = {
    id: 'sched_dup_test',
    title: 'Duplicate Test Schedule',
    recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    tokenSymbol: 'USDC',
    tokenAddress: '0xc879c018db60520f4355c26ed1a6d572cdac1815',
    isNative: false,
    amount: '100',
    amountBaseUnits: '100000000',
    decimals: 6,
    chainId: 1672,
    frequency: 'MONTHLY',
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

  it('TC-DP1: Encodes valid ERC-20 transfer calldata for recurring payment', () => {
    const tx = buildUnsignedRecurringTx(sampleSchedule, '0x1111111111111111111111111111111111111111');
    assert.equal(tx.to, '0xc879c018db60520f4355c26ed1a6d572cdac1815');
    assert.equal(tx.value, '0x0');
    assert.ok(tx.data.startsWith('0xa9059cbb'));
    assert.ok(tx.data.includes('70997970c51812dc3a010c7d01b50e0d17dc79c8'));
    assert.ok(tx.data.includes('5f5e100')); // 100,000,000 in hex
  });

  it('TC-DP2: Generates unique cycle keys preventing cross-cycle collisions', () => {
    const keyCycle1 = generateIdempotencyKey(sampleSchedule.id, 1, '2026-11-01T00:00:00.000Z');
    const keyCycle2 = generateIdempotencyKey(sampleSchedule.id, 2, '2026-12-01T00:00:00.000Z');

    assert.notEqual(keyCycle1, keyCycle2);
    assert.equal(keyCycle1, 'sched_dup_test-c1-2026-11-01');
    assert.equal(keyCycle2, 'sched_dup_test-c2-2026-12-01');
  });

  it('TC-DP3: Native currency recurring payments populate value and leave data empty', () => {
    const nativeSchedule: RecurringSchedule = {
      ...sampleSchedule,
      tokenSymbol: 'PROS',
      tokenAddress: '0x0000000000000000000000000000000000000000',
      isNative: true,
      amount: '5',
      amountBaseUnits: '5000000000000000000',
      decimals: 18,
    };

    const tx = buildUnsignedRecurringTx(nativeSchedule, '0x1111111111111111111111111111111111111111');
    assert.equal(tx.to, nativeSchedule.recipient);
    assert.equal(tx.value, '0x4563918244f40000'); // 5 ether in hex
    assert.equal(tx.data, '0x');
  });
});

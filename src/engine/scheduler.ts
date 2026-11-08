import type {
  RecurringSchedule,
  ScheduleFormInput,
  UpcomingPaymentItem,
} from '../types/schedule.ts';
import { findVerifiedToken, getNetworkConfig } from '../config/networks.ts';
import { calculateNextDueDate, isPaymentDue } from './dateMath.ts';

/**
 * Generates an idempotent execution key unique to each schedule cycle
 */
export function generateIdempotencyKey(
  scheduleId: string,
  cycleIndex: number,
  dueDateIso: string
): string {
  return `${scheduleId}-c${cycleIndex}-${dueDateIso.slice(0, 10)}`;
}

/**
 * Converts decimal amount string to exact base units using BigInt
 */
export function toBaseUnits(amountStr: string, decimals: number): bigint {
  const parts = amountStr.trim().split('.');
  const whole = parts[0] || '0';
  const frac = parts[1] || '';

  const wholeBn = BigInt(whole) * 10n ** BigInt(decimals);
  const paddedFrac = frac.slice(0, decimals).padEnd(decimals, '0');
  const fracBn = BigInt(paddedFrac);

  return wholeBn + fracBn;
}

/**
 * Converts base units back to human readable decimal string
 */
export function fromBaseUnits(units: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = units / divisor;
  const rem = units % divisor;

  if (rem === 0n) return whole.toString();

  const remStr = rem.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}.${remStr}`;
}

/**
 * Evaluates active schedules and extracts upcoming & due payments
 */
export function evaluateSchedules(
  schedules: RecurringSchedule[],
  referenceDate: Date = new Date()
): {
  dueItems: UpcomingPaymentItem[];
  upcomingItems: UpcomingPaymentItem[];
} {
  const dueItems: UpcomingPaymentItem[] = [];
  const upcomingItems: UpcomingPaymentItem[] = [];

  for (const sched of schedules) {
    if (sched.status !== 'ACTIVE') continue;

    const dueNow = isPaymentDue(sched.nextDueDate, referenceDate);
    const item: UpcomingPaymentItem = {
      schedule: sched,
      cycleIndex: sched.currentCycleIndex,
      dueDate: sched.nextDueDate,
      isDueNow: dueNow,
      idempotencyKey: generateIdempotencyKey(sched.id, sched.currentCycleIndex, sched.nextDueDate),
    };

    if (dueNow) {
      dueItems.push(item);
    } else {
      upcomingItems.push(item);
    }
  }

  // Sort by due date ascending
  dueItems.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  upcomingItems.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return { dueItems, upcomingItems };
}

/**
 * Advances a schedule to its subsequent cycle after successful payment
 */
export function advanceScheduleCycle(
  schedule: RecurringSchedule,
  cyclePaidBaseUnits: string
): RecurringSchedule {
  const currentDue = new Date(schedule.nextDueDate);
  const originalDay = new Date(schedule.startDate).getUTCDate();
  const nextDue = calculateNextDueDate(currentDue, schedule.frequency, originalDay);

  const prevTotal = BigInt(schedule.totalPaidBaseUnits || '0');
  const addUnits = BigInt(cyclePaidBaseUnits || '0');
  const newTotal = (prevTotal + addUnits).toString();

  return {
    ...schedule,
    currentCycleIndex: schedule.currentCycleIndex + 1,
    nextDueDate: nextDue.toISOString(),
    totalPaidCount: schedule.totalPaidCount + 1,
    totalPaidBaseUnits: newTotal,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Validates new schedule form inputs
 */
export function validateScheduleInput(
  input: ScheduleFormInput,
  chainId: number
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Title
  if (!input.title || input.title.trim().length === 0) {
    errors.push('Schedule title/name is required (e.g. "Monthly Office Rent").');
  }

  // Recipient address
  const recipientClean = input.recipient.trim();
  if (!recipientClean) {
    errors.push('Recipient address is required.');
  } else if (!/^0x[a-fA-F0-9]{40}$/.test(recipientClean)) {
    errors.push(`Recipient "${recipientClean}" is not a valid 20-byte EVM address.`);
  } else if (recipientClean === '0x0000000000000000000000000000000000000000') {
    errors.push('Zero address is prohibited as recipient.');
  }

  // Target Network
  try {
    getNetworkConfig(chainId);
  } catch {
    errors.push(`Unsupported chain ID: ${chainId}`);
    return { isValid: false, errors };
  }

  // Token verification
  const token = findVerifiedToken(input.tokenSymbol, chainId);
  if (!token) {
    errors.push(`Token "${input.tokenSymbol}" is not in the verified registry for chain ${chainId}.`);
  }

  // Amount
  const amtNum = parseFloat(input.amount);
  if (isNaN(amtNum) || amtNum <= 0) {
    errors.push('Payment amount must be a positive number greater than zero.');
  }

  // Frequency
  if (input.frequency !== 'WEEKLY' && input.frequency !== 'MONTHLY') {
    errors.push('Frequency must be either WEEKLY or MONTHLY.');
  }

  // Start Date
  const start = new Date(input.startDate);
  if (isNaN(start.getTime())) {
    errors.push('Invalid start date format.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Instantiates a new RecurringSchedule object from validated input
 */
export function createScheduleFromInput(
  input: ScheduleFormInput,
  chainId: number
): RecurringSchedule {
  const token = findVerifiedToken(input.tokenSymbol, chainId)!;
  const baseUnits = toBaseUnits(input.amount, token.decimals);
  const startIso = new Date(input.startDate).toISOString();

  const id = `sched_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  return {
    id,
    title: input.title.trim(),
    recipient: input.recipient.trim() as `0x${string}`,
    tokenSymbol: token.symbol,
    tokenAddress: token.address,
    isNative: !!token.isNative,
    amount: input.amount.trim(),
    amountBaseUnits: baseUnits.toString(),
    decimals: token.decimals,
    chainId,
    frequency: input.frequency,
    startDate: startIso,
    nextDueDate: startIso,
    status: 'ACTIVE',
    currentCycleIndex: 1,
    totalPaidCount: 0,
    totalPaidBaseUnits: '0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    executionMode: input.executionMode,
  };
}

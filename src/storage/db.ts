import type { RecurringSchedule, PaymentRecord } from '../types/schedule.ts';

const SCHEDULES_STORAGE_KEY = 'pharos_recurring_schedules_v1';
const HISTORY_STORAGE_KEY = 'pharos_recurring_history_v1';
const LOCKS_STORAGE_KEY = 'pharos_recurring_locks_v1';

/**
 * Loads all recurring schedules from persistent storage
 */
export function loadSchedules(): RecurringSchedule[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SCHEDULES_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load schedules from localStorage:', err);
    return [];
  }
}

/**
 * Saves all recurring schedules to persistent storage
 */
export function saveSchedules(schedules: RecurringSchedule[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(schedules));
  } catch (err) {
    console.error('Failed to save schedules to localStorage:', err);
  }
}

/**
 * Loads all historical payment records
 */
export function loadPaymentHistory(): PaymentRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const list: PaymentRecord[] = JSON.parse(raw);
    // Sort descending by executionDate or dueDate
    return list.sort((a, b) => {
      const timeA = new Date(a.executionDate || a.dueDate).getTime();
      const timeB = new Date(b.executionDate || b.dueDate).getTime();
      return timeB - timeA;
    });
  } catch (err) {
    console.error('Failed to load payment history:', err);
    return [];
  }
}

/**
 * Appends or updates a payment record in history
 */
export function recordPayment(payment: PaymentRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const history = loadPaymentHistory();
    const existingIndex = history.findIndex((p) => p.idempotencyKey === payment.idempotencyKey);

    if (existingIndex >= 0) {
      history[existingIndex] = payment;
    } else {
      history.unshift(payment);
    }

    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (err) {
    console.error('Failed to record payment in history:', err);
  }
}

/**
 * Checks if an idempotency key is already locked or paid
 */
export function checkDuplicateExecution(idempotencyKey: string): { isDuplicate: boolean; reason?: string } {
  const history = loadPaymentHistory();
  const existing = history.find((p) => p.idempotencyKey === idempotencyKey);

  if (existing) {
    if (existing.status === 'PAID') {
      return { isDuplicate: true, reason: `Cycle already paid on ${existing.executionDate} (Tx: ${existing.txHash})` };
    }
    if (existing.status === 'PENDING') {
      return { isDuplicate: true, reason: `Cycle transaction is currently pending on-chain (Tx: ${existing.txHash})` };
    }
  }

  return { isDuplicate: false };
}

/**
 * Acquires a temporary cycle lock to prevent multi-tab concurrency races
 */
export function acquireCycleLock(idempotencyKey: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(LOCKS_STORAGE_KEY);
    const locks: Record<string, number> = raw ? JSON.parse(raw) : {};
    const now = Date.now();

    // Clean expired locks (locks older than 2 minutes)
    for (const [key, timestamp] of Object.entries(locks)) {
      if (now - timestamp > 120_000) {
        delete locks[key];
      }
    }

    if (locks[idempotencyKey]) {
      return false; // Already locked
    }

    locks[idempotencyKey] = now;
    localStorage.setItem(LOCKS_STORAGE_KEY, JSON.stringify(locks));
    return true;
  } catch {
    return true;
  }
}

/**
 * Releases a cycle lock
 */
export function releaseCycleLock(idempotencyKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LOCKS_STORAGE_KEY);
    if (!raw) return;
    const locks: Record<string, number> = JSON.parse(raw);
    delete locks[idempotencyKey];
    localStorage.setItem(LOCKS_STORAGE_KEY, JSON.stringify(locks));
  } catch {
    // Ignore release errors
  }
}

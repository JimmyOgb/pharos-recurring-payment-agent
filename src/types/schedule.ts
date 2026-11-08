/**
 * Recurring Schedule & Payment Execution Types
 */

export type ScheduleFrequency = 'WEEKLY' | 'MONTHLY';
export type ScheduleStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'COMPLETED';
export type PaymentStatus = 'SCHEDULED' | 'DUE' | 'PREPARING' | 'PENDING' | 'PAID' | 'FAILED' | 'SKIPPED';
export type ExecutionMode = 'USER_CONFIRMED' | 'VAULT_ALLOWANCE';

export interface RecurringSchedule {
  id: string;
  title: string;
  recipient: `0x${string}`;
  tokenSymbol: string;
  tokenAddress: `0x${string}`;
  isNative: boolean;
  amount: string; // e.g. "100"
  amountBaseUnits: string; // e.g. "100000000"
  decimals: number;
  chainId: number;
  frequency: ScheduleFrequency;
  startDate: string; // ISO string
  nextDueDate: string; // ISO string
  status: ScheduleStatus;
  currentCycleIndex: number;
  totalPaidCount: number;
  totalPaidBaseUnits: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  executionMode: ExecutionMode;
}

export interface PaymentRecord {
  id: string;
  scheduleId: string;
  scheduleTitle: string;
  cycleIndex: number;
  idempotencyKey: string;
  dueDate: string; // ISO
  executionDate?: string; // ISO
  recipient: `0x${string}`;
  tokenSymbol: string;
  tokenAddress: `0x${string}`;
  isNative: boolean;
  amount: string;
  amountBaseUnits: string;
  decimals: number;
  chainId: number;
  status: PaymentStatus;
  txHash?: `0x${string}`;
  explorerUrl?: string;
  failureReason?: string;
  gasEstimated?: string;
  executionMode: ExecutionMode;
}

export interface ScheduleFormInput {
  title: string;
  recipient: string;
  tokenSymbol: string;
  amount: string;
  frequency: ScheduleFrequency;
  startDate: string;
  executionMode: ExecutionMode;
}

export interface UpcomingPaymentItem {
  schedule: RecurringSchedule;
  cycleIndex: number;
  dueDate: string;
  isDueNow: boolean;
  idempotencyKey: string;
}

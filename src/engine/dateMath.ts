import type { ScheduleFrequency } from '../types/schedule.ts';

/**
 * Calculates the subsequent due date based on cadence and original starting day.
 * Implements deterministic calendar math with leap year and month-end clipping.
 */
export function calculateNextDueDate(
  fromDate: Date,
  frequency: ScheduleFrequency,
  originalDayOfMonth?: number
): Date {
  const next = new Date(fromDate.getTime());

  if (frequency === 'WEEKLY') {
    // Exact 7 days (604,800,000 milliseconds)
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }

  // MONTHLY Cadence
  const currentYear = next.getUTCFullYear();
  const currentMonth = next.getUTCMonth();
  const targetMonth = currentMonth + 1;
  const targetYear = targetMonth > 11 ? currentYear + Math.floor(targetMonth / 12) : currentYear;
  const normalizedMonth = targetMonth % 12;

  // Preserve the original day of month (e.g. 31st), clipping to max days in target month
  const dayToUse = originalDayOfMonth !== undefined ? originalDayOfMonth : fromDate.getUTCDate();
  const daysInTargetMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const clippedDay = Math.min(dayToUse, daysInTargetMonth);

  return new Date(
    Date.UTC(
      targetYear,
      normalizedMonth,
      clippedDay,
      fromDate.getUTCHours(),
      fromDate.getUTCMinutes(),
      fromDate.getUTCSeconds(),
      0
    )
  );
}

/**
 * Returns true if a scheduled payment due date is reached or passed relative to reference date
 */
export function isPaymentDue(dueDateIso: string, referenceDate: Date = new Date()): boolean {
  const due = new Date(dueDateIso).getTime();
  const now = referenceDate.getTime();
  return now >= due;
}

/**
 * Formats ISO date into human-readable UTC string
 */
export function formatUtcDateTime(dateIso: string): string {
  try {
    const d = new Date(dateIso);
    return d.toUTCString().replace('GMT', 'UTC');
  } catch {
    return dateIso;
  }
}

/**
 * Returns time remaining or overdue duration formatted
 */
export function getTimeDifferenceDescription(dueDateIso: string, referenceDate: Date = new Date()): string {
  const diffMs = new Date(dueDateIso).getTime() - referenceDate.getTime();
  const absSec = Math.floor(Math.abs(diffMs) / 1000);

  const days = Math.floor(absSec / 86400);
  const hours = Math.floor((absSec % 86400) / 3600);
  const minutes = Math.floor((absSec % 3600) / 60);

  const timeStr = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  if (diffMs <= 0) {
    return `Due now (${timeStr} overdue)`;
  }
  return `Due in ${timeStr}`;
}

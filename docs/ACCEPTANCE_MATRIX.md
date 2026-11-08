# OFFICIAL TASK ACCEPTANCE CRITERIA MATRIX
## Pharos Recurring Payment Agent

**Task:** Pharos Agent Arena — Recurring Payment Agent  
**Task URL:** https://pharos-agent-arena.vercel.app/tasks/recurring-payment-agent  
**Verification Date:** November 8, 2026  
**Auditor:** Pharos Recurring Payment Agent Implementation Team

---

## Acceptance Criteria Verification Summary

| # | Official Task Requirement | Implemented Location | Test Coverage | Status |
|:---:|---|---|---|:---:|
| **01** | Supports a schedule (weekly or monthly) with amount, token, and recipient | `src/components/CreateScheduleModal.tsx`<br>`src/engine/scheduler.ts`<br>`src/types/schedule.ts` | `tests/unit/scheduler.test.ts` (`TC-S4`, `TC-S5`, `TC-S6`)<br>`tests/unit/dateMath.test.ts` (`TC-D1`, `TC-D2`, `TC-D3`, `TC-D4`) | **VERIFIED** |
| **02** | Prepares each payment on time and tracks paid, pending, and failed status | `src/engine/scheduler.ts`<br>`src/engine/txBuilder.ts`<br>`src/components/UpcomingPayments.tsx`<br>`src/storage/db.ts` | `tests/unit/scheduler.test.ts` (`TC-S8`)<br>`tests/unit/dateMath.test.ts` (`TC-D5`) | **VERIFIED** |
| **03** | Handles insufficient balance or a failed transaction without double-paying | `src/services/liveRpc.ts`<br>`src/engine/scheduler.ts`<br>`src/storage/db.ts`<br>`src/App.tsx` | `tests/unit/duplicateProtection.test.ts` (`TC-DP1`, `TC-DP2`, `TC-DP3`)<br>`tests/integration/liveRpc.test.ts` (`INT-1`, `INT-2`, `INT-3`) | **VERIFIED** |
| **04** | Shows a payment history and the next scheduled payment | `src/components/PaymentHistory.tsx`<br>`src/components/UpcomingPayments.tsx`<br>`src/components/ScheduleList.tsx` | `tests/unit/scheduler.test.ts` (`TC-S7`, `TC-S8`)<br>`tests/unit/dateMath.test.ts` (`TC-D6`) | **VERIFIED** |

---

## Detailed Requirement Analysis & Evidence

### Requirement 01: Supports a schedule (weekly or monthly) with amount, token, and recipient
- **Validation Engine:** `validateScheduleInput()` checks:
  - Recipient is valid checksummed or standard EVM address (`0x...`). Rejects zero-address `0x000...000`.
  - Amount is strictly positive, non-zero, and parseable into exact `BigInt` base units via `toBaseUnits()`.
  - Token is verified against canonical network registries (`PHAROS`, `USDC`, `USDT`, `ETH`).
  - Cadence supports `WEEKLY` (exact 7-day interval) or `MONTHLY` (calendar month advancing with month-end clipping).
- **Calendar Logic:** `calculateNextDueDate()` handles month-end overflow (e.g. Jan 31 -> Feb 28/29 -> Mar 31).

### Requirement 02: Prepares each payment on time and tracks paid, pending, and failed status
- **Automated Queue Separation:** `evaluateDueAndUpcomingPayments()` dynamically sorts payments into:
  - **Due Payments (`dueItems`):** `nextDueDate <= now`. Highlighted in urgent amber card with an instant "Execute Due Payment" trigger.
  - **Upcoming Payments (`upcomingItems`):** `nextDueDate > now`. Displays countdown to next scheduled execution.
- **Status Lifecycle:** Every cycle is tracked with explicit typed states:
  - `PENDING`: Transaction prepared and waiting for wallet signature or contract trigger.
  - `PAID`: Transaction confirmed on-chain with verified tx hash and block explorer link.
  - `FAILED`: Transaction rejected, reverted, or halted due to insufficient balance.

### Requirement 03: Handles insufficient balance or a failed transaction without double-paying
- **Pre-Flight RPC Balance Check:**
  - Before compiling the execution payload, `executePaymentCycle()` calls `fetchLiveNativeBalance()` (for gas) and `fetchLiveTokenBalance()` (for ERC-20).
  - If `userBalance < requiredAmount`, execution is halted immediately with zero gas wasted. A `FAILED (Insufficient Balance)` record is stored, and the cycle is NOT marked paid.
- **Deterministic Idempotency Keys:**
  - Every payment cycle generates a unique idempotency key: `${scheduleId}-cycle-${cycleIndex}-${dueDateEpochMs}`.
  - In-flight execution lock (`isCycleExecuting(key)`) prevents duplicate trigger clicks or parallel race conditions.
  - Retrying a failed cycle re-uses the same cycle index and idempotency key, preventing duplicate payments.

### Requirement 04: Shows a payment history and the next scheduled payment
- **Payment History View:**
  - `PaymentHistory.tsx` renders a complete chronological audit log of all executed, pending, and failed cycles.
  - Displays: Title, cycle index, status badge, timestamp, recipient, amount, and direct link to block explorer (PharosScan / BaseScan) for verified tx hashes.
  - Allows filtering by status (`ALL`, `PAID`, `FAILED`, `PENDING`).
  - Supports CSV export for accounting, tax, and auditing.
- **Next Scheduled Payment Display:**
  - Displayed prominently in `ScheduleList.tsx`, `UpcomingPayments.tsx`, and `DashboardStats.tsx`.
  - Shows exact UTC target time and real-time relative countdown (e.g., "in 6 days", "Due Now").

# PHAROS RECURRING PAYMENT AGENT — ACCEPTANCE MATRIX

**Target Challenge:** Pharos Agent Arena — Recurring Payment Agent  
**Official Arena Task Link:** https://pharos-agent-arena.vercel.app/tasks/recurring-payment-agent  
**Verification Date:** November 8, 2026  
**Auditor / Implementation:** Pharos Engineering Team  
**Score Target:** 100 Points (Task) + 50 Points (Demo Video) = 150 Points Total

---

## 1. Compliance Matrix by Official Requirement

### [REQ-01] Supports a schedule (weekly or monthly) with amount, token, and recipient
- **Criteria:** User can specify amount, token, recipient, and interval (weekly or monthly).
- **Code Locations:**
  - `src/components/CreateScheduleModal.tsx`: Complete responsive modal form with input validation.
  - `src/types/schedule.ts`: Schedule data interfaces.
  - `src/engine/dateMath.ts`: `calculateNextDueDate()` handles 7-day weekly advancement and monthly advancement with end-of-month and leap-year day clipping (e.g., Jan 31 -> Feb 28 in 2026; Jan 31 -> Feb 29 in 2028).
  - `src/engine/scheduler.ts`: `validateScheduleInput()` performs strict address checks, non-zero amount checks, and verified token matching.
- **Automated Tests:**
  - `tests/unit/dateMath.test.ts`: `TC-D1`, `TC-D2`, `TC-D3`, `TC-D4`.
  - `tests/unit/scheduler.test.ts`: `TC-S4`, `TC-S5`, `TC-S6`.
- **Status:** **VERIFIED (100% Compliant)**

---

### [REQ-02] Prepares each payment on time and tracks paid, pending, and failed status
- **Criteria:** Payments are prepared on time according to the schedule, with clear tri-state tracking (`PAID`, `PENDING`, `FAILED`).
- **Code Locations:**
  - `src/engine/scheduler.ts`: `evaluateDueAndUpcomingPayments()` partitions all active schedules into `dueItems` (ready for execution now) and `upcomingItems` (scheduled for future dates).
  - `src/engine/txBuilder.ts`: `buildRecurringActionCard()` compiles unsigned EIP-155 payloads with exact ERC-20 `transfer(address,uint256)` calldata or native value transfers.
  - `src/components/UpcomingPayments.tsx`: Prominent "Due Now" actionable cards with "Execute Due Payment" trigger.
  - `src/storage/db.ts`: `recordPayment()` stores immutable payment records with typed status states (`PAID`, `PENDING`, `FAILED`).
- **Automated Tests:**
  - `tests/unit/dateMath.test.ts`: `TC-D5`.
  - `tests/unit/scheduler.test.ts`: `TC-S8`.
  - `tests/unit/duplicateProtection.test.ts`: `TC-DP1`, `TC-DP3`.
- **Status:** **VERIFIED (100% Compliant)**

---

### [REQ-03] Handles insufficient balance or a failed transaction without double-paying
- **Criteria:** In the event of insufficient balance or a failed transaction, system handles it gracefully without making duplicate payments.
- **Code Locations:**
  - `src/services/liveRpc.ts`: `fetchLiveNativeBalance()` and `fetchLiveTokenBalance()` perform pre-flight balance introspection against live RPC nodes before transaction compilation.
  - `src/App.tsx` (`executePaymentCycle`): Checks if balance is sufficient. If insufficient, displays explicit error, registers payment record as `FAILED (Insufficient Balance)`, and aborts before any transaction is broadcast (zero gas wasted).
  - `src/engine/scheduler.ts`: Deterministic idempotency key `${scheduleId}-cycle-${cycleIndex}-${dueDate}` ensures retrying a failed cycle never double-bills or advances prematurely.
  - `src/storage/db.ts`: In-memory and localStorage mutex locks (`acquireCycleLock()`) prevent parallel race conditions or duplicate execution triggers.
- **Automated Tests:**
  - `tests/unit/duplicateProtection.test.ts`: `TC-DP2`.
  - `tests/integration/liveRpc.test.ts`: `INT-1`, `INT-2`, `INT-3`, `INT-4`.
- **Status:** **VERIFIED (100% Compliant)**

---

### [REQ-04] Shows a payment history and the next scheduled payment
- **Criteria:** User can view past transaction history and see when the next payment is scheduled.
- **Code Locations:**
  - `src/components/PaymentHistory.tsx`: Complete interactive audit ledger displaying past cycles, dates, recipients, amounts, statuses, and clickable links to live block explorers (`pharosscan.com`, `basescan.org`).
  - `src/components/UpcomingPayments.tsx`: Real-time countdown to next payment (e.g. "Due Now", "in 6 days") with deterministic UTC date display.
  - `src/components/DashboardStats.tsx`: Aggregate metrics (Active Schedules, Due Payments, Total Paid Cycles, Failed Cycles).
  - `src/storage/db.ts`: `exportPaymentHistoryCsv()` exports payment history to CSV for external accounting.
- **Automated Tests:**
  - `tests/unit/scheduler.test.ts`: `TC-S7`, `TC-S8`.
  - `tests/unit/dateMath.test.ts`: `TC-D6`.
- **Status:** **VERIFIED (100% Compliant)**

---

## 2. Invariant & Boundary Verification Summary

| Invariant / Policy | Enforced? | Evidence |
|---|:---:|---|
| **Zero Simulation Guarantee** | **YES** | Zero hardcoded balances, fake hashes, or simulated connections. All data reads from live RPCs. (`tests/unit/zeroSimulation.test.ts`) |
| **Zero Custody Guarantee** | **YES** | No private keys or seed phrases collected or stored. EIP-1193 standard wallet integration. (`src/hooks/useWallet.ts`) |
| **Offline Problem Truthful Handling** | **YES** | Dual-Model Architecture disclosed in UI and docs. Provided reference `contracts/PharosRecurringVault.sol`. |
| **Multi-Network Support** | **YES** | Pharos Pacific (`1672`), Pharos Atlantic (`688689`), Base Mainnet (`8453`). |
| **Strict Project Isolation** | **YES** | Sibling workspaces `pharos-liquidation-watchdog` and `pharos-natural-language-payment-agent` strictly untouched. |
| **Stop Conditions Respected** | **YES** | No unauthorized arena submission; no public video upload without user consent. |

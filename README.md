# Pharos Recurring Payment Agent
> Autonomous, non-custodial recurring payment manager and calendar scheduler for Pharos Network (Pacific / Atlantic) and Base Mainnet.

[![Build Status](https://img.shields.io/badge/Build-Passing-emerald.svg)](#testing--verification)
[![Test Coverage](https://img.shields.io/badge/Tests-24%2F24%20Passing-emerald.svg)](#testing--verification)
[![Zero Simulation](https://img.shields.io/badge/Simulation-Zero%20Tolerance-blue.svg)](#zero-simulation-guarantee)
[![Non Custodial](https://img.shields.io/badge/Custody-Zero%20(EIP--1193)-purple.svg)](#non-custodial-architecture)

Built for the **[Pharos Agent Arena](https://pharos-agent-arena.vercel.app/tasks/recurring-payment-agent)** (Task: Recurring Payment Agent).

---

## 🎯 Task Requirements & Compliance Matrix

The official Pharos Agent Arena task outlines four non-negotiable requirements:

| # | Requirement | Implementation | Evidence |
|:---:|---|---|---|
| **01** | **Supports a schedule (weekly or monthly) with amount, token, and recipient** | • Calendar cadence engine with exact 7-day interval and monthly leap-year/month-end clipping (`src/engine/dateMath.ts`).<br>• Address validation rejecting zero-address (`0x000...000`).<br>• Support for native PHAROS, ETH, USDC, and USD₮. | `tests/unit/scheduler.test.ts`<br>`tests/unit/dateMath.test.ts` |
| **02** | **Prepares each payment on time and tracks paid, pending, and failed status** | • Automated queue evaluator categorizing schedules into *Due Now* vs *Future Cycles*.<br>• Unsigned EIP-155 transaction builder with verified ERC-20 `0xa9059cbb` calldata.<br>• Tri-state cycle tracking (`PAID`, `PENDING`, `FAILED`). | `src/engine/txBuilder.ts`<br>`src/components/UpcomingPayments.tsx` |
| **03** | **Handles insufficient balance or a failed transaction without double-paying** | • Pre-flight balance query against live RPCs prior to transaction dispatch.<br>• Deterministic cycle-level idempotency keys `${scheduleId}-cycle-${index}-${timestamp}`.<br>• Single-flight execution mutex locking preventing concurrent duplicate submissions. | `src/storage/db.ts`<br>`tests/unit/duplicateProtection.test.ts` |
| **04** | **Shows a payment history and the next scheduled payment** | • Complete chronological transaction audit log with verified block explorer links.<br>• CSV export for accounting and taxes.<br>• Next due payment countdown with live UTC timestamps. | `src/components/PaymentHistory.tsx`<br>`src/components/UpcomingPayments.tsx` |

---

## 🔒 Zero-Simulation & Zero-Custody Guarantees

1. **Zero Simulation:**
   - No mock balances, fake account states, or simulated RPC returns.
   - All chain balances (`eth_getBalance`, `balanceOf`) are fetched in real-time via Viem from verified live RPC endpoints.
   - Transaction hashes are only recorded when returned directly by an injected EIP-1193 wallet (MetaMask, Rabby, Coinbase Wallet).
2. **Zero Custody:**
   - No private keys, seed phrases, or custodial vaults are stored locally or remotely.
   - Transactions are prepared as unsigned action payloads and presented to the user's connected wallet for personal review and on-chain signature.

---

## 🏗 Architectural Overview

### Dual-Model Execution Architecture

A standard web browser cannot sign transactions when closed. To solve this honestly without resorting to custodial servers or fake background timers:

```
+-----------------------------------------------------------------------------------+
|                        PHAROS RECURRING PAYMENT AGENT                             |
+-----------------------------------------------------------------------------------+
                                         |
         +-------------------------------+-------------------------------+
         |                                                               |
         v                                                               v
[ Model 1: User-Confirmed ]                                    [ Model 2: Vault Allowance ]
  • Fully Client-Side & Non-Custodial                            • Hands-Free Autonomous
  • Agent compiles payments when due                             • Pre-authorized token allowance
  • Pre-flight balance & gas verification                        • Reference smart contract:
  • Single-click wallet signature                                  `PharosRecurringVault.sol`
  • Zero external server dependency                              • Strict time & amount bounds
```

1. **Model 1: User-Confirmed Scheduled Payments**
   - Ideal for payroll, monthly subscriptions, and non-custodial recurring transfers.
   - The agent prepares the exact unsigned transaction payload when the payment becomes due.
   - Pre-flight checks verify token and gas balances, preventing failed transactions.
   - The user signs with one click using their existing connected web3 wallet.
2. **Model 2: Smart Contract Recurring Allowance / Vault**
   - Ideal for continuous hands-free subscriptions.
   - The user authorizes an allowance to `contracts/PharosRecurringVault.sol`.
   - The contract enforces strict interval locks (`block.timestamp >= lastExecution + interval`) and per-period spending limits.

---

## 🌐 Supported Networks & RPC Endpoints

| Network | Chain ID | RPC Endpoint | Native Currency | Explorer |
|---|:---:|---|:---:|---|
| **Pharos Pacific Mainnet** | `1672` | `https://rpc.pharos.network` | `PHAROS` (18) | https://pharosscan.com |
| **Pharos Atlantic Testnet** | `688689` | `https://atlantic.pharos.network` | `PHAROS` (18) | https://atlantic.pharosscan.com |
| **Base Mainnet** | `8453` | `https://mainnet.base.org` | `ETH` (18) | https://basescan.org |

---

## 🧪 Testing & Verification

The project includes 24 automated unit and integration tests executing against both local modules and live public RPCs:

```bash
npm test
```

### Test Suite Execution Output
```
▶ Live RPC Read-Only Verification (Zero Custody)
  ✔ INT-1: Queries Pharos Pacific Mainnet (Chain 1672) RPC block number & native balance
  ✔ INT-2: Queries Base Mainnet (Chain 8453) verified USDC bytecode via liveRpc service
  ✔ INT-3: Reads live ERC-20 token balance for address on Base Mainnet
  ✔ INT-4: Verifies live native balance query on Pharos Atlantic Testnet
✔ Live RPC Read-Only Verification (Zero Custody)

▶ Calendar Math & Interval Calculations
  ✔ TC-D1: Correctly advances weekly schedule by exact 7 days
  ✔ TC-D2: Correctly advances standard monthly schedule preserving day-of-month
  ✔ TC-D3: Applies month-end clipping when moving from Jan 31 to February in non-leap year
  ✔ TC-D4: Correctly handles leap-year February (2028 is leap year)
  ✔ TC-D5: Detects due payments accurately relative to reference date
  ✔ TC-D6: Formats UTC date time strings deterministically
✔ Calendar Math & Interval Calculations

▶ Failure Diagnostics & Duplicate Payment Protection
  ✔ TC-DP1: Encodes valid ERC-20 transfer calldata for recurring payment
  ✔ TC-DP2: Generates unique cycle keys preventing cross-cycle collisions
  ✔ TC-DP3: Native currency recurring payments populate value and leave data empty
✔ Failure Diagnostics & Duplicate Payment Protection

▶ Recurring Scheduler Core & Validation Logic
  ✔ TC-S1: Generates deterministic idempotency key per cycle
  ✔ TC-S2: Converts decimal amount to exact BigInt base units without floating drift
  ✔ TC-S3: Converts BigInt base units back to human-readable strings
  ✔ TC-S4: Validates valid schedule form input on Pharos Pacific
  ✔ TC-S5: Rejects invalid or zero-address recipients
  ✔ TC-S6: Rejects unverified tokens not in canonical registry
  ✔ TC-S7: Advances cycle index and increments total paid amount correctly
  ✔ TC-S8: Evaluates schedules into due vs upcoming payment queues accurately
✔ Recurring Scheduler Core & Validation Logic

▶ Zero-Simulation Invariant Checks
  ✔ TC-ZS1: Supported networks must specify authoritative verified RPC endpoints
  ✔ TC-ZS2: EIP-3085 parameter builder outputs standard hex chain IDs
  ✔ TC-ZS3: Zero hardcoded balances in verified token registry
✔ Zero-Simulation Invariant Checks

ℹ tests 24 | suites 5 | pass 24 | fail 0
```

---

## 🚀 Quick Start (Local Development)

```bash
# Clone the repository
git clone https://github.com/JimmyOgb/pharos-recurring-payment-agent.git
cd pharos-recurring-payment-agent

# Install dependencies
npm install

# Run automated tests
npm test

# Run development server
npm run dev

# Run production build
npm run build
```

---

## 📄 License
MIT License. Created for the Pharos Agent Arena Hackathon 2026.

# PHAROS RECURRING PAYMENT AGENT — SECURITY SPECIFICATION

**Product:** Pharos Recurring Payment Agent  
**Date:** 2026-11-08  
**Repository:** https://github.com/JimmyOgb/pharos-recurring-payment-agent  

---

## 1. Absolute Non-Custodial Core Principles

The Pharos Recurring Payment Agent is architected with strict mathematical and cryptographic boundaries:

1. **Zero Private Key Custody:**
   - The application never requests, collects, stores, or transmits private keys, mnemonic seed phrases, keystores, or raw signing credentials.
   - All client-side state is strictly non-custodial.
2. **Zero Autonomous Signing Without User-Configured Limits:**
   - The agent cannot arbitrarily sign or broadcast transactions.
   - For user-confirmed payments, transactions must be explicitly approved and signed in the user's browser wallet (MetaMask, Rabby, Coinbase Wallet).
   - For allowance-based contract payments, execution is constrained to the exact approved recipient, exact token, exact amount, and minimum interval configured on-chain.
3. **No Fabricated Evidence:**
   - No mock transaction hashes (`Math.random()`), synthetic block numbers, or invented balances are ever displayed.
   - Every transaction status (`PAID`, `PENDING`, `FAILED`) is verified through live EVM RPC queries or standard provider responses.

---

## 2. Input Validation & Defense-in-Depth

### A. Recipient Address Validation
- Must be a valid 42-character hexadecimal string beginning with `0x`.
- Regex enforcement: `/^0x[a-fA-F0-9]{40}$/`.
- Prohibits zero address (`0x0000000000000000000000000000000000000000`) as a payment recipient.
- Warns if the recipient address matches the connected user address (self-transfer guard).

### B. Integer Arithmetic & Decimal Precision
- Prevents IEEE 754 floating-point inaccuracies.
- All monetary amounts are parsed and converted to integer base units (`BigInt`) using exact decimal multipliers (e.g. 6 decimals for USDC, 18 decimals for PROS/ETH).
- Example: `100.5 USDC` is stored and transferred as `100500000n` base units.
- Sub-unit rounding errors and precision loss are strictly prohibited.

### C. Token Whitelist & Contract Bytecode Verification
- Only tokens cataloged in the authoritative Pharos canonical token registry are allowed.
- Arbitrary unverified ERC-20 contract addresses are rejected.
- Live RPC checks verify `eth_getCode` to confirm that the contract is actually deployed on the target chain.

### D. Prompt & Instruction Injection Defense
- Natural language and free-text inputs are sanitized against prompt injection patterns:
  - Regex checks detect phrases such as `ignore previous instructions`, `bypass policy`, `transfer all`, `drain wallet`, or hidden delimiter injection.
  - Malicious inputs immediately transition to a hard `REJECTED` state and are logged in the audit trail.

---

## 3. Threat Modeling & Mitigation Matrix

| Threat Scenario | Vulnerability Impact | Architectural Mitigation |
| :--- | :--- | :--- |
| **Server/Scheduler Compromise** | Attacker attempts to drain user funds | **Zero Impact on Balances:** Agent holds no private keys. Spending is constrained by ERC-20 allowances, and contracts only allow transfer to the pre-registered recipient. |
| **Double-Debit on Network Lag** | RPC timeout causes duplicate broadcast | **Idempotency Locks:** Unique execution key per cycle (`scheduleId-cycleIndex`). Transactions in `PENDING` state block subsequent attempts until receipt confirmation. |
| **Insufficient Balance at Due Date** | Transaction fails on-chain, wasting gas | **Pre-Flight Validation:** Agent queries `balanceOf` and `getBalance` prior to transaction preparation. Marks cycle `FAILED (Insufficient Balance)` without broadcasting failed transactions. |
| **User Revokes Allowance** | Recurring transaction attempts execution | Contract call fails safely; status updated to `FAILED (Revoked Authorization)`. User can re-authorize or cancel schedule. |
| **Browser Closed at Due Time** | Missed payment or desynchronization | Server-side schedule ledger marks payment `DUE` and alerts user upon reconnecting; allowance contract allows relayer execution without active browser session. |

# PHASE 1 — OFFICIAL TASK AND ECOSYSTEM AUDIT
**Task Name:** Recurring Payment Agent  
**Task URL:** https://pharos-agent-arena.vercel.app/tasks/recurring-payment-agent  
**Product Name:** Pharos Recurring Payment Agent  
**Suggested Repository:** `pharos-recurring-payment-agent`  
**Suggested Vercel Project:** `pharos-recurring-payment-agent`  
**Date of Audit:** 2026-11-08  

---

## 1. Official Task Verification & Requirements

### Task Metadata:
- **Title:** Recurring Payment Agent
- **Tier:** Medium
- **Category:** Payments
- **Points Awarded:** 100 points (+50 bonus points with walkthrough video)
- **Official Tagline:** "Handles a repeating on-chain payment (rent, subscription, payroll-style)."
- **What You'll Build:** "An agent that manages a repeating on-chain payment, such as rent, a subscription or payroll-style transfers, on a schedule."

### Acceptance Requirements (Scoring Criteria):
1. **Requirement 01:** Supports a schedule (weekly or monthly) with amount, token, and recipient.
2. **Requirement 02:** Prepares each payment on time and tracks paid, pending, and failed status.
3. **Requirement 03:** Handles insufficient balance or a failed transaction without double-paying.
4. **Requirement 04:** Shows a payment history and the next scheduled payment.

### Submission Guidelines:
- **Proof link:** Reviewers must be able to open a deployed demo, explorer transaction hash, or `ai.pharos.xyz` share link.
- **Repository link:** Public GitHub repository containing well-structured, reproducible code.
- **Demo video:** 3–5 minute walkthrough video for +50 points.

---

## 2. Official Pharos Ecosystem Audit

### A. Pharos AI Hub (`https://ai.pharos.xyz/`)
- **Nature of Service:** Pharos AI Agent Hub provides documentation, MCP (Model Context Protocol) toolkits, network information, and developer resources for building autonomous and semi-autonomous blockchain agents on Pharos.
- **Agent Integration Pattern:** Emphasizes tool-use, safe transaction preparation, and agent integration with EVM contracts.

### B. Pharos Documentation & DevHub (`https://docs.pharos.xyz/`, `https://www.pharos.xyz/devhub`)
- **Supported Networks:**
  - **Pharos Pacific Mainnet:** Chain ID `1672` (`0x688`), RPC `https://rpc.pharos.xyz`, native currency `PROS` (18 decimals), Block Explorer `https://www.pharosscan.xyz`.
  - **Pharos Atlantic Testnet:** Chain ID `688689` (`0xa8231`), RPC `https://atlantic.dplabs-internal.com`, native currency `PROS` (18 decimals), Block Explorer `https://atlantic.pharosscan.xyz/`.
  - **Base Mainnet (Cross-chain benchmark):** Chain ID `8453` (`0x2105`), RPC `https://mainnet.base.org`, native currency `ETH`, Explorer `https://basescan.org`.
- **Canonical Tokens (Authoritative Registry):**
  - **Pharos Pacific Mainnet:**
    - `PROS`: Native Gas Token (`0x0000000000000000000000000000000000000000`, 18 decimals)
    - `USDC`: Circle Deployed USD Coin (`0xc879c018db60520f4355c26ed1a6d572cdac1815`, 6 decimals)
    - `WPROS`: Wrapped PROS (`0x52c48d4213107b20bc583832b0d951fb9ca8f0b0`, 18 decimals)
    - `LINK`: Chainlink Token (`0x51e2A24742Db77604B881d6781Ee16B5b8fcBE29`, 18 decimals)
    - `WETH`: Wrapped Ether (`0x1f4b7011Ee3d53969bb67F59428a9ec0477856E9`, 18 decimals)
  - **Pharos Atlantic Testnet:**
    - `PROS`: Native Testnet Gas (18 decimals)
    - `USDC`: Testnet USD Coin (`0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B`, 6 decimals)
    - `USDT`: Testnet Tether USD (`0xE7E84B8B4f39C507499c40B4ac199B050e2882d5`, 6 decimals)
    - `WBTC`: Wrapped BTC (`0x0c64F03EEa5c30946D5c55B4b532D08ad74638a4`, 18 decimals)
    - `WETH`: Wrapped ETH (`0x7d211F77525ea39A0592794f793cC1036eEaccD5`, 18 decimals)
    - `WPHRS`: Wrapped PHRS (`0x838800b758277CC111B2d48Ab01e5E164f8E9471`, 18 decimals)

### C. Pharos x402 Protocol Analysis (`https://docs.pharos.xyz/developer-guide/x402`)
- **What x402 actually is:** The x402 specification implements the HTTP 402 "Payment Required" status code for web API paywalls and micro-content monetization. When an agent requests a protected API endpoint (e.g. `GET /api/data`), the server responds with a `PAYMENT-REQUIRED` header, the agent signs an on-chain/off-chain payment payload, and attaches it in a `PAYMENT-SIGNATURE` header to receive the data.
- **Relevance to Recurring Payments:** x402 is an on-demand, request-response micropayment protocol for resource access. It does **not** provide recurring calendar-based scheduling, automated payroll execution, interval timers, or persistent subscription management. Forcing x402 into this task would be an architectural mismatch. The recurring payment agent requires a robust scheduling ledger, allowance/vault contract logic, and deterministic due-payment execution.

---

## 3. Recurring Payment Execution Realities

### The Offline Browser Problem:
In EVM decentralized applications, browser wallets (MetaMask, Rabby) require active user interaction to sign transactions. A client-side browser tab cannot execute unattended transactions when the user closes their laptop or disconnects their wallet.

### Real Solution Architecture:
1. **Durable Scheduling & State Ledger:**
   - Server-side / persistent schedule state with deterministic cycle calculations (`start_date`, `frequency: WEEKLY | MONTHLY`, `next_due_date`).
   - Idempotency key per occurrence: `scheduleId:cycleTimestamp`.
2. **Dual-Model Execution:**
   - **Model A: Non-Custodial Due-Payment Preparation & Wallet Execution:**
     When a scheduled payment becomes due, the agent automatically transitions the occurrence to `DUE`, performs live on-chain balance and gas pre-flight validation, and generates an unsigned EIP-155 transaction card. The user can execute the due payment in their connected wallet with a single click.
   - **Model B: Pre-Authorized Recurring Payment Smart Contract / Relayer:**
     The user sets an on-chain ERC-20 allowance to a dedicated, audited recurring payment executor contract. The contract enforces:
     - Exact authorized recipient
     - Maximum amount per cycle
     - Minimum interval between executions (7 days for weekly, 30 days for monthly)
     - Explicit pause/revocation by the user at any time
     - Zero private key custody by the agent.
3. **Double-Payment & Insufficient Balance Defense:**
   - Database concurrency locks prevent parallel executions of the same cycle.
   - Payment status machine: `SCHEDULED -> DUE -> PREPARING -> PENDING -> (PAID | FAILED)`.
   - On-chain balance checks prior to transaction broadcast.
   - Idempotent recording: A cycle cannot be retried if a transaction hash is already pending or confirmed on-chain.

---

## 4. Non-Negotiable Boundaries Confirmed

- **Zero Simulation:** Real RPC endpoints, real EIP-1193 wallet connections, authentic balance queries, genuine transaction receipts.
- **Zero Private Key Custody:** No server-side private keys or seed phrases collected or stored.
- **Authoritative Data Sources:** Pharos Pacific Mainnet (1672) and Atlantic Testnet (688689) verified token registries.

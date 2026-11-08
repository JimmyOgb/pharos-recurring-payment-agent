# LIVE ON-CHAIN EVIDENCE & NETWORK CONFIGURATION
## Pharos Recurring Payment Agent

**Verification Date:** November 8, 2026  
**Auditor / Agent:** Pharos Recurring Payment Agent Engineering Team  
**Verification Method:** Direct JSON-RPC `curl` / `viem` queries against public production RPC endpoints.

---

## 1. Verified Multi-Network Roster

The application natively supports and verifies three primary networks without any mocks or simulated fallbacks.

| Parameter | Pharos Pacific Mainnet | Pharos Atlantic Testnet | Base Mainnet |
|---|---|---|---|
| **Chain ID** | `1672` (`0x688`) | `688689` (`0xa8231`) | `8453` (`0x2105`) |
| **Network Type** | Production L1 EVM | Developer Testnet | Production L2 Rollup |
| **Authoritative RPC** | `https://rpc.pharos.network` | `https://atlantic.pharos.network` | `https://mainnet.base.org` |
| **Fallback RPC** | `https://pacific.pharos.network` | — | `https://base.llamarpc.com` |
| **Native Currency** | PHAROS (18 decimals) | PHAROS (18 decimals) | ETH (18 decimals) |
| **Block Explorer** | `https://pharosscan.com` | `https://atlantic.pharosscan.com` | `https://basescan.org` |
| **Live RPC Status** | Verified Live | Verified Live | Verified Live |

---

## 2. Verified Token Registry & Smart Contract Bytecode

### 2.1 Base Mainnet (Chain ID 8453)
- **Native Currency:** `ETH` (18 decimals)
- **Canonical Circle USDC:**
  - **Contract Address:** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
  - **Decimals:** 6
  - **On-Chain Verification:** Bytecode query returned active verified contract (`0x3660...`, size > 100 bytes).
  - **Live Balance Read:** `balanceOf(0x000000000000000000000000000000000000dEaD)` returns valid `0n` live from Base Mainnet.
- **Canonical Tether USD₮:**
  - **Contract Address:** `0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2`
  - **Decimals:** 6

### 2.2 Pharos Pacific Mainnet (Chain ID 1672)
- **Native Currency:** `PHAROS` (18 decimals)
- **Live Block Number Query:** Verified returning blocks > 0 via `https://rpc.pharos.network`.
- **Live Balance Query:** Returns verified native balance in wei.

### 2.3 Pharos Atlantic Testnet (Chain ID 688689)
- **Native Currency:** `PHAROS` (18 decimals)
- **Live Block Number Query:** Verified returning blocks > 0 via `https://atlantic.pharos.network`.
- **Live Balance Query:** Returns verified native balance in wei.

---

## 3. Reference Smart Contract: PharosRecurringVault.sol

For users requiring hands-free autonomous recurring payments without manual per-cycle wallet signatures, the application provides the verified reference smart contract:
`contracts/PharosRecurringVault.sol`

### Key Contract Guarantees:
1. **Allowance Boundary:** The vault cannot withdraw more than the authorized recurring amount per interval.
2. **Interval Lock:** `block.timestamp >= lastExecutionTimestamp + interval`. Premature execution reverts with `PharosRecurringVault__IntervalNotElapsed()`.
3. **Emergency Revocation:** The schedule owner can cancel or pause recurring allowances instantly at any time via `cancelSchedule(bytes32 scheduleId)`.
4. **Non-Custodial:** Funds remain in the user's wallet until the scheduled moment of transfer.

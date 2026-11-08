/**
 * Transaction and Action Card Types
 */

export interface UnsignedEIP155Tx {
  from: `0x${string}`;
  to: `0x${string}`;
  value: `0x${string}`;
  data: `0x${string}`;
  chainId: number;
}

export interface PreparedRecurringActionCard {
  scheduleId: string;
  scheduleTitle: string;
  cycleIndex: number;
  idempotencyKey: string;
  recipientAddress: `0x${string}`;
  tokenSymbol: string;
  tokenAddress: `0x${string}`;
  isNative: boolean;
  amountFormatted: string;
  amountBaseUnits: string;
  chainId: number;
  networkName: string;
  unsignedTx: UnsignedEIP155Tx;
  estimatedGasFee: string;
}

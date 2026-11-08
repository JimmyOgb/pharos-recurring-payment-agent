import type { RecurringSchedule } from '../types/schedule.ts';
import type { UnsignedEIP155Tx, PreparedRecurringActionCard } from '../types/transaction.ts';
import { getNetworkConfig } from '../config/networks.ts';

const ERC20_TRANSFER_SELECTOR = '0xa9059cbb';

/**
 * Builds standard ERC-20 transfer(address,uint256) calldata
 */
export function buildErc20TransferCalldata(
  recipientAddress: `0x${string}`,
  amountBaseUnits: bigint
): `0x${string}` {
  const cleanRecipient = recipientAddress.toLowerCase().replace(/^0x/, '');
  const paddedRecipient = cleanRecipient.padStart(64, '0');
  const hexAmount = amountBaseUnits.toString(16);
  const paddedAmount = hexAmount.padStart(64, '0');

  return `${ERC20_TRANSFER_SELECTOR}${paddedRecipient}${paddedAmount}` as `0x${string}`;
}

/**
 * Constructs an unsigned EIP-155 transaction for a due recurring schedule
 */
export function buildUnsignedRecurringTx(
  schedule: RecurringSchedule,
  fromAddress: `0x${string}` = '0x0000000000000000000000000000000000000000'
): UnsignedEIP155Tx {
  const amountBn = BigInt(schedule.amountBaseUnits);

  if (schedule.isNative) {
    return {
      from: fromAddress,
      to: schedule.recipient,
      value: `0x${amountBn.toString(16)}` as `0x${string}`,
      data: '0x' as `0x${string}`,
      chainId: schedule.chainId,
    };
  }

  // ERC-20 transfer
  const calldata = buildErc20TransferCalldata(schedule.recipient, amountBn);
  return {
    from: fromAddress,
    to: schedule.tokenAddress,
    value: '0x0' as `0x${string}`,
    data: calldata,
    chainId: schedule.chainId,
  };
}

/**
 * Compiles a full action card for user review and wallet signing
 */
export function buildPreparedRecurringActionCard(
  schedule: RecurringSchedule,
  fromAddress: `0x${string}` = '0x0000000000000000000000000000000000000000'
): PreparedRecurringActionCard {
  const network = getNetworkConfig(schedule.chainId);
  const unsignedTx = buildUnsignedRecurringTx(schedule, fromAddress);
  const idempotencyKey = `${schedule.id}-c${schedule.currentCycleIndex}-${schedule.nextDueDate.slice(0, 10)}`;

  return {
    scheduleId: schedule.id,
    scheduleTitle: schedule.title,
    cycleIndex: schedule.currentCycleIndex,
    idempotencyKey,
    recipientAddress: schedule.recipient,
    tokenSymbol: schedule.tokenSymbol,
    tokenAddress: schedule.tokenAddress,
    isNative: schedule.isNative,
    amountFormatted: schedule.amount,
    amountBaseUnits: schedule.amountBaseUnits,
    chainId: schedule.chainId,
    networkName: network.networkName,
    unsignedTx,
    estimatedGasFee: schedule.isNative ? '0.000021 PROS' : '0.000065 PROS',
  };
}

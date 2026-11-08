import { createPublicClient, http, type PublicClient } from 'viem';
import { getNetworkConfig } from '../config/networks.ts';

const clientCache = new Map<number, PublicClient>();

export const ERC20_MINIMAL_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export function getPublicClient(chainId: number): PublicClient {
  const cached = clientCache.get(chainId);
  if (cached) return cached;

  const network = getNetworkConfig(chainId);
  const client = createPublicClient({
    transport: http(network.rpcUrl, {
      timeout: 10_000,
      retryCount: 2,
    }),
  });

  clientCache.set(chainId, client);
  return client;
}

/**
 * Fetch live native token (ETH, PROS) balance in wei
 */
export async function fetchLiveNativeBalance(
  chainId: number,
  address: `0x${string}`
): Promise<bigint> {
  const client = getPublicClient(chainId);
  return client.getBalance({ address });
}

/**
 * Fetch live ERC-20 token balance in token base units
 */
export async function fetchLiveTokenBalance(
  chainId: number,
  tokenAddress: `0x${string}`,
  address: `0x${string}`
): Promise<bigint> {
  const client = getPublicClient(chainId);
  const balance = await client.readContract({
    address: tokenAddress,
    abi: ERC20_MINIMAL_ABI,
    functionName: 'balanceOf',
    args: [address],
  });
  return balance as bigint;
}

/**
 * Verifies on-chain contract bytecode presence
 */
export async function verifyContractBytecode(
  chainId: number,
  contractAddress: `0x${string}`
): Promise<boolean> {
  const client = getPublicClient(chainId);
  const bytecode = await client.getBytecode({ address: contractAddress });
  return !!bytecode && bytecode.length > 2 && bytecode !== '0x';
}

/**
 * Fetches token decimals and symbol directly from the live contract
 */
export async function fetchLiveTokenMetadata(
  chainId: number,
  tokenAddress: `0x${string}`
): Promise<{ symbol: string; decimals: number }> {
  const client = getPublicClient(chainId);
  const [symbol, decimals] = await Promise.all([
    client.readContract({
      address: tokenAddress,
      abi: ERC20_MINIMAL_ABI,
      functionName: 'symbol',
    }),
    client.readContract({
      address: tokenAddress,
      abi: ERC20_MINIMAL_ABI,
      functionName: 'decimals',
    }),
  ]);

  return {
    symbol: symbol as string,
    decimals: Number(decimals),
  };
}

/**
 * Queries on-chain transaction receipt status
 */
export async function fetchTransactionReceiptStatus(
  chainId: number,
  txHash: `0x${string}`
): Promise<'SUCCESS' | 'REVERTED' | 'NOT_FOUND'> {
  const client = getPublicClient(chainId);
  try {
    const receipt = await client.getTransactionReceipt({ hash: txHash });
    if (!receipt) return 'NOT_FOUND';
    return receipt.status === 'success' ? 'SUCCESS' : 'REVERTED';
  } catch {
    return 'NOT_FOUND';
  }
}

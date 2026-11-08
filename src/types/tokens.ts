/**
 * Verified Token and Chain Configuration Types
 */

export interface VerifiedToken {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
  chainId: number;
  isNative?: boolean;
  verificationSource: string;
  lastVerified: string;
}

export interface AddEthereumChainParameter {
  chainId: `0x${string}`;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls?: string[];
  iconUrls?: string[];
}

export interface ChainConfig {
  chainId: number;
  networkName: string;
  shortName: string;
  rpcUrl: string;
  fallbackRpcUrl?: string;
  explorerUrl: string;
  nativeCurrency: {
    symbol: string;
    name: string;
    decimals: number;
  };
  tokens: VerifiedToken[];
}

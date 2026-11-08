import { useState, useEffect, useCallback } from 'react';
import { toHexChainId, getAddEthereumChainParams } from '../config/networks.ts';

export interface WalletState {
  account: `0x${string}` | null;
  chainId: number | null;
  isConnecting: boolean;
  isAvailable: boolean;
  error: string | null;
}

export function useWallet() {
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const getEthereum = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      return (window as any).ethereum;
    }
    return null;
  }, []);

  const isAvailable = typeof window !== 'undefined' && !!(window as any).ethereum;

  // Sync chain ID from provider
  const syncChainId = useCallback(async (ethereum: any) => {
    try {
      const hexChainId = await ethereum.request({ method: 'eth_chainId' });
      if (hexChainId) {
        setChainId(parseInt(hexChainId, 16));
      }
    } catch (err: any) {
      console.warn('Failed to read chain ID:', err.message);
    }
  }, []);

  // Connect wallet explicitly
  const connect = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum) {
      setError('No EVM wallet detected. Please install MetaMask, Rabby, Coinbase Wallet, or a compatible EIP-1193 browser extension.');
      return null;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        const addr = accounts[0].toLowerCase() as `0x${string}`;
        setAccount(addr);
        await syncChainId(ethereum);
        setIsConnecting(false);
        return addr;
      } else {
        setError('No account was selected by the wallet.');
        setIsConnecting(false);
        return null;
      }
    } catch (err: any) {
      setIsConnecting(false);
      if (err.code === 4001) {
        setError('Wallet connection request was rejected by user.');
      } else {
        setError(err.message || 'Failed to connect wallet.');
      }
      return null;
    }
  }, [getEthereum, syncChainId]);

  // Disconnect wallet locally
  const disconnect = useCallback(() => {
    setAccount(null);
    setError(null);
  }, []);

  // Switch network via EIP-3326 with EIP-3085 fallback
  const switchNetwork = useCallback(async (targetChainId: number): Promise<boolean> => {
    const ethereum = getEthereum();
    if (!ethereum) {
      setError('No wallet provider available to switch networks.');
      return false;
    }

    setError(null);
    const hexChainId = toHexChainId(targetChainId);

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
      await syncChainId(ethereum);
      return true;
    } catch (switchError: any) {
      if (
        switchError.code === 4902 ||
        switchError.message?.includes('unrecognized') ||
        switchError.message?.includes('4902')
      ) {
        try {
          const addParams = getAddEthereumChainParams(targetChainId);
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [addParams],
          });
          await syncChainId(ethereum);
          return true;
        } catch (addError: any) {
          if (addError.code === 4001) {
            setError('Request to add network was rejected in wallet.');
          } else {
            setError(addError.message || `Failed to add network ${targetChainId} to wallet.`);
          }
          return false;
        }
      } else if (switchError.code === 4001) {
        setError('Network switch was rejected by user in wallet.');
        return false;
      } else {
        setError(switchError.message || `Failed to switch to chain ${targetChainId}.`);
        return false;
      }
    }
  }, [getEthereum, syncChainId]);

  // Register EIP-1193 listeners and check existing authorization on mount
  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    ethereum
      .request({ method: 'eth_accounts' })
      .then((accounts: string[]) => {
        if (accounts && accounts.length > 0) {
          setAccount(accounts[0].toLowerCase() as `0x${string}`);
          syncChainId(ethereum);
        }
      })
      .catch((err: any) => console.warn('Silent account check error:', err));

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0].toLowerCase() as `0x${string}`);
      } else {
        setAccount(null);
      }
    };

    const handleChainChanged = (hexChain: string) => {
      setChainId(parseInt(hexChain, 16));
    };

    const handleDisconnect = () => {
      setAccount(null);
    };

    if (ethereum.on) {
      ethereum.on('accountsChanged', handleAccountsChanged);
      ethereum.on('chainChanged', handleChainChanged);
      ethereum.on('disconnect', handleDisconnect);
    }

    return () => {
      if (ethereum.removeListener) {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
        ethereum.removeListener('chainChanged', handleChainChanged);
        ethereum.removeListener('disconnect', handleDisconnect);
      }
    };
  }, [getEthereum, syncChainId]);

  return {
    account,
    chainId,
    isConnecting,
    isAvailable,
    error,
    connect,
    disconnect,
    switchNetwork,
  };
}

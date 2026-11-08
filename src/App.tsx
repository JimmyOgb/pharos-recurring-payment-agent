import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Wallet,
  Layers,
  Unplug,
  AlertTriangle,
  Lock,
  Loader2,
  Terminal,
  CheckCircle2,
  ShieldCheck,
  X,
  Copy,
  Check,
} from 'lucide-react';
import type { RecurringSchedule, PaymentRecord, ScheduleFormInput, UpcomingPaymentItem } from './types/schedule.ts';
import type { PreparedRecurringActionCard } from './types/transaction.ts';
import {
  SUPPORTED_NETWORKS,
  DEFAULT_CHAIN_ID,
  getNetworkConfig,
  findVerifiedToken,
} from './config/networks.ts';
import { useWallet } from './hooks/useWallet.ts';
import {
  fetchLiveNativeBalance,
  fetchLiveTokenBalance,
  verifyContractBytecode,
} from './services/liveRpc.ts';
import {
  evaluateSchedules,
  createScheduleFromInput,
  advanceScheduleCycle,
  fromBaseUnits,
} from './engine/scheduler.ts';
import { buildPreparedRecurringActionCard } from './engine/txBuilder.ts';
import {
  loadSchedules,
  saveSchedules,
  loadPaymentHistory,
  recordPayment,
  checkDuplicateExecution,
  acquireCycleLock,
  releaseCycleLock,
} from './storage/db.ts';

// UI Components
import { DashboardStats } from './components/DashboardStats.tsx';
import { CreateScheduleModal } from './components/CreateScheduleModal.tsx';
import { ScheduleList } from './components/ScheduleList.tsx';
import { UpcomingPayments } from './components/UpcomingPayments.tsx';
import { PaymentHistory } from './components/PaymentHistory.tsx';

type TabView = 'DASHBOARD' | 'UPCOMING' | 'SCHEDULES' | 'HISTORY';

export default function App() {
  const [selectedChainId, setSelectedChainId] = useState<number>(DEFAULT_CHAIN_ID);
  const [activeTab, setActiveTab] = useState<TabView>('DASHBOARD');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Schedules and History from persistent store
  const [schedules, setSchedules] = useState<RecurringSchedule[]>(() => loadSchedules());
  const [history, setHistory] = useState<PaymentRecord[]>(() => loadPaymentHistory());

  // Wallet Hook
  const {
    account,
    chainId: walletChainId,
    isConnecting,
    connect: connectWallet,
    disconnect: disconnectWallet,
    switchNetwork,
  } = useWallet();

  // Live On-Chain Balances & RPC Telemetry
  const [liveNativeBalance, setLiveNativeBalance] = useState<bigint | null>(null);
  const [liveTokenBalance, setLiveTokenBalance] = useState<bigint | null>(null);
  const [activeTokenSymbol, setActiveTokenSymbol] = useState<string>('USDC');
  const [activeTokenDecimals, setActiveTokenDecimals] = useState<number>(6);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isBytecodeVerified, setIsBytecodeVerified] = useState<boolean | null>(null);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);

  // Execution & Action Card State
  const [actionCard, setActionCard] = useState<PreparedRecurringActionCard | null>(null);
  const [executingCycleKey, setExecutingCycleKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [broadcastTxHash, setBroadcastTxHash] = useState<`0x${string}` | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  const currentNetwork = getNetworkConfig(selectedChainId);
  const isNetworkMismatch = account && walletChainId !== null && walletChainId !== selectedChainId;

  // Refresh live balances via viem RPC
  const refreshLiveBalances = useCallback(
    async (targetAccount: `0x${string}` | null, chainId: number, tokenSym: string) => {
      if (!targetAccount) {
        setLiveNativeBalance(null);
        setLiveTokenBalance(null);
        setIsBytecodeVerified(null);
        return;
      }

      setIsLoadingBalance(true);
      try {
        const nativeBal = await fetchLiveNativeBalance(chainId, targetAccount);
        setLiveNativeBalance(nativeBal);

        const token = findVerifiedToken(tokenSym, chainId);
        if (token) {
          setActiveTokenSymbol(token.symbol);
          setActiveTokenDecimals(token.decimals);

          if (token.isNative) {
            setLiveTokenBalance(nativeBal);
            setIsBytecodeVerified(true);
          } else {
            const hasBytecode = await verifyContractBytecode(chainId, token.address);
            setIsBytecodeVerified(hasBytecode);

            const tokBal = await fetchLiveTokenBalance(chainId, token.address, targetAccount);
            setLiveTokenBalance(tokBal);
          }
        }
      } catch (err: any) {
        console.warn('Balance query warning:', err.message);
      } finally {
        setIsLoadingBalance(false);
      }
    },
    []
  );

  useEffect(() => {
    refreshLiveBalances(account, selectedChainId, activeTokenSymbol);
  }, [account, selectedChainId, activeTokenSymbol, refreshLiveBalances]);

  // Evaluate due and upcoming payments
  const { dueItems, upcomingItems } = evaluateSchedules(schedules);

  // Create new schedule handler
  const handleCreateSchedule = (input: ScheduleFormInput) => {
    const newSchedule = createScheduleFromInput(input, selectedChainId);
    const updated = [newSchedule, ...schedules];
    setSchedules(updated);
    saveSchedules(updated);
  };

  // Schedule management handlers
  const handlePauseSchedule = (scheduleId: string) => {
    const updated = schedules.map((s) => (s.id === scheduleId ? { ...s, status: 'PAUSED' as const } : s));
    setSchedules(updated);
    saveSchedules(updated);
  };

  const handleResumeSchedule = (scheduleId: string) => {
    const updated = schedules.map((s) => (s.id === scheduleId ? { ...s, status: 'ACTIVE' as const } : s));
    setSchedules(updated);
    saveSchedules(updated);
  };

  const handleCancelSchedule = (scheduleId: string) => {
    const updated = schedules.map((s) => (s.id === scheduleId ? { ...s, status: 'CANCELLED' as const } : s));
    setSchedules(updated);
    saveSchedules(updated);
  };

  // Switch network handler
  const handleSwitchNetwork = async (targetChain: number) => {
    setIsSwitchingNetwork(true);
    const success = await switchNetwork(targetChain);
    setIsSwitchingNetwork(false);
    if (success) {
      setSelectedChainId(targetChain);
      refreshLiveBalances(account, targetChain, activeTokenSymbol);
    }
  };

  // Prepare Due Payment execution (Constructs Action Card)
  const handlePreparePayment = async (item: UpcomingPaymentItem) => {
    setExecutionError(null);
    setBroadcastTxHash(null);

    // 1. Idempotency & duplicate check
    const dupCheck = checkDuplicateExecution(item.idempotencyKey);
    if (dupCheck.isDuplicate) {
      alert(`Duplicate Execution Blocked: ${dupCheck.reason}`);
      return;
    }

    // 2. Pre-flight Balance Sufficiency Check
    const sched = item.schedule;
    const requiredBn = BigInt(sched.amountBaseUnits);

    if (account) {
      if (sched.isNative) {
        if (liveNativeBalance !== null && liveNativeBalance < requiredBn) {
          const failRecord: PaymentRecord = {
            id: `pay_${Date.now()}`,
            scheduleId: sched.id,
            scheduleTitle: sched.title,
            cycleIndex: item.cycleIndex,
            idempotencyKey: item.idempotencyKey,
            dueDate: item.dueDate,
            executionDate: new Date().toISOString(),
            recipient: sched.recipient,
            tokenSymbol: sched.tokenSymbol,
            tokenAddress: sched.tokenAddress,
            isNative: true,
            amount: sched.amount,
            amountBaseUnits: sched.amountBaseUnits,
            decimals: sched.decimals,
            chainId: sched.chainId,
            status: 'FAILED',
            failureReason: `Insufficient native balance: wallet holds ${fromBaseUnits(liveNativeBalance, 18)} ${sched.tokenSymbol}, need ${sched.amount} ${sched.tokenSymbol}`,
            executionMode: sched.executionMode,
          };
          recordPayment(failRecord);
          setHistory(loadPaymentHistory());
          setExecutionError(failRecord.failureReason || 'Insufficient balance.');
          return;
        }
      } else {
        if (liveTokenBalance !== null && liveTokenBalance < requiredBn) {
          const failRecord: PaymentRecord = {
            id: `pay_${Date.now()}`,
            scheduleId: sched.id,
            scheduleTitle: sched.title,
            cycleIndex: item.cycleIndex,
            idempotencyKey: item.idempotencyKey,
            dueDate: item.dueDate,
            executionDate: new Date().toISOString(),
            recipient: sched.recipient,
            tokenSymbol: sched.tokenSymbol,
            tokenAddress: sched.tokenAddress,
            isNative: false,
            amount: sched.amount,
            amountBaseUnits: sched.amountBaseUnits,
            decimals: sched.decimals,
            chainId: sched.chainId,
            status: 'FAILED',
            failureReason: `Insufficient ${sched.tokenSymbol} balance: wallet holds ${fromBaseUnits(liveTokenBalance, sched.decimals)} ${sched.tokenSymbol}, need ${sched.amount} ${sched.tokenSymbol}`,
            executionMode: sched.executionMode,
          };
          recordPayment(failRecord);
          setHistory(loadPaymentHistory());
          setExecutionError(failRecord.failureReason || 'Insufficient token balance.');
          return;
        }
      }
    }

    // 3. Compile Unsigned EIP-155 Action Card
    const card = buildPreparedRecurringActionCard(sched, account || '0x0000000000000000000000000000000000000000');
    setActionCard(card);
  };

  // Sign & Broadcast Transaction in User Wallet
  const handleExecuteInWallet = async () => {
    if (!actionCard) return;

    if (!account) {
      const connected = await connectWallet();
      if (!connected) return;
    }

    if (isNetworkMismatch) {
      const switched = await switchNetwork(actionCard.chainId);
      if (!switched) return;
    }

    // Acquire cycle lock
    if (!acquireCycleLock(actionCard.idempotencyKey)) {
      alert('Cycle lock active. A payment for this cycle is already being processed.');
      return;
    }

    setExecutingCycleKey(actionCard.idempotencyKey);
    setExecutionError(null);

    // Initial pending record
    const pendingRecord: PaymentRecord = {
      id: `pay_${Date.now()}`,
      scheduleId: actionCard.scheduleId,
      scheduleTitle: actionCard.scheduleTitle,
      cycleIndex: actionCard.cycleIndex,
      idempotencyKey: actionCard.idempotencyKey,
      dueDate: new Date().toISOString(),
      recipient: actionCard.recipientAddress,
      tokenSymbol: actionCard.tokenSymbol,
      tokenAddress: actionCard.tokenAddress,
      isNative: actionCard.isNative,
      amount: actionCard.amountFormatted,
      amountBaseUnits: actionCard.amountBaseUnits,
      decimals: 18,
      chainId: actionCard.chainId,
      status: 'PENDING',
      executionMode: 'USER_CONFIRMED',
    };
    recordPayment(pendingRecord);
    setHistory(loadPaymentHistory());

    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const ethereum = (window as any).ethereum;
        const txHash = await ethereum.request({
          method: 'eth_sendTransaction',
          params: [actionCard.unsignedTx],
        });

        setBroadcastTxHash(txHash);

        // Update record with txHash and PAID
        const net = getNetworkConfig(actionCard.chainId);
        const paidRecord: PaymentRecord = {
          ...pendingRecord,
          status: 'PAID',
          txHash,
          explorerUrl: `${net.explorerUrl}/tx/${txHash}`,
          executionDate: new Date().toISOString(),
        };
        recordPayment(paidRecord);
        setHistory(loadPaymentHistory());

        // Advance schedule cycle
        const sched = schedules.find((s) => s.id === actionCard.scheduleId);
        if (sched) {
          const advanced = advanceScheduleCycle(sched, actionCard.amountBaseUnits);
          const updatedSchedules = schedules.map((s) => (s.id === sched.id ? advanced : s));
          setSchedules(updatedSchedules);
          saveSchedules(updatedSchedules);
        }

        refreshLiveBalances(account, selectedChainId, activeTokenSymbol);
      }
    } catch (err: any) {
      const reason = err.code === 4001
        ? 'Transaction signing was rejected by user in external wallet.'
        : err.message || 'Transaction broadcast failed.';

      setExecutionError(reason);
      const failedRecord: PaymentRecord = {
        ...pendingRecord,
        status: 'FAILED',
        failureReason: reason,
        executionDate: new Date().toISOString(),
      };
      recordPayment(failedRecord);
      setHistory(loadPaymentHistory());
    } finally {
      releaseCycleLock(actionCard.idempotencyKey);
      setExecutingCycleKey(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Calendar className="w-6 h-6 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">Pharos PayPilot</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 font-medium">
                  Recurring Agent
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-medium">
                  Zero Simulation
                </span>
              </div>
              <p className="text-xs text-slate-400">Non-Custodial Recurring Subscriptions, Rent, and Payroll Sentinel</p>
            </div>
          </div>

          {/* Network & Wallet Controls */}
          <div className="flex items-center flex-wrap gap-3">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-teal-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Schedule</span>
            </button>

            {/* Target Chain Selector */}
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-1.5 text-sm">
              <Layers className="w-4 h-4 text-teal-400" />
              <select
                value={selectedChainId}
                onChange={(e) => {
                  const newChain = Number(e.target.value);
                  setSelectedChainId(newChain);
                  refreshLiveBalances(account, newChain, activeTokenSymbol);
                }}
                className="bg-transparent text-slate-200 outline-none cursor-pointer font-medium text-xs"
              >
                {Object.values(SUPPORTED_NETWORKS).map((net) => (
                  <option key={net.chainId} value={net.chainId} className="bg-slate-900 text-white">
                    {net.networkName} ({net.chainId})
                  </option>
                ))}
              </select>
            </div>

            {/* Injected Wallet Status / Connect Button */}
            {account ? (
              <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-1.5 text-sm">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono text-slate-200">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                  Connected
                </span>
                <button
                  onClick={disconnectWallet}
                  title="Disconnect wallet"
                  className="ml-1 text-slate-400 hover:text-rose-400 transition-colors"
                >
                  <Unplug className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-slate-950 px-4 py-1.5 rounded-lg text-sm font-semibold shadow-lg shadow-teal-600/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4" />
                    <span>Connect Wallet</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Network Mismatch Alert Banner */}
      {isNetworkMismatch && (
        <div className="bg-amber-950/80 border-b border-amber-500/50 px-6 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Network Mismatch:</strong> Your wallet is currently on Chain ID{' '}
                <span className="font-mono font-bold text-amber-300">{walletChainId}</span>, but target network is{' '}
                <strong>{currentNetwork.networkName}</strong> (Chain ID {currentNetwork.chainId}).
              </span>
            </div>
            <button
              onClick={() => handleSwitchNetwork(selectedChainId)}
              disabled={isSwitchingNetwork}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              {isSwitchingNetwork ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Switch Wallet to {currentNetwork.shortName}
            </button>
          </div>
        </div>
      )}

      {/* Security Banner */}
      <div className="bg-teal-950/40 border-b border-teal-800/40 px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center gap-2.5 text-xs text-teal-200">
          <Lock className="w-4 h-4 text-teal-400 shrink-0" />
          <span>
            <strong>100% NON-CUSTODIAL SAFETY MODEL:</strong> Recurring payment schedules are deterministic rules.
            The agent never holds private keys. Due payments are prepared into unsigned EIP-155 transactions requiring explicit user approval or audited vault allowance enforcement.
          </span>
        </div>
      </div>

      {/* Live Connected Wallet Telemetry Bar */}
      <div className="bg-slate-900/40 border-b border-slate-800/60 px-6 py-2 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 font-mono">
          <div className="flex items-center gap-4">
            <span className="text-slate-400">
              Wallet Status:{' '}
              {account ? (
                <span className="text-emerald-400 font-bold">
                  Connected ({account.slice(0, 6)}...{account.slice(-4)})
                </span>
              ) : (
                <span className="text-slate-500">Not Connected</span>
              )}
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">
              Target RPC:{' '}
              <span className="text-teal-300 font-bold">{currentNetwork.networkName} ({currentNetwork.chainId})</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            {isLoadingBalance ? (
              <span className="text-teal-400 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Querying live RPC balances...
              </span>
            ) : account ? (
              <div className="flex items-center gap-3">
                <span className="text-slate-300">
                  Native ({currentNetwork.nativeCurrency.symbol}):{' '}
                  <span className="text-white font-bold">
                    {liveNativeBalance !== null ? fromBaseUnits(liveNativeBalance, 18) : '0'}
                  </span>
                </span>
                <span className="text-slate-300">
                  {activeTokenSymbol}:{' '}
                  <span className="text-teal-400 font-bold">
                    {liveTokenBalance !== null ? fromBaseUnits(liveTokenBalance, activeTokenDecimals) : '0'}
                  </span>
                </span>
                {isBytecodeVerified !== null && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded border ${
                      isBytecodeVerified
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    }`}
                  >
                    {isBytecodeVerified ? 'Bytecode Verified' : 'No Contract Bytecode'}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-slate-500">Connect wallet to view live balances</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto w-full px-6 py-8 flex-1 flex flex-col gap-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('DASHBOARD')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'DASHBOARD'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Dashboard & Radar</span>
          </button>
          <button
            onClick={() => setActiveTab('UPCOMING')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'UPCOMING'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Upcoming & Due ({dueItems.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('SCHEDULES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'SCHEDULES'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Manage Schedules ({schedules.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'HISTORY'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Payment History & Receipts ({history.length})</span>
          </button>
        </div>

        {/* Tab 1: Dashboard */}
        {activeTab === 'DASHBOARD' && (
          <div className="flex flex-col gap-6">
            <DashboardStats
              schedules={schedules}
              history={history}
              onRefresh={() => {
                setSchedules(loadSchedules());
                setHistory(loadPaymentHistory());
                refreshLiveBalances(account, selectedChainId, activeTokenSymbol);
              }}
            />

            {/* Quick Actions & Due Payment Spotlight */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-teal-400" />
                    Due Payments Requiring Execution
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">{dueItems.length} Due</span>
                </div>
                <UpcomingPayments
                  dueItems={dueItems}
                  upcomingItems={upcomingItems.slice(0, 3)}
                  onExecutePayment={handlePreparePayment}
                  isExecutingId={executingCycleKey}
                  account={account}
                />
              </div>

              {/* Verified Token Reference Panel */}
              <div className="lg:col-span-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Verified Tokens ({currentNetwork.shortName})
                  </h4>
                  <a
                    href={currentNetwork.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-teal-400 hover:underline flex items-center gap-1"
                  >
                    Explorer ↗
                  </a>
                </div>

                <div className="divide-y divide-slate-800/80 text-xs font-mono">
                  {currentNetwork.tokens.map((t) => (
                    <div key={t.symbol} className="py-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white">{t.symbol}</div>
                        <div className="text-[10px] text-slate-400">{t.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-teal-400 text-[11px]">
                          {t.isNative ? 'Native Asset' : `${t.address.slice(0, 6)}...${t.address.slice(-4)}`}
                        </div>
                        <div className="text-[10px] text-slate-500">{t.decimals} Decimals</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Upcoming & Due */}
        {activeTab === 'UPCOMING' && (
          <div className="flex flex-col gap-4">
            <UpcomingPayments
              dueItems={dueItems}
              upcomingItems={upcomingItems}
              onExecutePayment={handlePreparePayment}
              isExecutingId={executingCycleKey}
              account={account}
            />
          </div>
        )}

        {/* Tab 3: Schedules Management */}
        {activeTab === 'SCHEDULES' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Active Recurring Schedules</h3>
                <p className="text-xs text-slate-400">View, pause, resume, or cancel automated payment rules.</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>New Schedule</span>
              </button>
            </div>
            <ScheduleList
              schedules={schedules}
              onPause={handlePauseSchedule}
              onResume={handleResumeSchedule}
              onCancel={handleCancelSchedule}
              onOpenCreateModal={() => setIsCreateModalOpen(true)}
            />
          </div>
        )}

        {/* Tab 4: History & Receipts */}
        {activeTab === 'HISTORY' && (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-base font-bold text-white">Verified Payment History</h3>
              <p className="text-xs text-slate-400">Archived on-chain transaction receipts and detailed execution logs.</p>
            </div>
            <PaymentHistory history={history} />
          </div>
        )}
      </main>

      {/* Action Card Modal (When user clicks Execute Due Payment) */}
      {actionCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border-2 border-teal-500/40 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative flex flex-col gap-5">
            <button
              onClick={() => setActionCard(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between">
              <span className="text-xs px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-300 font-bold uppercase tracking-wider border border-teal-500/30">
                Review Recurring Execution
              </span>
              <span className="text-xs text-slate-400 font-mono">Cycle #{actionCard.cycleIndex}</span>
            </div>

            {/* Amount Spotlight */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Transfer Amount</div>
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {actionCard.amountFormatted}{' '}
                <span className="text-teal-400">{actionCard.tokenSymbol}</span>
              </div>
              <div className="text-xs text-slate-500 font-mono mt-1">
                Base Units: {actionCard.amountBaseUnits}
              </div>
            </div>

            {/* Details */}
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-800 font-mono">
                <span className="text-slate-400">Schedule:</span>
                <span className="text-white font-bold">{actionCard.scheduleTitle}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800 font-mono">
                <span className="text-slate-400">Recipient:</span>
                <span className="text-teal-300">
                  {actionCard.recipientAddress.slice(0, 10)}...{actionCard.recipientAddress.slice(-8)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800 font-mono">
                <span className="text-slate-400">Network:</span>
                <span className="text-slate-200">{actionCard.networkName} ({actionCard.chainId})</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800 font-mono">
                <span className="text-slate-400">Estimated Gas:</span>
                <span className="text-emerald-400">{actionCard.estimatedGasFee}</span>
              </div>
              <div className="flex items-center justify-between py-1 font-mono">
                <span className="text-slate-400">Idempotency Key:</span>
                <span className="text-slate-400 text-[10px] truncate max-w-[220px]" title={actionCard.idempotencyKey}>
                  {actionCard.idempotencyKey}
                </span>
              </div>
            </div>

            {/* Error banner if occurred */}
            {executionError && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-300">
                <strong>Execution Error:</strong> {executionError}
              </div>
            )}

            {/* Broadcast confirmation if completed */}
            {broadcastTxHash && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Transaction Broadcast Successfully!</span>
                </div>
                <div className="font-mono text-[10px] break-all text-slate-300">
                  Tx: {broadcastTxHash}
                </div>
              </div>
            )}

            {/* Unsigned Raw JSON Accordion */}
            <details className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono">
              <summary className="cursor-pointer text-slate-400 hover:text-slate-200 flex items-center justify-between font-semibold">
                <span className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-teal-400" />
                  Inspect Unsigned EIP-155 Transaction JSON
                </span>
                <span className="text-[10px] text-teal-400">View Payload</span>
              </summary>
              <div className="mt-3 pt-3 border-t border-slate-800 relative">
                <button
                  onClick={() => copyToClipboard(JSON.stringify(actionCard.unsignedTx, null, 2))}
                  className="absolute top-2 right-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded flex items-center gap-1"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <pre className="text-slate-300 text-[10px] overflow-x-auto leading-relaxed">
                  {JSON.stringify(actionCard.unsignedTx, null, 2)}
                </pre>
              </div>
            </details>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              {!account ? (
                <button
                  onClick={connectWallet}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-sm shadow-xl shadow-teal-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Wallet className="w-4 h-4" />
                  Connect Wallet to Sign Payment
                </button>
              ) : isNetworkMismatch ? (
                <button
                  onClick={() => handleSwitchNetwork(actionCard.chainId)}
                  disabled={isSwitchingNetwork}
                  className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSwitchingNetwork ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                  Switch Wallet to {currentNetwork.shortName} ({currentNetwork.chainId})
                </button>
              ) : (
                <button
                  onClick={handleExecuteInWallet}
                  disabled={executingCycleKey !== null}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {executingCycleKey !== null ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Awaiting Wallet Approval...</span>
                    </>
                  ) : (
                    <>
                      <Wallet className="w-4 h-4" />
                      <span>Sign & Send Payment in User Wallet</span>
                    </>
                  )}
                </button>
              )}
              <p className="text-[11px] text-center text-slate-500">
                Payment execution strictly delegates signing to your external wallet. The agent never signs autonomously.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Create Schedule Modal */}
      <CreateScheduleModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateSchedule}
        selectedChainId={selectedChainId}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 px-6 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <strong>Pharos PayPilot</strong> — Recurring Payment Agent for Subscriptions, Rent & Payroll
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <a href="https://github.com/JimmyOgb/pharos-recurring-payment-agent" target="_blank" rel="noreferrer" className="hover:text-teal-400">
              GitHub Repository
            </a>
            <span>•</span>
            <a href="https://docs.pharos.xyz" target="_blank" rel="noreferrer" className="hover:text-teal-400">
              Pharos Docs
            </a>
            <span>•</span>
            <a href="https://pharos-agent-arena.vercel.app" target="_blank" rel="noreferrer" className="hover:text-teal-400">
              Agent Arena
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

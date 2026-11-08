import React, { useState } from 'react';
import { X, Calendar, DollarSign, ShieldCheck, AlertCircle } from 'lucide-react';
import type { ScheduleFormInput, ScheduleFrequency, ExecutionMode } from '../types/schedule.ts';
import { getNetworkConfig } from '../config/networks.ts';
import { validateScheduleInput } from '../engine/scheduler.ts';

interface CreateScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: ScheduleFormInput) => void;
  selectedChainId: number;
}

export const CreateScheduleModal: React.FC<CreateScheduleModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  selectedChainId,
}) => {
  const currentNetwork = getNetworkConfig(selectedChainId);

  const [title, setTitle] = useState('');
  const [recipient, setRecipient] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState(currentNetwork.tokens[1]?.symbol || currentNetwork.tokens[0]?.symbol || 'USDC');
  const [amount, setAmount] = useState('100');
  const [frequency, setFrequency] = useState<ScheduleFrequency>('MONTHLY');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('USER_CONFIRMED');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: ScheduleFormInput = {
      title,
      recipient,
      tokenSymbol,
      amount,
      frequency,
      startDate: `${startDate}T00:00:00.000Z`,
      executionMode,
    };

    const validation = validateScheduleInput(input, selectedChainId);
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    setValidationErrors([]);
    onSubmit(input);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Create Recurring Payment Schedule</h2>
            <p className="text-xs text-slate-400">Target Network: {currentNetwork.networkName} ({selectedChainId})</p>
          </div>
        </div>

        {validationErrors.length > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Please resolve validation errors:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 pl-2">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
          {/* Title */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Schedule Name / Purpose</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Monthly Office Rent, Cloud Subscription, Contractor Payroll"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Recipient Address */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
              <span>Recipient Address (20-byte EVM hex)</span>
              <button
                type="button"
                onClick={() => setRecipient('0x70997970C51812dc3A010C7d01b50e0d17dc79C8')}
                className="text-[11px] text-teal-400 hover:underline"
              >
                Use Sample Account
              </button>
            </label>
            <input
              type="text"
              required
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 font-mono placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Token & Amount Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Verified Token</label>
              <select
                value={tokenSymbol}
                onChange={(e) => setTokenSymbol(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:border-teal-500 font-mono"
              >
                {currentNetwork.tokens.map((t) => (
                  <option key={t.symbol} value={t.symbol}>
                    {t.symbol} — {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Transfer Amount</label>
              <input
                type="number"
                step="any"
                min="0.000001"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 font-mono focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Cadence & Start Date Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Recurring Cadence</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as ScheduleFrequency)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:border-teal-500 font-semibold"
              >
                <option value="WEEKLY">Weekly (Every 7 Days)</option>
                <option value="MONTHLY">Monthly (Calendar Month)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Execution Mode */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
            <label className="text-slate-300 font-semibold">Execution & Authorization Model</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label
                className={`p-2.5 rounded-lg border cursor-pointer flex flex-col gap-1 ${
                  executionMode === 'USER_CONFIRMED'
                    ? 'border-teal-500 bg-teal-500/10 text-white'
                    : 'border-slate-800 bg-slate-900 text-slate-400'
                }`}
              >
                <input
                  type="radio"
                  name="executionMode"
                  value="USER_CONFIRMED"
                  checked={executionMode === 'USER_CONFIRMED'}
                  onChange={() => setExecutionMode('USER_CONFIRMED')}
                  className="sr-only"
                />
                <span className="font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                  User-Confirmed Queue
                </span>
                <span className="text-[10px] text-slate-400 leading-tight">
                  Prepares payment on due date; requires 1-click user wallet confirmation.
                </span>
              </label>

              <label
                className={`p-2.5 rounded-lg border cursor-pointer flex flex-col gap-1 ${
                  executionMode === 'VAULT_ALLOWANCE'
                    ? 'border-teal-500 bg-teal-500/10 text-white'
                    : 'border-slate-800 bg-slate-900 text-slate-400'
                }`}
              >
                <input
                  type="radio"
                  name="executionMode"
                  value="VAULT_ALLOWANCE"
                  checked={executionMode === 'VAULT_ALLOWANCE'}
                  onChange={() => setExecutionMode('VAULT_ALLOWANCE')}
                  className="sr-only"
                />
                <span className="font-bold flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-teal-400" />
                  Recurring Vault Allowance
                </span>
                <span className="text-[10px] text-slate-400 leading-tight">
                  Enforces interval & spending limit via audited smart contract.
                </span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-teal-500/20 transition-all cursor-pointer"
            >
              Confirm & Create Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

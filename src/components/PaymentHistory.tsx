import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, ExternalLink, ShieldCheck } from 'lucide-react';
import type { PaymentRecord } from '../types/schedule.ts';
import { getNetworkConfig } from '../config/networks.ts';
import { formatUtcDateTime } from '../engine/dateMath.ts';

interface PaymentHistoryProps {
  history: PaymentRecord[];
}

export const PaymentHistory: React.FC<PaymentHistoryProps> = ({ history }) => {
  if (history.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-10 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
        <ShieldCheck className="w-8 h-8 text-slate-600 stroke-1" />
        <span className="text-sm font-semibold text-slate-400">Zero Payment Records</span>
        <span className="text-xs text-slate-500">
          Payment executions, confirmations, and failure diagnostics will be logged here chronologically.
        </span>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Date (UTC)</th>
              <th className="py-3 px-4">Schedule / Cycle</th>
              <th className="py-3 px-4">Recipient</th>
              <th className="py-3 px-4">Amount</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Transaction Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {history.map((record) => {
              const net = getNetworkConfig(record.chainId);
              const dateToDisplay = record.executionDate || record.dueDate;

              return (
                <tr key={record.idempotencyKey} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                    {formatUtcDateTime(dateToDisplay)}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-sans font-bold text-white text-xs">{record.scheduleTitle}</div>
                    <div className="text-[10px] text-slate-500">Cycle #{record.cycleIndex}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <a
                      href={`${net.explorerUrl}/address/${record.recipient}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-teal-400 hover:underline"
                    >
                      {record.recipient.slice(0, 6)}...{record.recipient.slice(-4)}
                    </a>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="font-bold text-white text-sm">{record.amount}</span>{' '}
                    <span className="text-teal-400">{record.tokenSymbol}</span>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {record.status === 'PAID' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[10px]">
                        <CheckCircle2 className="w-3 h-3" /> PAID
                      </span>
                    ) : record.status === 'PENDING' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-[10px]">
                        <Clock className="w-3 h-3" /> PENDING
                      </span>
                    ) : (
                      <span
                        title={record.failureReason}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold text-[10px] cursor-help"
                      >
                        <AlertTriangle className="w-3 h-3" /> FAILED
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    {record.txHash ? (
                      <a
                        href={`${net.explorerUrl}/tx/${record.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-400 hover:underline flex items-center gap-1 text-[11px]"
                      >
                        <span>{record.txHash.slice(0, 8)}...{record.txHash.slice(-6)}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : record.failureReason ? (
                      <span className="text-rose-400/90 text-[11px] truncate max-w-[200px] block" title={record.failureReason}>
                        {record.failureReason}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

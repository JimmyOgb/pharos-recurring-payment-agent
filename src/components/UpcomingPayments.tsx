import React from 'react';
import { Clock, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import type { UpcomingPaymentItem } from '../types/schedule.ts';
import { formatUtcDateTime, getTimeDifferenceDescription } from '../engine/dateMath.ts';
import { getNetworkConfig } from '../config/networks.ts';

interface UpcomingPaymentsProps {
  dueItems: UpcomingPaymentItem[];
  upcomingItems: UpcomingPaymentItem[];
  onExecutePayment: (item: UpcomingPaymentItem) => Promise<void>;
  isExecutingId: string | null;
  account?: `0x${string}` | null;
}

export const UpcomingPayments: React.FC<UpcomingPaymentsProps> = ({
  dueItems,
  upcomingItems,
  onExecutePayment,
  isExecutingId,
  account: _account,
}) => {
  const allItems = [...dueItems, ...upcomingItems];

  if (allItems.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-10 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
        <Clock className="w-8 h-8 text-slate-600 stroke-1" />
        <span className="text-sm font-semibold text-slate-400">No Upcoming Payments</span>
        <span className="text-xs text-slate-500">Active recurring schedules will display upcoming execution cycles here.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Due Payments Section (High Priority) */}
      {dueItems.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Payments Ready for Execution ({dueItems.length} Due)</span>
          </div>

          {dueItems.map((item) => {
            const net = getNetworkConfig(item.schedule.chainId);
            const isProcessing = isExecutingId === item.idempotencyKey;

            return (
              <div
                key={item.idempotencyKey}
                className="bg-amber-950/20 border-2 border-amber-500/40 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold uppercase tracking-wider">
                      Due Now
                    </span>
                    <h4 className="text-base font-bold text-white">{item.schedule.title}</h4>
                    <span className="text-xs font-mono text-slate-400">Cycle #{item.cycleIndex}</span>
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 text-xs font-mono text-slate-400 flex-wrap">
                    <span>
                      Recipient:{' '}
                      <span className="text-teal-300">
                        {item.schedule.recipient.slice(0, 6)}...{item.schedule.recipient.slice(-4)}
                      </span>
                    </span>
                    <span>•</span>
                    <span>Due Date: {formatUtcDateTime(item.dueDate)}</span>
                    <span>•</span>
                    <span>Network: {net.networkName}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-2xl font-extrabold text-white">
                      {item.schedule.amount}{' '}
                      <span className="text-amber-400">{item.schedule.tokenSymbol}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {item.schedule.frequency} Cadence
                    </div>
                  </div>

                  <button
                    onClick={() => onExecutePayment(item)}
                    disabled={isProcessing}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer shrink-0"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Processing Cycle...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Execute Due Payment</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Future Upcoming Payments */}
      {upcomingItems.length > 0 && (
        <div className="flex flex-col gap-2.5 mt-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Future Scheduled Cycles ({upcomingItems.length})
          </div>

          <div className="divide-y divide-slate-800/80 bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
            {upcomingItems.map((item) => {
              const net = getNetworkConfig(item.schedule.chainId);

              return (
                <div
                  key={item.idempotencyKey}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shrink-0 mt-0.5">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{item.schedule.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          Cycle #{item.cycleIndex}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        To: {item.schedule.recipient.slice(0, 6)}...{item.schedule.recipient.slice(-4)} • {net.shortName}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 text-right font-mono">
                    <div>
                      <div className="text-sm font-bold text-white">
                        {item.schedule.amount} {item.schedule.tokenSymbol}
                      </div>
                      <div className="text-[11px] text-sky-400">
                        {getTimeDifferenceDescription(item.dueDate)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

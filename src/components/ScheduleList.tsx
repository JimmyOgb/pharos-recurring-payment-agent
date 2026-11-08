import React from 'react';
import { Calendar, Play, Pause, Trash2 } from 'lucide-react';
import type { RecurringSchedule } from '../types/schedule.ts';
import { getNetworkConfig } from '../config/networks.ts';
import { formatUtcDateTime, getTimeDifferenceDescription } from '../engine/dateMath.ts';

interface ScheduleListProps {
  schedules: RecurringSchedule[];
  onPause: (scheduleId: string) => void;
  onResume: (scheduleId: string) => void;
  onCancel: (scheduleId: string) => void;
  onOpenCreateModal: () => void;
}

export const ScheduleList: React.FC<ScheduleListProps> = ({
  schedules,
  onPause,
  onResume,
  onCancel,
  onOpenCreateModal,
}) => {
  if (schedules.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-500">
          <Calendar className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white">No Recurring Payment Schedules Found</h3>
        <p className="text-xs text-slate-400 max-w-sm">
          Set up a recurring schedule for rent, recurring subscriptions, or repeating payroll transfers with automatic due-date preparation.
        </p>
        <button
          onClick={onOpenCreateModal}
          className="mt-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer"
        >
          Create First Schedule
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {schedules.map((schedule) => {
        const net = getNetworkConfig(schedule.chainId);

        return (
          <div
            key={schedule.id}
            className={`bg-slate-900/80 border rounded-2xl p-5 shadow-lg transition-all ${
              schedule.status === 'ACTIVE'
                ? 'border-slate-800 hover:border-slate-700'
                : 'border-slate-800/60 opacity-75'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Left Column: Title & Cadence */}
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    schedule.status === 'ACTIVE'
                      ? 'bg-teal-500/10 border border-teal-500/30 text-teal-400'
                      : 'bg-slate-800 border border-slate-700 text-slate-500'
                  }`}
                >
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-bold text-white tracking-tight">{schedule.title}</h4>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        schedule.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                          : schedule.status === 'PAUSED'
                          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {schedule.status}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                      {schedule.frequency}
                    </span>
                  </div>

                  {/* Recipient and Token details */}
                  <div className="flex items-center gap-3 mt-1.5 text-xs font-mono text-slate-400">
                    <span>
                      To:{' '}
                      <a
                        href={`${net.explorerUrl}/address/${schedule.recipient}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-teal-400 hover:underline"
                      >
                        {schedule.recipient.slice(0, 6)}...{schedule.recipient.slice(-4)}
                      </a>
                    </span>
                    <span>•</span>
                    <span>Chain: {net.shortName} ({schedule.chainId})</span>
                    <span>•</span>
                    <span>Mode: {schedule.executionMode === 'USER_CONFIRMED' ? 'User-Confirmed' : 'Vault Allowance'}</span>
                  </div>
                </div>
              </div>

              {/* Middle Column: Amount */}
              <div className="text-left md:text-right">
                <div className="text-xl font-extrabold text-white tracking-tight">
                  {schedule.amount} <span className="text-teal-400">{schedule.tokenSymbol}</span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5 font-mono">
                  Cycle #{schedule.currentCycleIndex} • Paid: {schedule.totalPaidCount} cycles
                </div>
              </div>

              {/* Right Column: Actions */}
              <div className="flex items-center gap-2 self-start md:self-center border-t md:border-t-0 pt-3 md:pt-0 border-slate-800">
                {schedule.status === 'ACTIVE' ? (
                  <button
                    onClick={() => onPause(schedule.id)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1 transition-colors"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    Pause
                  </button>
                ) : schedule.status === 'PAUSED' ? (
                  <button
                    onClick={() => onResume(schedule.id)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Resume
                  </button>
                ) : null}

                {schedule.status !== 'CANCELLED' && (
                  <button
                    onClick={() => onCancel(schedule.id)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 rounded-lg text-xs font-medium border border-slate-700 hover:border-rose-500/40 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Bottom info footer */}
            <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
              <span>Next Due: {formatUtcDateTime(schedule.nextDueDate)}</span>
              <span className="text-sky-400 font-semibold">{getTimeDifferenceDescription(schedule.nextDueDate)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

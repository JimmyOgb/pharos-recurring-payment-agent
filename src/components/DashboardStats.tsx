import React from 'react';
import { Calendar, Clock, CheckCircle2, RefreshCw } from 'lucide-react';
import type { RecurringSchedule, PaymentRecord } from '../types/schedule.ts';
import { getTimeDifferenceDescription } from '../engine/dateMath.ts';

interface DashboardStatsProps {
  schedules: RecurringSchedule[];
  history: PaymentRecord[];
  onRefresh: () => void;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ schedules, history, onRefresh }) => {
  const activeSchedules = schedules.filter((s) => s.status === 'ACTIVE');
  const paidCount = history.filter((p) => p.status === 'PAID').length;
  const pendingCount = history.filter((p) => p.status === 'PENDING').length;
  const failedCount = history.filter((p) => p.status === 'FAILED').length;

  // Next upcoming payment calculation
  const nextSchedule = [...activeSchedules].sort(
    (a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime()
  )[0];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Active Schedules */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Schedules</span>
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl font-extrabold text-white tracking-tight">{activeSchedules.length}</div>
          <div className="text-xs text-slate-400 mt-1">
            {schedules.length - activeSchedules.length} paused or completed
          </div>
        </div>
      </div>

      {/* Next Due Payment */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Next Due Payment</span>
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          {nextSchedule ? (
            <>
              <div className="text-lg font-bold text-white truncate">{nextSchedule.title}</div>
              <div className="text-xs text-sky-400 font-mono mt-0.5">
                {getTimeDifferenceDescription(nextSchedule.nextDueDate)}
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500 py-1">No active payments scheduled</div>
          )}
        </div>
      </div>

      {/* Verified Paid Count & Volume */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Verified Executions</span>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl font-extrabold text-white tracking-tight">{paidCount}</div>
          <div className="text-xs text-slate-400 mt-1">
            Confirmed on-chain receipts
          </div>
        </div>
      </div>

      {/* Status Breakdown (Pending / Failed) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Exceptions & Pending</span>
          <button
            onClick={onRefresh}
            title="Refresh Ledger"
            className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 hover:border-teal-500/50 flex items-center justify-center text-slate-400 hover:text-teal-300 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs font-mono">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Pending</span>
            <span className={`text-base font-bold ${pendingCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
              {pendingCount}
            </span>
          </div>
          <div className="border-l border-slate-800 pl-4">
            <span className="text-slate-400 block text-[10px] uppercase">Failed</span>
            <span className={`text-base font-bold ${failedCount > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
              {failedCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

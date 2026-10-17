import React from 'react';
import { AlertCircle, Clock, CheckCircle2, UserCheck, Flame, Users } from 'lucide-react';

export default function MetricsHeader({ summary, currentUser, onSelectFilter }) {
  if (!summary) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      
      {/* P0 Critical Incidents */}
      <div 
        onClick={() => onSelectFilter({ priority: 'P0_CRITICAL', status: '' })}
        className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
          summary.criticalP0 > 0 
            ? 'bg-rose-950/40 border-rose-800/80 hover:border-rose-600 shadow-sm shadow-rose-900/20' 
            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
            <Flame className={`w-3.5 h-3.5 ${summary.criticalP0 > 0 ? 'animate-bounce text-rose-400' : ''}`} />
            P0 Critical
          </span>
          <span className="text-xl font-bold text-white">{summary.criticalP0}</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">Immediate action needed</p>
      </div>

      {/* Pending Approval */}
      <div 
        onClick={() => onSelectFilter({ status: 'PENDING_APPROVAL', priority: '' })}
        className="cursor-pointer p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-700/80 transition-all"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Pending Sign-Off
          </span>
          <span className="text-xl font-bold text-amber-400">{summary.pendingApproval}</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">Awaiting Lead / Admin review</p>
      </div>

      {/* Unassigned Work Items */}
      <div 
        onClick={() => onSelectFilter({ assigneeId: 'unassigned', status: '' })}
        className="cursor-pointer p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-sky-700/80 transition-all"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5" />
            Unassigned
          </span>
          <span className="text-xl font-bold text-white">{summary.unassigned}</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">Needs an owner assigned</p>
      </div>

      {/* My Team Workload */}
      <div 
        onClick={() => onSelectFilter({ teamId: currentUser?.teams?.[0]?.team_id || '', status: '' })}
        className="cursor-pointer p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-700/80 transition-all"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            My Team Active
          </span>
          <span className="text-xl font-bold text-white">{summary.myTeamWorkload}</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          {currentUser?.teams?.map(t => t.team_name).join(', ') || 'Your teams'}
        </p>
      </div>

      {/* Total Active Items */}
      <div 
        onClick={() => onSelectFilter({ status: '', priority: '', teamId: '', assigneeId: '' })}
        className="cursor-pointer p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all col-span-2 md:col-span-1"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
            Total Active
          </span>
          <span className="text-xl font-bold text-white">{summary.totalActive}</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">Open & Investigating items</p>
      </div>

    </div>
  );
}

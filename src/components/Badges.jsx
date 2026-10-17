import React from 'react';
import { AlertCircle, Clock, CheckCircle2, ShieldAlert, AlertTriangle, Check, XCircle } from 'lucide-react';

export function PriorityBadge({ priority }) {
  switch (priority) {
    case 'P0_CRITICAL':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 animate-ping"></span>
          P0 CRITICAL
        </span>
      );
    case 'P1_HIGH':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
          P1 HIGH
        </span>
      );
    case 'P2_MEDIUM':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-sky-500/15 text-sky-400 border border-sky-500/30">
          P2 MEDIUM
        </span>
      );
    case 'P3_LOW':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-500/15 text-slate-400 border border-slate-500/30">
          P3 LOW
        </span>
      );
    default:
      return <span className="text-xs text-slate-400">{priority}</span>;
  }
}

export function StatusBadge({ status }) {
  switch (status) {
    case 'OPEN':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
          Open
        </span>
      );
    case 'INVESTIGATING':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
          Investigating
        </span>
      );
    case 'PENDING_APPROVAL':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <Clock className="w-3 h-3 mr-1" />
          Pending Approval
        </span>
      );
    case 'BLOCKED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/15 text-rose-400 border border-rose-500/30">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Blocked
        </span>
      );
    case 'RESOLVED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <Check className="w-3 h-3 mr-1" />
          Resolved
        </span>
      );
    case 'CLOSED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-700 text-slate-300">
          Closed
        </span>
      );
    default:
      return <span>{status}</span>;
  }
}

export function TypeBadge({ type }) {
  const formatName = (t) => {
    switch (t) {
      case 'PRODUCTION_INCIDENT': return 'Production Incident';
      case 'PAYMENT_INVESTIGATION': return 'Payment Investigation';
      case 'COMPLIANCE_REQUEST': return 'Compliance Request';
      case 'CUSTOMER_ISSUE': return 'Customer Escalation';
      case 'OPERATIONAL_APPROVAL': return 'Operational Approval';
      case 'ENGINEERING_BUG': return 'Engineering Bug';
      default: return t;
    }
  };

  return (
    <span className="text-[11px] font-medium text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
      {formatName(type)}
    </span>
  );
}

export function TeamBadge({ name, color }) {
  return (
    <span 
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border"
      style={{
        backgroundColor: `${color || '#3b82f6'}15`,
        color: color || '#3b82f6',
        borderColor: `${color || '#3b82f6'}35`
      }}
    >
      {name}
    </span>
  );
}

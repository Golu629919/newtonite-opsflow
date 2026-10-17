import React from 'react';
import { Search, Filter, RotateCcw } from 'lucide-react';

export default function FilterBar({ 
  filters, 
  onFilterChange, 
  teams, 
  users, 
  onResetFilters 
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 mb-6 shadow-sm">
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Search input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by ID, title, problem, next action..."
            value={filters.search || ''}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
          
          {/* Team Filter */}
          <select
            value={filters.teamId || ''}
            onChange={(e) => onFilterChange('teamId', e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500 cursor-pointer"
          >
            <option value="">All Teams</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filters.status || ''}
            onChange={(e) => onFilterChange('status', e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="BLOCKED">Blocked</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          {/* Priority Filter */}
          <select
            value={filters.priority || ''}
            onChange={(e) => onFilterChange('priority', e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500 cursor-pointer"
          >
            <option value="">All Priorities</option>
            <option value="P0_CRITICAL">P0 Critical</option>
            <option value="P1_HIGH">P1 High</option>
            <option value="P2_MEDIUM">P2 Medium</option>
            <option value="P3_LOW">P3 Low</option>
          </select>

          {/* Type Filter */}
          <select
            value={filters.type || ''}
            onChange={(e) => onFilterChange('type', e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500 cursor-pointer"
          >
            <option value="">All Categories</option>
            <option value="PRODUCTION_INCIDENT">Production Incident</option>
            <option value="PAYMENT_INVESTIGATION">Payment Investigation</option>
            <option value="COMPLIANCE_REQUEST">Compliance Request</option>
            <option value="CUSTOMER_ISSUE">Customer Escalation</option>
            <option value="OPERATIONAL_APPROVAL">Operational Approval</option>
            <option value="ENGINEERING_BUG">Engineering Bug</option>
          </select>

          {/* Assignee Filter */}
          <select
            value={filters.assigneeId || ''}
            onChange={(e) => onFilterChange('assigneeId', e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500 cursor-pointer"
          >
            <option value="">All Assignees</option>
            <option value="unassigned">Unassigned Only</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          {/* Reset Filters */}
          <button
            onClick={onResetFilters}
            title="Reset Filters"
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>

      </div>
    </div>
  );
}

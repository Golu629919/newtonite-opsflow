import React from 'react';
import { PriorityBadge, TypeBadge } from './Badges';
import { Clock, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';

const COLUMNS = [
  { id: 'OPEN', label: 'Open', color: 'border-blue-500/40 text-blue-400 bg-blue-950/20' },
  { id: 'INVESTIGATING', label: 'Investigating', color: 'border-indigo-500/40 text-indigo-400 bg-indigo-950/20' },
  { id: 'PENDING_APPROVAL', label: 'Pending Approval', color: 'border-amber-500/40 text-amber-400 bg-amber-950/20' },
  { id: 'BLOCKED', label: 'Blocked', color: 'border-rose-500/40 text-rose-400 bg-rose-950/20' },
  { id: 'RESOLVED', label: 'Resolved', color: 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20' }
];

export default function WorkItemKanban({ items, onSelectItem }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
      {COLUMNS.map(col => {
        const colItems = (items || []).filter(i => i.status === col.id);

        return (
          <div key={col.id} className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col min-h-[500px]">
            
            {/* Column Header */}
            <div className={`p-3 border-b rounded-t-xl flex items-center justify-between ${col.color}`}>
              <span className="text-xs font-bold tracking-wide uppercase">{col.label}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-900/80 font-mono font-semibold">
                {colItems.length}
              </span>
            </div>

            {/* Cards List */}
            <div className="p-3 flex-1 flex flex-col gap-3 overflow-y-auto max-h-[700px]">
              {colItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => onSelectItem(item.id)}
                  className="bg-slate-950/80 border border-slate-800 hover:border-sky-500/60 p-3 rounded-lg cursor-pointer transition-all hover:shadow-md group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[10px] font-bold text-sky-400 bg-sky-950 px-1.5 py-0.5 rounded border border-sky-900">
                      {item.id}
                    </span>
                    <PriorityBadge priority={item.priority} />
                  </div>

                  <h4 className="text-xs font-medium text-slate-200 group-hover:text-sky-300 transition-colors line-clamp-2 mb-2">
                    {item.title}
                  </h4>

                  {/* Next Action Callout */}
                  <div className="bg-slate-900/90 border border-slate-800 p-2 rounded text-[11px] text-slate-300 mb-2.5">
                    <span className="text-amber-400 text-[10px] font-semibold block uppercase tracking-wider mb-0.5">
                      Next Attention:
                    </span>
                    <p className="line-clamp-2 leading-relaxed">{item.next_action}</p>
                  </div>

                  {/* Footer with Assignee & Version */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/60 pt-2">
                    <div className="flex items-center space-x-1.5">
                      {item.assignee_name ? (
                        <span className="truncate max-w-[100px] text-slate-300">{item.assignee_name}</span>
                      ) : (
                        <span className="italic text-slate-500">Unassigned</span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">v{item.version}</span>
                  </div>

                </div>
              ))}

              {colItems.length === 0 && (
                <div className="text-center py-10 text-xs text-slate-600 italic">
                  No items in this state
                </div>
              )}
            </div>

          </div>
        );
      })}
    </div>
  );
}

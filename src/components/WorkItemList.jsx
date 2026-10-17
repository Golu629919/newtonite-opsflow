import React from 'react';
import { PriorityBadge, StatusBadge, TypeBadge, TeamBadge } from './Badges';
import { UserCheck, Clock, ArrowRight, ChevronLeft, ChevronRight, AlertCircle, Sparkles } from 'lucide-react';

export default function WorkItemList({ 
  items, 
  pagination, 
  onPageChange, 
  onSelectItem, 
  onClaimItem, 
  currentUser 
}) {
  if (!items || items.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
        <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-slate-300">No operational work items found</h3>
        <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or search criteria, or create a new ticket.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      
      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4">Ticket</th>
              <th className="py-3 px-4">Type & Team</th>
              <th className="py-3 px-4">State & Importance</th>
              <th className="py-3 px-4">Next Required Attention</th>
              <th className="py-3 px-4">Assignee</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {items.map((item) => {
              const isMine = item.assignee_id === currentUser?.id;
              const isUnassigned = !item.assignee_id;
              const isMyTeam = currentUser?.teams?.some(t => t.team_id === item.team_id);

              return (
                <tr 
                  key={item.id}
                  onClick={() => onSelectItem(item.id)}
                  className="hover:bg-slate-850/80 transition-colors cursor-pointer group"
                >
                  
                  {/* Ticket ID & Title */}
                  <td className="py-3 px-4 max-w-xs">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-[11px] font-bold text-sky-400 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-900/60">
                        {item.id}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">v{item.version}</span>
                    </div>
                    <div className="font-medium text-slate-200 mt-1 group-hover:text-sky-300 transition-colors truncate">
                      {item.title}
                    </div>
                  </td>

                  {/* Type & Team */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1 items-start">
                      <TeamBadge name={item.team_name} color={item.team_color} />
                      <TypeBadge type={item.type} />
                    </div>
                  </td>

                  {/* State & Priority */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1 items-start">
                      <PriorityBadge priority={item.priority} />
                      <StatusBadge status={item.status} />
                    </div>
                  </td>

                  {/* What requires attention next */}
                  <td className="py-3 px-4 max-w-sm">
                    <div className="text-slate-300 bg-slate-950/70 p-2 rounded-lg border border-slate-800 text-[11px] leading-relaxed">
                      <span className="text-amber-400/90 font-semibold mr-1.5">Next:</span>
                      <span className="line-clamp-2">{item.next_action}</span>
                    </div>
                  </td>

                  {/* Assignee */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {item.assignee_name ? (
                      <div className="flex items-center space-x-2">
                        {item.assignee_avatar ? (
                          <img 
                            src={item.assignee_avatar} 
                            alt={item.assignee_name} 
                            className="w-5 h-5 rounded-full object-cover border border-slate-700" 
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-slate-300">
                            {item.assignee_name.charAt(0)}
                          </div>
                        )}
                        <span className={`text-xs ${isMine ? 'font-semibold text-sky-400' : 'text-slate-300'}`}>
                          {item.assignee_name} {isMine && '(You)'}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center text-xs text-slate-500 italic">
                        Unassigned
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                      {isUnassigned && isMyTeam && currentUser?.role !== 'viewer' ? (
                        <button
                          onClick={() => onClaimItem(item.id, item.version)}
                          className="flex items-center space-x-1 px-2.5 py-1 rounded bg-sky-600/20 hover:bg-sky-600 text-sky-400 hover:text-white border border-sky-500/40 text-[11px] font-medium transition-all"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Claim</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onSelectItem(item.id)}
                          className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination && (
        <div className="border-t border-slate-800 px-4 py-3 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <span className="text-slate-200 font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
            <span className="text-slate-200 font-medium">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span> of <span className="text-slate-200 font-medium">{pagination.total}</span> tickets
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
              className="p-1.5 rounded border border-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
              className="p-1.5 rounded border border-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

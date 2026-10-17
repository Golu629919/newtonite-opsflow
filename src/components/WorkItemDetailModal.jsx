import React, { useState } from 'react';
import { PriorityBadge, StatusBadge, TypeBadge, TeamBadge } from './Badges';
import { 
  X, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Send, 
  UserCheck, 
  UserPlus, 
  FileText, 
  Activity, 
  MessageSquare, 
  Cpu, 
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  HelpCircle
} from 'lucide-react';

export default function WorkItemDetailModal({
  item,
  onClose,
  currentUser,
  users,
  onClaim,
  onAssign,
  onTransition,
  onRequestApproval,
  onDecideApproval,
  onAddComment,
  onRefresh,
  isStale
}) {
  if (!item) return null;

  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline', 'comments', 'outbox'
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Status transition form state
  const [targetStatus, setTargetStatus] = useState(item.status);
  const [transitionNote, setTransitionNote] = useState('');
  const [blockedReason, setBlockedReason] = useState(item.blocked_reason || '');
  const [nextActionInput, setNextActionInput] = useState(item.next_action || '');
  const [showTransitionDialog, setShowTransitionDialog] = useState(false);

  // Approval form state
  const [approvalNote, setApprovalNote] = useState('');
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);

  // Reassignment state
  const [selectedAssignee, setSelectedAssignee] = useState(item.assignee_id || '');

  const isViewer = currentUser?.role === 'viewer';
  const isMine = item.assignee_id === currentUser?.id;
  const isMyTeam = currentUser?.teams?.some(t => t.team_id === item.team_id);
  const isLead = currentUser?.teams?.some(t => t.team_id === item.team_id && t.team_role === 'lead') || currentUser?.role === 'admin';
  const isComplianceLead = currentUser?.teams?.some(t => t.team_id === 'team-compliance' && t.team_role === 'lead') || currentUser?.role === 'admin';

  // Can approve?
  const canApprove = item.type === 'COMPLIANCE_REQUEST' ? isComplianceLead : isLead;

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setIsSubmittingComment(true);
    try {
      await onAddComment(item.id, commentText.trim(), true);
      setCommentText('');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleExecuteTransition = () => {
    onTransition(item.id, targetStatus, item.version, {
      note: transitionNote,
      blocked_reason: blockedReason,
      next_action: nextActionInput
    });
    setShowTransitionDialog(false);
  };

  const handleExecuteApproval = (decision) => {
    onDecideApproval(item.id, decision, approvalNote, item.version);
    setShowApprovalDialog(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Stale Warning Banner (Real-time concurrency alert) */}
        {isStale && (
          <div className="bg-amber-950/90 border-b border-amber-700/80 px-4 py-2.5 flex items-center justify-between text-amber-200 text-xs">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
              <span><strong>Notice:</strong> Another operator modified this work item while you were viewing it!</span>
            </div>
            <button
              onClick={() => onRefresh(item.id)}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-600/40 hover:bg-amber-600 text-amber-100 border border-amber-500 font-semibold transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload Latest</span>
            </button>
          </div>
        )}

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-start justify-between bg-slate-950/40">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                {item.id}
              </span>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                Version {item.version}
              </span>
              <PriorityBadge priority={item.priority} />
              <StatusBadge status={item.status} />
              <TeamBadge name={item.team_name} color={item.team_color} />
              <TypeBadge type={item.type} />
            </div>
            <h2 className="text-lg font-bold text-slate-100 tracking-tight leading-snug">
              {item.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="px-6 py-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Claim button */}
            {!item.assignee_id && isMyTeam && !isViewer && (
              <button
                onClick={() => onClaim(item.id, item.version)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow-sm transition-all"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Claim Responsibility</span>
              </button>
            )}

            {/* Reassign dropdown */}
            {!isViewer && (isLead || isMine) && (
              <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
                <UserPlus className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedAssignee}
                  onChange={(e) => {
                    setSelectedAssignee(e.target.value);
                    onAssign(item.id, e.target.value, item.version);
                  }}
                  className="bg-transparent text-slate-200 text-xs outline-none cursor-pointer"
                >
                  <option value="" className="bg-slate-900">Unassigned</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id} className="bg-slate-900">{u.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Transition status button */}
            {!isViewer && (
              <button
                onClick={() => {
                  setTargetStatus(item.status);
                  setShowTransitionDialog(true);
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition-all"
              >
                <span>Transition Status...</span>
              </button>
            )}

            {/* Request Approval Button */}
            {!isViewer && item.requires_approval && item.approval_status === 'NONE' && (
              <button
                onClick={() => setShowApprovalDialog(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-600/30 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/50 font-semibold transition-all"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Request Formal Approval</span>
              </button>
            )}

            {/* Approval Decision for Leads/Admin */}
            {item.approval_status === 'REQUESTED' && (
              <div className="flex items-center space-x-2">
                {canApprove ? (
                  <>
                    <button
                      onClick={() => handleExecuteApproval('APPROVED')}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all shadow-sm"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Sign Off (Approve)</span>
                    </button>
                    <button
                      onClick={() => handleExecuteApproval('REJECTED')}
                      className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-rose-600/40 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/50 font-medium transition-all"
                    >
                      <span>Reject</span>
                    </button>
                  </>
                ) : (
                  <span className="text-[11px] text-amber-400 bg-amber-950/60 px-2.5 py-1 rounded border border-amber-800/80">
                    Awaiting {item.type === 'COMPLIANCE_REQUEST' ? 'Compliance Lead' : 'Team Lead'} Sign-Off
                  </span>
                )}
              </div>
            )}

          </div>

          {/* Current Assignee Label */}
          <div className="text-slate-400 text-xs">
            Responsible: <strong className="text-slate-200">{item.assignee_name || 'Unassigned'}</strong>
          </div>

        </div>

        {/* Modal Body: Two column layout */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Left 2 Cols: Core Work Item Details */}
          <div className="md:col-span-2 space-y-5">
            
            {/* NEXT REQUIRED ACTION CALLOUT (CRITICAL BRIEF REQUIREMENT) */}
            <div className="bg-gradient-to-r from-amber-950/50 to-slate-900 border border-amber-600/40 rounded-xl p-4 shadow-sm">
              <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1.5">
                <AlertCircle className="w-4 h-4" />
                <span>What Requires Attention Next:</span>
              </div>
              <p className="text-slate-200 text-sm leading-relaxed font-medium">
                {item.next_action}
              </p>
              {item.blocked_reason && (
                <div className="mt-2 pt-2 border-t border-amber-800/40 text-rose-300 text-xs">
                  <strong>Blocked Reason:</strong> {item.blocked_reason}
                </div>
              )}
            </div>

            {/* WHAT THIS ITEM IS AND WHY IT EXISTS (CRITICAL BRIEF REQUIREMENT) */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                Why This Item Exists (Problem Context)
              </h4>
              <p className="text-slate-300 text-xs leading-relaxed whitespace-pre-line">
                {item.why_it_exists}
              </p>
            </div>

            {/* CURRENT STATE SUMMARY */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-indigo-400" />
                Current Investigation State
              </h4>
              <p className="text-slate-300 text-xs leading-relaxed whitespace-pre-line">
                {item.current_state_summary || 'No detailed investigation notes recorded yet.'}
              </p>
            </div>

            {/* FORMAL APPROVAL STATUS BOX */}
            {item.requires_approval === 1 && (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  Workflow Approval Status
                </h4>
                <div className="flex items-center space-x-2 text-xs">
                  <span className={`px-2 py-0.5 rounded font-semibold ${
                    item.approval_status === 'APPROVED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                    item.approval_status === 'REJECTED' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                    item.approval_status === 'REQUESTED' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {item.approval_status}
                  </span>
                  {item.approved_by && (
                    <span className="text-slate-400">
                      by <strong>{item.approver_name}</strong>
                    </span>
                  )}
                </div>
                {item.approval_note && (
                  <p className="text-xs text-slate-400 mt-2 italic bg-slate-900 p-2 rounded border border-slate-800">
                    "{item.approval_note}"
                  </p>
                )}
              </div>
            )}

          </div>

          {/* Right Column: Tabbed Timeline, Collaboration Notes & Outbox */}
          <div className="flex flex-col bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden min-h-[420px]">
            
            {/* Tabs Header */}
            <div className="flex border-b border-slate-800 bg-slate-900 text-xs font-medium">
              <button
                onClick={() => setActiveTab('timeline')}
                className={`flex-1 py-2.5 text-center transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === 'timeline' ? 'text-sky-400 border-b-2 border-sky-400 bg-slate-950/40 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>History ({item.activity?.length || 0})</span>
              </button>

              <button
                onClick={() => setActiveTab('comments')}
                className={`flex-1 py-2.5 text-center transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === 'comments' ? 'text-sky-400 border-b-2 border-sky-400 bg-slate-950/40 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Notes ({item.comments?.length || 0})</span>
              </button>

              <button
                onClick={() => setActiveTab('outbox')}
                className={`flex-1 py-2.5 text-center transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === 'outbox' ? 'text-sky-400 border-b-2 border-sky-400 bg-slate-950/40 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Outbox ({item.outboxJobs?.length || 0})</span>
              </button>
            </div>

            {/* Tab 1: Audit History Timeline */}
            {activeTab === 'timeline' && (
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {(item.activity || []).map((act) => (
                  <div key={act.id} className="relative pl-5 pb-3 border-l-2 border-slate-800 last:border-transparent text-xs">
                    <span className="absolute -left-[5px] top-0.5 w-2 h-2 rounded-full bg-sky-500 ring-4 ring-slate-950"></span>
                    <div className="flex items-center justify-between text-slate-400 mb-0.5">
                      <strong className="text-slate-200">{act.actor_name}</strong>
                      <span className="text-[10px] text-slate-500">
                        {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-300 font-medium">{act.note || act.action_type}</p>
                    {act.from_value && act.to_value && (
                      <div className="text-[10px] text-slate-500 mt-1 font-mono">
                        {act.from_value} &rarr; {act.to_value}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Tab 2: Collaboration Comments Feed */}
            {activeTab === 'comments' && (
              <div className="flex-1 flex flex-col h-full">
                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                  {(item.comments || []).map((c) => (
                    <div key={c.id} className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-200">{c.author_name}</span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-300 leading-relaxed">{c.message}</p>
                    </div>
                  ))}
                  {(!item.comments || item.comments.length === 0) && (
                    <div className="text-center py-8 text-xs text-slate-600">
                      No investigation comments yet.
                    </div>
                  )}
                </div>

                {/* Comment Input */}
                {!isViewer && (
                  <form onSubmit={handlePostComment} className="p-3 border-t border-slate-800 bg-slate-900 flex gap-2">
                    <input
                      type="text"
                      placeholder="Add investigation note..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                    <button
                      type="submit"
                      disabled={isSubmittingComment || !commentText.trim()}
                      className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white font-medium text-xs flex items-center gap-1 transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Tab 3: Outbox Background Jobs */}
            {activeTab === 'outbox' && (
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {(item.outboxJobs || []).map((job) => (
                  <div key={job.id} className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] font-bold text-slate-300">{job.event_type}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        job.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400' :
                        job.status === 'RETRYING' ? 'bg-amber-950 text-amber-400' :
                        job.status === 'DEAD_LETTER' ? 'bg-rose-950 text-rose-400' : 'bg-blue-950 text-blue-400'
                      }`}>
                        {job.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Attempts: {job.retry_count} / {job.max_retries}
                    </div>
                    {job.last_error && (
                      <div className="text-[10px] text-rose-400 mt-1 font-mono bg-rose-950/40 p-1 rounded">
                        {job.last_error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

          </div>

        </div>

        {/* Transition Status Dialog Modal */}
        {showTransitionDialog && (
          <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-sky-400" />
                Transition Workflow State
              </h3>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">New State</label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none"
                >
                  <option value="OPEN">Open (Backlog)</option>
                  <option value="INVESTIGATING">Investigating (In Progress)</option>
                  <option value="PENDING_APPROVAL">Pending Formal Approval</option>
                  <option value="BLOCKED">Blocked (Requires Blocker Reason)</option>
                  <option value="RESOLVED">Resolved (Work Completed)</option>
                  <option value="CLOSED">Closed (Archived)</option>
                </select>
              </div>

              {targetStatus === 'BLOCKED' && (
                <div>
                  <label className="text-xs font-semibold text-rose-400 block mb-1">Blocked Reason (Mandatory)</label>
                  <input
                    type="text"
                    required
                    placeholder="Why is progress currently halted?"
                    value={blockedReason}
                    onChange={(e) => setBlockedReason(e.target.value)}
                    className="w-full bg-slate-950 border border-rose-800 rounded-lg p-2 text-xs text-white outline-none"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Update "What Requires Attention Next"</label>
                <input
                  type="text"
                  placeholder="e.g. Awaiting customer confirmation, run database migration..."
                  value={nextActionInput}
                  onChange={(e) => setNextActionInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Transition Justification Note</label>
                <input
                  type="text"
                  placeholder="Optional audit log note..."
                  value={transitionNote}
                  onChange={(e) => setTransitionNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setShowTransitionDialog(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteTransition}
                  className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs"
                >
                  Confirm Transition
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

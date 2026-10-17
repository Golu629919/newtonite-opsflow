import React, { useState } from 'react';
import { X, Plus, AlertCircle, Sparkles } from 'lucide-react';

export default function CreateWorkItemModal({ isOpen, onClose, onCreate, teams, users }) {
  if (!isOpen) return null;

  const [title, setTitle] = useState('');
  const [type, setType] = useState('PRODUCTION_INCIDENT');
  const [priority, setPriority] = useState('P1_HIGH');
  const [teamId, setTeamId] = useState(teams[0]?.id || 'team-eng');
  const [assigneeId, setAssigneeId] = useState('');
  const [whyItExists, setWhyItExists] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [simulateOutboxFailure, setSimulateOutboxFailure] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !whyItExists.trim() || !nextAction.trim()) {
      setErrorMsg('Please complete all required fields.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await onCreate({
        title: title.trim(),
        type,
        priority,
        team_id: teamId,
        assignee_id: assigneeId || null,
        why_it_exists: whyItExists.trim(),
        next_action: nextAction.trim(),
        requires_approval: requiresApproval,
        simulate_outbox_failure: simulateOutboxFailure
      });
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create work item');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Create Operational Work Item</h3>
              <p className="text-xs text-slate-400">Initialize a request, incident, or approval ticket</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Work Item Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Visa 502 Gateway Errors, High-Value Refund Approval..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Row: Category, Priority, Team */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Category</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 outline-none"
              >
                <option value="PRODUCTION_INCIDENT">Production Incident</option>
                <option value="PAYMENT_INVESTIGATION">Payment Investigation</option>
                <option value="COMPLIANCE_REQUEST">Compliance Request</option>
                <option value="CUSTOMER_ISSUE">Customer Escalation</option>
                <option value="OPERATIONAL_APPROVAL">Operational Approval</option>
                <option value="ENGINEERING_BUG">Engineering Bug</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 outline-none"
              >
                <option value="P0_CRITICAL">P0 Critical (Outage/Emergency)</option>
                <option value="P1_HIGH">P1 High (Urgent)</option>
                <option value="P2_MEDIUM">P2 Medium (Standard)</option>
                <option value="P3_LOW">P3 Low (Minor)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Responsible Team</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 outline-none"
              >
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Why it exists */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Why does this item exist? (Problem context) <span className="text-rose-400">*</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="Describe the operational incident, business risk, customer impact, or regulatory requirement..."
              value={whyItExists}
              onChange={(e) => setWhyItExists(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* What requires attention next */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              What requires attention next? <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Needs immediate replica restart, awaiting VP approval..."
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Toggles */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
                className="rounded border-slate-700 text-sky-500 focus:ring-0 bg-slate-900"
              />
              <span className="text-xs text-slate-300 font-medium">
                Enforce Formal Workflow Sign-Off (Requires Team Lead or Admin approval before resolution)
              </span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={simulateOutboxFailure}
                onChange={(e) => setSimulateOutboxFailure(e.target.checked)}
                className="rounded border-slate-700 text-amber-500 focus:ring-0 bg-slate-900"
              />
              <span className="text-xs text-amber-300/90 font-medium">
                Simulate Asynchronous Notification Gateway Failure (Tests background retry & exponential backoff)
              </span>
            </label>
          </div>

          {/* Submit */}
          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 text-xs text-slate-400 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs disabled:opacity-50 transition-colors shadow-md shadow-sky-500/20"
            >
              {isSubmitting ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}

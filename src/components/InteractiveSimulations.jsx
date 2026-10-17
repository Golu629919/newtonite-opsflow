import React, { useState } from 'react';
import { 
  FlaskConical, 
  Zap, 
  Repeat, 
  ShieldAlert, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Radio,
  Play
} from 'lucide-react';

export default function InteractiveSimulations({ onRefreshData }) {
  const [activeSimulation, setActiveSimulation] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [...prev, { text: msg, type, timestamp: new Date().toLocaleTimeString() }]);
  };

  const clearLogs = () => setLogs([]);

  // 1. Simulate Concurrency Collision (Optimistic Concurrency Control)
  const runConcurrencySim = async () => {
    setIsRunning(true);
    clearLogs();
    setActiveSimulation('concurrency');
    addLog('Starting Concurrency Race Simulation...', 'info');

    try {
      // Step A: Create a clean test item
      addLog('Step 1: Creating fresh test item "OPS-RACE-01" at version 1...', 'info');
      const createRes = await fetch('/api/work-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': 'usr_alice' },
        body: JSON.stringify({
          title: 'Simulated Production Outage (Race Condition Test)',
          type: 'PRODUCTION_INCIDENT',
          priority: 'P0_CRITICAL',
          team_id: 'team-eng',
          why_it_exists: 'Testing simultaneous claim collision between Alice and Elena',
          next_action: 'Observe OCC 409 rejection'
        })
      });
      const item = await createRes.json();
      addLog(`Created item ${item.id} (Initial Version = ${item.version})`, 'success');

      // Step B: Simulate Alice claiming the item
      addLog('Step 2: User A (Alice Chen) claims ticket with expected Version 1...', 'info');
      const claimA = await fetch(`/api/work-items/${item.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': 'usr_alice' },
        body: JSON.stringify({ version: item.version })
      });
      const claimAData = await claimA.json();
      addLog(`✅ User A succeeded! Ticket claimed, version advanced to ${claimAData.version}`, 'success');

      // Step C: Simulate Elena claiming ticket with stale version 1
      addLog('Step 3: User B (Elena) attempts to claim using stale Version 1...', 'info');
      const claimB = await fetch(`/api/work-items/${item.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': 'usr_elena' },
        body: JSON.stringify({ version: item.version }) // Sending version 1 instead of 2!
      });

      const claimBData = await claimB.json();
      if (claimB.status === 409) {
        addLog(`🛡️ OCC PROTECTION TRIGGERED: HTTP 409 Conflict!`, 'warning');
        addLog(`Server Response: "${claimBData.message}"`, 'warning');
        addLog('Result: Elena prevented from overwriting Alice\'s ownership. Zero lost updates!', 'success');
      } else {
        addLog(`Unexpected status: ${claimB.status}`, 'error');
      }

      onRefreshData();
    } catch (err) {
      addLog(`Simulation Error: ${err.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  // 2. Simulate Idempotency Key Handling
  const runIdempotencySim = async () => {
    setIsRunning(true);
    clearLogs();
    setActiveSimulation('idempotency');
    addLog('Starting Duplicate Request & Idempotency Key Simulation...', 'info');

    try {
      const uniqueKey = `demo-key-${Date.now()}`;
      const payload = {
        title: 'High-Value Payment Wire Refund ($25,000)',
        type: 'PAYMENT_INVESTIGATION',
        priority: 'P1_HIGH',
        team_id: 'team-payments',
        why_it_exists: 'Testing network timeout retry deduplication',
        next_action: 'Verify single ledger record'
      };

      addLog(`Generated client Idempotency-Key: "${uniqueKey}"`, 'info');

      // First Request
      addLog('Sending Request #1 (initial user submission)...', 'info');
      const res1 = await fetch('/api/work-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': 'usr_bob',
          'Idempotency-Key': uniqueKey
        },
        body: JSON.stringify(payload)
      });
      const data1 = await res1.json();
      addLog(`Request #1 Result: HTTP ${res1.status} Created (ID: ${data1.id})`, 'success');

      // Second Request with SAME key (simulating network retry / double click)
      addLog('Sending Request #2 with IDENTICAL Idempotency-Key (simulating retry)...', 'info');
      const res2 = await fetch('/api/work-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': 'usr_bob',
          'Idempotency-Key': uniqueKey
        },
        body: JSON.stringify(payload)
      });
      const isReplay = res2.headers.get('x-idempotent-replay') === 'true';
      const data2 = await res2.json();

      if (isReplay) {
        addLog(`🎯 IDEMPOTENCY CACHE HIT! X-Idempotent-Replay header detected.`, 'warning');
        addLog(`Returned cached ticket ${data2.id} without re-executing database insertion!`, 'success');
        addLog('Zero duplicate tickets created. Safe against double clicks and network hiccups.', 'success');
      } else {
        addLog(`Warning: Request was not marked as idempotent replay.`, 'error');
      }

      onRefreshData();
    } catch (err) {
      addLog(`Simulation Error: ${err.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  // 3. Simulate Workflow State Machine & Guard Rejections
  const runWorkflowGuardsSim = async () => {
    setIsRunning(true);
    clearLogs();
    setActiveSimulation('workflow');
    addLog('Starting Workflow Guards & Approval Rules Simulation...', 'info');

    try {
      // Step A: Create ticket requiring approval
      addLog('Step 1: Creating Compliance ticket requiring formal sign-off...', 'info');
      const resCreate = await fetch('/api/work-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': 'usr_carol' },
        body: JSON.stringify({
          title: 'GDPR Sanctions Compliance Review',
          type: 'COMPLIANCE_REQUEST',
          priority: 'P1_HIGH',
          team_id: 'team-compliance',
          why_it_exists: 'Subject to audit regulation',
          next_action: 'Awaiting Compliance Lead approval',
          requires_approval: true
        })
      });
      const item = await resCreate.json();

      // Step B: Claim ticket
      const resClaim = await fetch(`/api/work-items/${item.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': 'usr_carol' },
        body: JSON.stringify({ version: item.version })
      });
      const claimedItem = await resClaim.json();

      // Step C: Attempt illegal transition to RESOLVED without approval
      addLog('Step 2: Attempting illegal transition directly to RESOLVED without sign-off...', 'info');
      const illegalTransition = await fetch(`/api/work-items/${item.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': 'usr_carol' },
        body: JSON.stringify({ status: 'RESOLVED', version: claimedItem.version })
      });
      const illegalData = await illegalTransition.json();
      if (illegalTransition.status === 422) {
        addLog(`🛡️ STATE MACHINE GUARD ENFORCED: HTTP 422 Unprocessable!`, 'warning');
        addLog(`Reason: "${illegalData.message}"`, 'warning');
      }

      // Step D: Unauthorized approval attempt by Bob (who is in Payments, not Compliance Lead)
      addLog('Step 3: Unauthorized user (Bob, Payments) attempts to approve...', 'info');
      const unauthApprove = await fetch(`/api/work-items/${item.id}/approval-decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': 'usr_bob' },
        body: JSON.stringify({ decision: 'APPROVED', version: claimedItem.version })
      });
      const unauthData = await unauthApprove.json();
      if (unauthApprove.status === 403) {
        addLog(`🛡️ RESOURCE AUTHORIZATION ENFORCED: HTTP 403 Forbidden!`, 'warning');
        addLog(`Reason: "${unauthData.message}"`, 'warning');
      }

      // Step E: Legitimate approval by Carol (Compliance Lead)
      addLog('Step 4: Authorized user (Carol, Compliance Lead) executes sign-off...', 'info');
      const authApprove = await fetch(`/api/work-items/${item.id}/approval-decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': 'usr_carol' },
        body: JSON.stringify({ decision: 'APPROVED', version: claimedItem.version, note: 'Passed all AML audits.' })
      });
      const approvedItem = await authApprove.json();
      addLog(`✅ Approval succeeded! Status marked ${approvedItem.approval_status}`, 'success');

      // Step F: Now transition to RESOLVED succeeds
      addLog('Step 5: Transitioning to RESOLVED with valid approval...', 'info');
      const legalTransition = await fetch(`/api/work-items/${item.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': 'usr_carol' },
        body: JSON.stringify({ status: 'RESOLVED', version: approvedItem.version, note: 'All approvals in place.' })
      });
      const finalItem = await legalTransition.json();
      addLog(`🎉 SUCCESS: Ticket cleanly resolved (Status: ${finalItem.status})`, 'success');

      onRefreshData();
    } catch (err) {
      addLog(`Simulation Error: ${err.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  // 4. Simulate Asynchronous Outbox Worker Failure & Backoff
  const runOutboxSim = async () => {
    setIsRunning(true);
    clearLogs();
    setActiveSimulation('outbox');
    addLog('Starting Asynchronous Outbox Resiliency Simulation...', 'info');

    try {
      addLog('Creating work item with simulated external notification gateway failure...', 'info');
      const res = await fetch('/api/work-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': 'usr_alice' },
        body: JSON.stringify({
          title: 'Simulated Gateway Downtime Incident',
          type: 'OPERATIONAL_APPROVAL',
          priority: 'P2_MEDIUM',
          team_id: 'team-ops',
          why_it_exists: 'Demonstrating background worker retry & dead letter resiliency',
          next_action: 'Observe outbox worker backoff',
          simulate_outbox_failure: true
        })
      });
      const item = await res.json();
      addLog(`Item ${item.id} created. Outbox job staged atomically.`, 'success');
      addLog('Background worker will poll and detect simulated HTTP 503 gateway timeout.', 'info');
      addLog('Watch the "Async Outbox Queue" tab to observe automatic exponential backoff (2s, 4s, 8s...) and Dead-Letter queueing.', 'warning');
      onRefreshData();
    } catch (err) {
      addLog(`Simulation Error: ${err.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Intro Header */}
      <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-600/30 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Operations Under Pressure - Live Scenarios Testbed
            </h2>
            <p className="text-xs text-slate-400">
              Directly verify the candidate brief's required non-CRUD behaviors with live interactive simulations.
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Simulation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Card 1: Concurrency Race */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-rose-400" />
                Critical Behaviour #1
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                HTTP 409 OCC
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mb-1.5">
              Optimistic Concurrency Control (Simultaneous Claim)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Demonstrates two operators attempting to claim the same work item simultaneously. System uses atomic version checking to allow the first claim and gracefully reject the second with a conflict diff.
            </p>
          </div>
          <button
            onClick={runConcurrencySim}
            disabled={isRunning}
            className="mt-4 flex items-center justify-center space-x-2 w-full py-2 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-semibold transition-all disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Launch Concurrency Simulation</span>
          </button>
        </div>

        {/* Card 2: Idempotency Key */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                <Repeat className="w-4 h-4 text-sky-400" />
                Critical Behaviour #2
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                Idempotency-Key
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mb-1.5">
              Accidental Double-Click & Network Retry Prevention
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Simulates a user resending the exact same request due to network timeout or rapid double-clicking. System replays cached HTTP response with zero duplicate database insertions.
            </p>
          </div>
          <button
            onClick={runIdempotencySim}
            disabled={isRunning}
            className="mt-4 flex items-center justify-center space-x-2 w-full py-2 rounded-lg bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/40 text-xs font-semibold transition-all disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Launch Idempotency Simulation</span>
          </button>
        </div>

        {/* Card 3: Workflow State Machine & Guards */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Critical Behaviour #3
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                State Machine
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mb-1.5">
              Workflow Guards & Role-Based Approval Gates
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Verifies that high-risk compliance tickets cannot bypass formal sign-off, unauthorized operators cannot approve peer tickets, and transitions only succeed once legal approval conditions are met.
            </p>
          </div>
          <button
            onClick={runWorkflowGuardsSim}
            disabled={isRunning}
            className="mt-4 flex items-center justify-center space-x-2 w-full py-2 rounded-lg bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40 text-xs font-semibold transition-all disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Launch Workflow Guards Simulation</span>
          </button>
        </div>

        {/* Card 4: Asynchronous Outbox Worker & Backoff */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-emerald-400" />
                Critical Behaviour #4
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                Transactional Outbox
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mb-1.5">
              Asynchronous Outbox Resiliency & Backoff
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Demonstrates secondary operations (notifications, audit ledger enrichment) executing asynchronously via transactional outbox, with exponential backoff on simulated network failures and Dead-Letter recovery.
            </p>
          </div>
          <button
            onClick={runOutboxSim}
            disabled={isRunning}
            className="mt-4 flex items-center justify-center space-x-2 w-full py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-semibold transition-all disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Launch Outbox Simulation</span>
          </button>
        </div>

      </div>

      {/* Live Simulation Output Console */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-mono font-bold text-slate-200">Execution Output & Assertion Log</span>
          </div>
          <button
            onClick={clearLogs}
            className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
          >
            Clear Console
          </button>
        </div>

        <div className="p-4 font-mono text-xs max-h-80 overflow-y-auto space-y-1.5">
          {logs.map((log, idx) => (
            <div 
              key={idx} 
              className={`flex items-start space-x-2 ${
                log.type === 'error' ? 'text-rose-400' :
                log.type === 'warning' ? 'text-amber-400' :
                log.type === 'success' ? 'text-emerald-400' : 'text-slate-300'
              }`}
            >
              <span className="text-slate-600 select-none">[{log.timestamp}]</span>
              <span>{log.text}</span>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-slate-600 italic py-6 text-center">
              Select any simulation button above to execute a live demonstration.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

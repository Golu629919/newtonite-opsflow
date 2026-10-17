import React, { useState, useEffect } from 'react';
import { Cpu, RefreshCw, CheckCircle2, AlertTriangle, AlertCircle, Clock } from 'lucide-react';
import { apiRequest } from '../api';

export default function OutboxMonitor() {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [retryingId, setRetryingId] = useState(null);

  const fetchOutbox = async () => {
    try {
      const res = await apiRequest('/outbox');
      setJobs(res.data.jobs || []);
      setStats(res.data.stats || []);
    } catch (err) {
      console.error('Failed to fetch outbox:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOutbox();
    const interval = setInterval(fetchOutbox, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRetry = async (jobId) => {
    setRetryingId(jobId);
    try {
      await apiRequest(`/outbox/${jobId}/retry`, { method: 'POST' });
      await fetchOutbox();
    } catch (err) {
      alert(`Retry failed: ${err.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800"><CheckCircle2 className="w-3 h-3" /> Completed</span>;
      case 'RETRYING':
        return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800 animate-pulse"><Clock className="w-3 h-3" /> Retrying</span>;
      case 'DEAD_LETTER':
        return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800"><AlertTriangle className="w-3 h-3" /> Dead Letter</span>;
      case 'PROCESSING':
        return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800"><RefreshCw className="w-3 h-3 animate-spin" /> Processing</span>;
      default:
        return <span className="text-[11px] font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded">Pending</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Transactional Outbox Queue</h2>
            <p className="text-xs text-slate-400">
              Reliable background processor guaranteeing that secondary actions (Slack/Email, Audit, SLAs) survive transient failures.
            </p>
          </div>
        </div>

        <button
          onClick={fetchOutbox}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 font-medium transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Outbox Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Task ID</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Related Ticket</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Retries</th>
                <th className="py-3 px-4">Error / Details</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-850 transition-colors">
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-400">{job.id}</td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-200">{job.event_type}</td>
                  <td className="py-3 px-4">
                    {job.work_item_id ? (
                      <div>
                        <span className="font-mono text-sky-400">{job.work_item_id}</span>
                        {job.work_item_title && (
                          <span className="text-slate-400 truncate block max-w-xs">{job.work_item_title}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">None</span>
                    )}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">{getStatusBadge(job.status)}</td>
                  <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-400">
                    {job.retry_count} / {job.max_retries}
                  </td>
                  <td className="py-3 px-4 max-w-sm">
                    {job.last_error ? (
                      <span className="text-rose-400 font-mono text-[11px] bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/40 line-clamp-2">
                        {job.last_error}
                      </span>
                    ) : (
                      <span className="text-slate-500">Processed successfully</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {(job.status === 'RETRYING' || job.status === 'DEAD_LETTER') && (
                      <button
                        disabled={retryingId === job.id}
                        onClick={() => handleManualRetry(job.id)}
                        className="px-2.5 py-1 rounded bg-sky-600/30 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/50 text-[11px] font-semibold transition-all"
                      >
                        {retryingId === job.id ? 'Retrying...' : 'Retry Now'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No background outbox events found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

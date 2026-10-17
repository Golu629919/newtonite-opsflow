import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import MetricsHeader from './components/MetricsHeader';
import FilterBar from './components/FilterBar';
import WorkItemList from './components/WorkItemList';
import WorkItemKanban from './components/WorkItemKanban';
import WorkItemDetailModal from './components/WorkItemDetailModal';
import CreateWorkItemModal from './components/CreateWorkItemModal';
import InteractiveSimulations from './components/InteractiveSimulations';
import OutboxMonitor from './components/OutboxMonitor';
import { apiRequest, setCurrentUserId, subscribeToEvents } from './api';
import { Bell, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [activeTab, setActiveTab] = useState('list'); // 'list', 'kanban', 'simulations', 'outbox'
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // Work items state
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [selectedItemDetail, setSelectedItemDetail] = useState(null);
  const [staleItems, setStaleItems] = useState(new Set());

  // Filters state
  const [filters, setFilters] = useState({
    search: '',
    teamId: '',
    status: '',
    priority: '',
    type: '',
    assigneeId: '',
    page: 1
  });

  // Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // 1. Initial Load: Users, Teams, Current User
  useEffect(() => {
    async function initAuth() {
      try {
        const [usersRes, teamsRes, currentRes] = await Promise.all([
          apiRequest('/auth/users'),
          apiRequest('/auth/teams'),
          apiRequest('/auth/current')
        ]);
        setUsers(usersRes.data.users || []);
        setTeams(teamsRes.data.teams || []);
        setCurrentUser(currentRes.data.user);
      } catch (err) {
        console.error('Auth initialization error:', err);
      }
    }
    initAuth();
  }, []);

  // 2. Fetch Work Items & Summary
  const fetchWorkItems = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams();
      if (filters.search) queryParams.set('search', filters.search);
      if (filters.teamId) queryParams.set('teamId', filters.teamId);
      if (filters.status) queryParams.set('status', filters.status);
      if (filters.priority) queryParams.set('priority', filters.priority);
      if (filters.type) queryParams.set('type', filters.type);
      if (filters.assigneeId) queryParams.set('assigneeId', filters.assigneeId);
      queryParams.set('page', filters.page);
      queryParams.set('limit', '12');

      const [itemsRes, summaryRes] = await Promise.all([
        apiRequest(`/work-items?${queryParams.toString()}`),
        apiRequest('/analytics/summary')
      ]);

      setItems(itemsRes.data.items || []);
      setPagination(itemsRes.data.pagination);
      setSummary(summaryRes.data.summary);
    } catch (err) {
      console.error('Failed to load items:', err);
    }
  }, [filters]);

  useEffect(() => {
    fetchWorkItems();
  }, [fetchWorkItems]);

  // 3. Fetch Single Detail when selected
  const fetchItemDetail = useCallback(async (id) => {
    try {
      const res = await apiRequest(`/work-items/${id}`);
      setSelectedItemDetail(res.data);
      setStaleItems(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      addToast(err.message || 'Failed to load ticket detail', 'error');
    }
  }, []);

  useEffect(() => {
    if (selectedItemId) {
      fetchItemDetail(selectedItemId);
    } else {
      setSelectedItemDetail(null);
    }
  }, [selectedItemId, fetchItemDetail]);

  // 4. Real-time Server-Sent Events (SSE) Listener
  useEffect(() => {
    const unsubscribe = subscribeToEvents(
      (event) => {
        if (event.type === 'CONNECTED') {
          setIsLiveConnected(true);
        } else if (event.type === 'WORK_ITEM_CREATED') {
          addToast(`New ticket created: ${event.data.id} - ${event.data.title}`, 'info');
          fetchWorkItems();
        } else if (event.type === 'WORK_ITEM_UPDATED') {
          // Check if user is currently viewing this item
          if (selectedItemId === event.data.id) {
            setStaleItems(prev => new Set(prev).add(event.data.id));
          }
          fetchWorkItems();
        } else if (event.type === 'COMMENT_ADDED') {
          if (selectedItemId === event.data.workItemId) {
            fetchItemDetail(selectedItemId);
          }
        }
      },
      () => {
        setIsLiveConnected(false);
      }
    );

    return () => unsubscribe();
  }, [selectedItemId, fetchWorkItems, fetchItemDetail]);

  // Switch User Persona
  const handleSwitchUser = async (newUserId) => {
    setCurrentUserId(newUserId);
    try {
      const res = await apiRequest('/auth/current');
      setCurrentUser(res.data.user);
      addToast(`Switched persona to ${res.data.user.name} (${res.data.user.role.toUpperCase()})`, 'info');
      fetchWorkItems();
      if (selectedItemId) {
        fetchItemDetail(selectedItemId);
      }
    } catch (err) {
      console.error('Failed to switch user:', err);
    }
  };

  // Filter Handlers
  const handleFilterChange = (key, val) => {
    setFilters(prev => ({ ...prev, [key]: val, page: 1 }));
  };

  const handleSelectQuickFilter = (quick) => {
    setFilters(prev => ({
      ...prev,
      ...quick,
      page: 1
    }));
  };

  const handleResetFilters = () => {
    setFilters({
      search: '',
      teamId: '',
      status: '',
      priority: '',
      type: '',
      assigneeId: '',
      page: 1
    });
  };

  // Mutating Operations (with OCC Conflict and Idempotency Handling)
  const handleClaim = async (id, version) => {
    try {
      await apiRequest(`/work-items/${id}/claim`, {
        method: 'POST',
        body: JSON.stringify({ version })
      });
      addToast('Ticket successfully claimed!', 'success');
      await fetchItemDetail(id);
      fetchWorkItems();
    } catch (err) {
      if (err.isConflict) {
        addToast(`⚠️ Concurrency Conflict: ${err.message}`, 'error');
        setStaleItems(prev => new Set(prev).add(id));
      } else {
        addToast(err.message, 'error');
      }
    }
  };

  const handleAssign = async (id, newAssigneeId, version) => {
    try {
      await apiRequest(`/work-items/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ assignee_id: newAssigneeId, version })
      });
      addToast('Assignee updated', 'success');
      await fetchItemDetail(id);
      fetchWorkItems();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleTransition = async (id, status, version, context) => {
    try {
      await apiRequest(`/work-items/${id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ status, version, ...context })
      });
      addToast(`Status transitioned to ${status}`, 'success');
      await fetchItemDetail(id);
      fetchWorkItems();
    } catch (err) {
      if (err.isConflict) {
        addToast(`⚠️ Concurrency Conflict: ${err.message}`, 'error');
        setStaleItems(prev => new Set(prev).add(id));
      } else {
        addToast(err.message, 'error');
      }
    }
  };

  const handleRequestApproval = async (id, note, version) => {
    try {
      await apiRequest(`/work-items/${id}/approval-request`, {
        method: 'POST',
        body: JSON.stringify({ note, version })
      });
      addToast('Formal sign-off requested from Team Lead', 'info');
      await fetchItemDetail(id);
      fetchWorkItems();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDecideApproval = async (id, decision, note, version) => {
    try {
      await apiRequest(`/work-items/${id}/approval-decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, note, version })
      });
      addToast(`Approval decision marked: ${decision}`, 'success');
      await fetchItemDetail(id);
      fetchWorkItems();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleAddComment = async (id, message, isInternal) => {
    try {
      await apiRequest(`/work-items/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ message, is_internal: isInternal })
      });
      await fetchItemDetail(id);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleCreateTicket = async (data) => {
    const res = await apiRequest('/work-items', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    addToast(`Created operational ticket ${res.data.id}`, 'success');
    fetchWorkItems();
    setSelectedItemId(res.data.id);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col selection:bg-sky-500 selection:text-white">
      
      {/* Top Navigation */}
      <Navbar
        currentUser={currentUser}
        users={users}
        onSwitchUser={handleSwitchUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCreate={() => setIsCreateOpen(true)}
        isLiveConnected={isLiveConnected}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Operations Overview Dashboard Metrics */}
        <MetricsHeader
          summary={summary}
          currentUser={currentUser}
          onSelectFilter={handleSelectQuickFilter}
        />

        {/* Tab 1: Work Items List View */}
        {activeTab === 'list' && (
          <>
            <FilterBar
              filters={filters}
              onFilterChange={handleFilterChange}
              teams={teams}
              users={users}
              onResetFilters={handleResetFilters}
            />
            <WorkItemList
              items={items}
              pagination={pagination}
              onPageChange={(p) => setFilters(prev => ({ ...prev, page: p }))}
              onSelectItem={(id) => setSelectedItemId(id)}
              onClaimItem={handleClaim}
              currentUser={currentUser}
            />
          </>
        )}

        {/* Tab 2: Kanban Workflow View */}
        {activeTab === 'kanban' && (
          <>
            <FilterBar
              filters={filters}
              onFilterChange={handleFilterChange}
              teams={teams}
              users={users}
              onResetFilters={handleResetFilters}
            />
            <WorkItemKanban
              items={items}
              onSelectItem={(id) => setSelectedItemId(id)}
            />
          </>
        )}

        {/* Tab 3: Interactive Simulation Lab (Operations Under Pressure) */}
        {activeTab === 'simulations' && (
          <InteractiveSimulations onRefreshData={fetchWorkItems} />
        )}

        {/* Tab 4: Asynchronous Outbox Queue Monitor */}
        {activeTab === 'outbox' && (
          <OutboxMonitor />
        )}

      </main>

      {/* Detail Modal / Drawer */}
      {selectedItemId && selectedItemDetail && (
        <WorkItemDetailModal
          item={selectedItemDetail}
          onClose={() => setSelectedItemId(null)}
          currentUser={currentUser}
          users={users}
          onClaim={handleClaim}
          onAssign={handleAssign}
          onTransition={handleTransition}
          onRequestApproval={handleRequestApproval}
          onDecideApproval={handleDecideApproval}
          onAddComment={handleAddComment}
          onRefresh={fetchItemDetail}
          isStale={staleItems.has(selectedItemId)}
        />
      )}

      {/* Create Modal */}
      <CreateWorkItemModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateTicket}
        teams={teams}
        users={users}
      />

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center space-x-2 px-3.5 py-2.5 rounded-xl shadow-xl text-xs font-medium border animate-in slide-in-from-bottom-2 ${
              t.type === 'error' ? 'bg-rose-950 border-rose-800 text-rose-200' :
              t.type === 'success' ? 'bg-emerald-950 border-emerald-800 text-emerald-200' :
              'bg-slate-900 border-slate-700 text-slate-200'
            }`}
          >
            {t.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" /> :
             t.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> :
             <Bell className="w-4 h-4 text-sky-400 shrink-0" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

    </div>
  );
}

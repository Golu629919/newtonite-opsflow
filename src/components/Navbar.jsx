import React from 'react';
import { 
  Activity, 
  Plus, 
  Layers, 
  Kanban, 
  FlaskConical, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle,
  User,
  Shield,
  Radio
} from 'lucide-react';

export default function Navbar({ 
  currentUser, 
  users, 
  onSwitchUser, 
  activeTab, 
  setActiveTab, 
  onOpenCreate,
  isLiveConnected 
}) {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Product Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-white tracking-tight">OpsFlow</span>
                <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/60">
                  Newtonite
                </span>
              </div>
              <p className="text-xs text-slate-400">Operations Under Pressure</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'list'
                  ? 'bg-slate-800 text-sky-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Work Items</span>
            </button>

            <button
              onClick={() => setActiveTab('kanban')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'kanban'
                  ? 'bg-slate-800 text-sky-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Kanban className="w-4 h-4" />
              <span>Workflow Board</span>
            </button>

            <button
              onClick={() => setActiveTab('simulations')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'simulations'
                  ? 'bg-amber-950/60 text-amber-300 border border-amber-800/50'
                  : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-950/30'
              }`}
            >
              <FlaskConical className="w-4 h-4 text-amber-400" />
              <span>Simulation Lab (Critical Scenarios)</span>
            </button>

            <button
              onClick={() => setActiveTab('outbox')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'outbox'
                  ? 'bg-slate-800 text-sky-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>Async Outbox Queue</span>
            </button>
          </nav>

          {/* Right Controls: SSE Indicator, Persona Switcher, + New Button */}
          <div className="flex items-center space-x-3">
            
            {/* Live SSE Pulse */}
            <div 
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs"
              title={isLiveConnected ? "Real-time updates active via SSE" : "Reconnecting to live stream..."}
            >
              <span className={`w-2 h-2 rounded-full ${isLiveConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span className="text-[11px] text-slate-300 hidden sm:inline">
                {isLiveConnected ? 'Live' : 'Connecting'}
              </span>
            </div>

            {/* Persona Switcher Dropdown */}
            <div className="relative flex items-center bg-slate-800 border border-slate-700 rounded-lg p-1">
              <User className="w-4 h-4 text-slate-400 ml-1.5 mr-1" />
              <select
                value={currentUser?.id || ''}
                onChange={(e) => onSwitchUser(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-200 pr-2 py-1 outline-none cursor-pointer"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id} className="bg-slate-900 text-slate-200">
                    {u.name} ({u.role.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {/* New Work Item Button */}
            <button
              onClick={onOpenCreate}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold shadow-md shadow-sky-500/20 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Work Item</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}

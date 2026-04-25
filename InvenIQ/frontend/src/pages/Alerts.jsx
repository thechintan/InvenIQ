import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Bell, AlertTriangle, ShieldAlert, Info, CheckCircle, Sparkles, RefreshCw, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import usePersistentFilters from '../hooks/usePersistentFilters';

const severityConfig = {
  critical: { icon: ShieldAlert, color: 'border-l-red-500 bg-red-50/40 dark:bg-red-500/5', badge: 'badge-danger', iconColor: 'text-red-500' },
  warning:  { icon: AlertTriangle, color: 'border-l-amber-500 bg-amber-50/40 dark:bg-amber-500/5', badge: 'badge-warning', iconColor: 'text-amber-500' },
  info:     { icon: Info, color: 'border-l-blue-500 bg-blue-50/40 dark:bg-blue-500/5', badge: 'badge-info', iconColor: 'text-blue-500' },
};

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = usePersistentFilters('alerts_filters', { alert_type: '', severity: '', is_resolved: 'false' });
  const [runningRestock, setRunningRestock] = useState(false);
  const [runningAnomaly, setRunningAnomaly] = useState(false);
  const [summarizing, setSummarizing] = useState({});
  const { canEdit } = useAuth();

  useEffect(() => { loadData(); }, [filter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      Object.entries(filter).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await api.get('/alerts', { params });
      setAlerts(res.data.data);
      setStats(res.data.stats || {});
    } catch {} finally { setLoading(false); }
  };

  const runRestock = async () => {
    setRunningRestock(true);
    try {
      const res = await api.post('/ai/run-restock');
      toast.success(res.data.message);
      loadData();
    } catch (err) { toast.error('Failed to run restock analysis'); }
    finally { setRunningRestock(false); }
  };

  const runAnomaly = async () => {
    setRunningAnomaly(true);
    try {
      const res = await api.post('/ai/run-anomaly');
      toast.success(res.data.message);
      loadData();
    } catch (err) { toast.error('Failed to run anomaly detection'); }
    finally { setRunningAnomaly(false); }
  };

  const summarize = async (alertId) => {
    setSummarizing(prev => ({ ...prev, [alertId]: true }));
    try {
      const res = await api.post(`/ai/summarize/${alertId}`);
      // Update the alert locally
      setAlerts(prev => prev.map(a => a.alert_id === alertId ? { ...a, ai_summary: res.data.data.summary } : a));
      toast.success(res.data.data.cached ? 'Summary loaded from cache' : 'AI summary generated');
    } catch { toast.error('Failed to generate summary'); }
    finally { setSummarizing(prev => ({ ...prev, [alertId]: false })); }
  };

  const resolveAlert = async (alertId) => {
    try {
      await api.put(`/alerts/${alertId}/resolve`);
      toast.success('Alert resolved');
      loadData();
    } catch { toast.error('Error resolving alert'); }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Alerts</h1><p className="page-subtitle">AI-powered stock alerts and anomaly detection</p></div>
        {canEdit() && (
          <div className="flex gap-2">
            <button onClick={runRestock} disabled={runningRestock} className="btn-secondary">
              {runningRestock ? <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /> : <Zap className="w-4 h-4" />}
              Run Restock Analysis
            </button>
            <button onClick={runAnomaly} disabled={runningAnomaly} className="btn-secondary">
              {runningAnomaly ? <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
              Run Anomaly Detection
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-4 flex items-center gap-3 border-l-4 border-l-red-500">
          <ShieldAlert className="w-8 h-8 text-red-500" />
          <div><p className="text-2xl font-bold text-red-600">{stats.critical_count || 0}</p><p className="text-xs text-slate-500">Critical Alerts</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3 border-l-4 border-l-amber-500">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
          <div><p className="text-2xl font-bold text-amber-600">{stats.warning_count || 0}</p><p className="text-xs text-slate-500">Warnings</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3 border-l-4 border-l-blue-500">
          <Bell className="w-8 h-8 text-blue-500" />
          <div><p className="text-2xl font-bold text-blue-600">{stats.unresolved_count || 0}</p><p className="text-xs text-slate-500">Unresolved</p></div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex gap-3">
          <select className="select-field sm:w-40" value={filter.alert_type} onChange={e => setFilter({...filter, alert_type: e.target.value})}>
            <option value="">All Types</option><option value="restock">Restock</option><option value="anomaly">Anomaly</option>
          </select>
          <select className="select-field sm:w-40" value={filter.severity} onChange={e => setFilter({...filter, severity: e.target.value})}>
            <option value="">All Severity</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option>
          </select>
          <select className="select-field sm:w-40" value={filter.is_resolved} onChange={e => setFilter({...filter, is_resolved: e.target.value})}>
            <option value="false">Unresolved</option><option value="true">Resolved</option><option value="">All</option>
          </select>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {loading ? [...Array(3)].map((_, i) => <div key={i} className="card h-24 skeleton" />) :
        alerts.length === 0 ? (
          <div className="card p-12 text-center">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No alerts found</p>
            <p className="text-xs text-slate-400 mt-1">Run restock analysis or anomaly detection to generate alerts</p>
          </div>
        ) :
        alerts.map((alert, i) => {
          const config = severityConfig[alert.severity] || severityConfig.info;
          return (
            <div key={alert.alert_id} className={`card border-l-4 ${config.color} p-5 fade-up`} style={{ animationDelay: `${i * 30}ms` }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <config.icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${config.iconColor}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={config.badge}>{alert.severity}</span>
                      <span className="badge-neutral">{alert.alert_type}</span>
                      <span className="text-xs text-slate-400">{alert.product_name} · {alert.warehouse_name}</span>
                    </div>
                    <p className="text-sm text-slate-700 mb-2">{alert.message}</p>
                    {alert.ai_summary && (
                      <div className="bg-white/80 dark:bg-slate-800/80 rounded-lg p-3 border border-slate-200 dark:border-slate-700 mt-2">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 mb-1">
                          <Sparkles className="w-3 h-3" /> AI Summary
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{alert.ai_summary}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <p className="text-xs text-slate-400">{new Date(alert.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  {!alert.ai_summary && canEdit() && (
                    <button onClick={() => summarize(alert.alert_id)} disabled={summarizing[alert.alert_id]}
                            className="btn-ghost text-xs text-purple-600 hover:bg-purple-50">
                      {summarizing[alert.alert_id] ? <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Summarize
                    </button>
                  )}
                  {!alert.is_resolved && canEdit() && (
                    <button onClick={() => resolveAlert(alert.alert_id)} className="btn-ghost text-xs text-emerald-600 hover:bg-emerald-50">
                      <CheckCircle className="w-3 h-3" /> Resolve
                    </button>
                  )}
                  {alert.is_resolved && <span className="badge-success">Resolved</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
  Bot, Search, TrendingUp, ClipboardCheck,
  Play, CheckCircle, AlertTriangle, XCircle, RefreshCw,
  Package, Warehouse, ChevronDown, ChevronUp,
  Activity, ShoppingCart, Shield, Users, Mail,
  Clock, Settings, Send, Eye, Calendar,
  Crown, UserCheck, User, UserX, ToggleLeft, ToggleRight
} from 'lucide-react';

const AGENTS = [
  {
    id: 'restock', name: 'Restock Agent', icon: ShoppingCart,
    color: 'from-violet-500 to-indigo-500', bg: 'bg-violet-500/10',
    border: 'border-violet-500/20', iconColor: 'text-violet-400',
    description: 'Scans all critical restock alerts and automatically drafts purchase orders grouped by warehouse with AI-generated reasoning.',
    endpoint: '/agents/restock-agent', badge: 'Auto-drafts orders',
  },
  {
    id: 'anomaly', name: 'Anomaly Investigator', icon: Search,
    color: 'from-rose-500 to-pink-500', bg: 'bg-rose-500/10',
    border: 'border-rose-500/20', iconColor: 'text-rose-400',
    description: 'Investigates every unresolved anomaly alert, cross-references transaction history, and generates root cause analysis with recommended actions.',
    endpoint: '/agents/anomaly-agent', badge: 'Root cause analysis',
  },
  {
    id: 'forecast', name: 'Demand Forecast Agent', icon: TrendingUp,
    color: 'from-cyan-500 to-blue-500', bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20', iconColor: 'text-cyan-400',
    description: 'Uses linear regression on 30-day transaction history to forecast demand for the next 7-30 days and flags products at stockout risk.',
    endpoint: '/agents/forecast-agent', badge: 'Predictive analytics', configurable: true,
  },
  {
    id: 'order-health', name: 'Order Health Agent', icon: ClipboardCheck,
    color: 'from-amber-500 to-orange-500', bg: 'bg-amber-500/10',
    border: 'border-amber-500/20', iconColor: 'text-amber-400',
    description: 'Reviews all pending and confirmed orders for insufficient stock, stale drafts, and high-value risks. Generates an overall health summary.',
    endpoint: '/agents/order-health-agent', badge: 'Order risk detection',
  },
];

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const ROLE_COLORS = {
  admin: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  manager: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  staff: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  viewer: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
};
const ROLE_ICONS = { admin: Crown, manager: UserCheck, staff: User, viewer: Eye };

function SeverityBadge({ severity }) {
  const map = {
    critical: 'bg-red-500/15 text-red-400 border-red-500/20',
    high: 'bg-red-500/15 text-red-400 border-red-500/20',
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    medium: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    info: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${map[severity] || map.info}`}>
      {severity}
    </span>
  );
}

function TrendBadge({ trend }) {
  const map = {
    increasing: { cls: 'text-red-400', label: 'Increasing' },
    decreasing: { cls: 'text-emerald-400', label: 'Decreasing' },
    stable: { cls: 'text-slate-400', label: 'Stable' },
  };
  const t = map[trend] || map.stable;
  return <span className={`text-xs font-medium ${t.cls}`}>{t.label}</span>;
}

function RestockResult({ data }) {
  const [expanded, setExpanded] = useState(null);
  if (!data.actions?.length) return <p className="text-slate-400 text-sm">{data.message}</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">{data.message}</p>
      {data.actions.map((action, i) => (
        <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
          <button className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-800 transition-colors"
            onClick={() => setExpanded(expanded === i ? null : i)}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <Warehouse className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">{action.warehouse} <span className="text-slate-500 font-normal">· {action.city}</span></p>
                <p className="text-xs text-slate-400">{action.items_count} items · {action.total_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-400 font-medium">Draft created</span>
              {expanded === i ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </div>
          </button>
          {expanded === i && (
            <div className="px-4 pb-4 space-y-3 border-t border-slate-700">
              <p className="text-xs text-slate-400 pt-3 italic">"{action.reasoning}"</p>
              <div className="space-y-1.5">
                {action.items.map((item, j) => (
                  <div key={j} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-700/50 last:border-0">
                    <span className="text-slate-300">{item.name} <span className="text-slate-500">({item.sku})</span></span>
                    <div className="flex items-center gap-3">
                      <SeverityBadge severity={item.severity} />
                      <span className="text-slate-400">{item.days_left}d left</span>
                      <span className="text-violet-400 font-medium">Order {item.qty} units</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AnomalyResult({ data }) {
  const [expanded, setExpanded] = useState(null);
  if (!data.investigations?.length) return <p className="text-slate-400 text-sm">{data.message}</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">{data.message}</p>
      {data.investigations.map((inv, i) => (
        <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
          <button className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-800 transition-colors"
            onClick={() => setExpanded(expanded === i ? null : i)}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center">
                <Package className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">{inv.product} <span className="text-slate-500 font-normal">({inv.sku})</span></p>
                <p className="text-xs text-slate-400">{inv.warehouse}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SeverityBadge severity={inv.risk} />
              {expanded === i ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </div>
          </button>
          {expanded === i && (
            <div className="px-4 pb-4 space-y-2 border-t border-slate-700 pt-3">
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div className="bg-slate-900/60 rounded-lg p-3">
                  <p className="text-slate-500 uppercase tracking-wider text-[10px] mb-1">Verdict</p>
                  <p className="text-slate-200">{inv.verdict}</p>
                </div>
                <div className="bg-slate-900/60 rounded-lg p-3">
                  <p className="text-slate-500 uppercase tracking-wider text-[10px] mb-1">Root Cause</p>
                  <p className="text-slate-300">{inv.root_cause}</p>
                </div>
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
                  <p className="text-rose-400 uppercase tracking-wider text-[10px] mb-1">Recommended Action</p>
                  <p className="text-slate-200">{inv.action}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ForecastResult({ data }) {
  if (!data.forecasts?.length) return <p className="text-slate-400 text-sm">{data.message}</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">{data.message}</p>
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-xs">
          <thead className="bg-slate-800/80">
            <tr>
              {['Product','Warehouse','Stock','Avg/Day',`${data.forecast_days}d Forecast`,'Trend','Days Left','Status'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.forecasts.map((f, i) => (
              <tr key={i} className={`border-t border-slate-700/50 ${f.will_stockout ? 'bg-red-500/5' : ''}`}>
                <td className="px-3 py-2.5 text-slate-200 font-medium whitespace-nowrap">{f.product}<br /><span className="text-slate-500 font-normal">{f.sku}</span></td>
                <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{f.warehouse}</td>
                <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">{f.current_stock}</td>
                <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">{f.avg_daily_demand}</td>
                <td className="px-3 py-2.5 text-cyan-400 font-semibold whitespace-nowrap">{f.forecasted_demand}</td>
                <td className="px-3 py-2.5 whitespace-nowrap"><TrendBadge trend={f.trend} /></td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className={f.days_until_stockout < 7 ? 'text-red-400 font-semibold' : f.days_until_stockout < 14 ? 'text-amber-400' : 'text-slate-400'}>
                    {f.days_until_stockout >= 999 ? 'OK' : `${f.days_until_stockout}d`}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {f.will_stockout
                    ? <span className="text-red-400 font-semibold flex items-center gap-1"><XCircle className="w-3 h-3" /> At Risk</span>
                    : <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> OK</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrderHealthResult({ data }) {
  const [expanded, setExpanded] = useState(null);
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">{data.message}</p>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Orders', value: data.total_orders, color: 'text-slate-200' },
          { label: 'With Issues', value: data.issues_count, color: 'text-red-400' },
          { label: 'Healthy', value: data.healthy, color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      {data.issues?.map((order, i) => (
        <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
          <button className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-800 transition-colors"
            onClick={() => setExpanded(expanded === i ? null : i)}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">{order.customer} <span className="text-slate-500 font-normal">· {order.warehouse}</span></p>
                <p className="text-xs text-slate-400">{order.total_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })} · {order.age_hours}h old · {order.status}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-400">{order.issues.length} issue{order.issues.length > 1 ? 's' : ''}</span>
              {expanded === i ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </div>
          </button>
          {expanded === i && (
            <div className="px-4 pb-4 space-y-2 border-t border-slate-700 pt-3">
              {order.issues.map((issue, j) => (
                <div key={j} className={`flex items-start gap-2 text-xs p-2.5 rounded-lg ${issue.severity === 'critical' ? 'bg-red-500/10 border border-red-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                  <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${issue.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`} />
                  <span className="text-slate-300">{issue.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Users Panel ────────────────────────────────────────────
function UsersPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/agents/users-summary')
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-slate-800 rounded-xl animate-pulse" />)}
    </div>
  );
  if (!data) return null;

  const { summary, users, emailRecipients } = data;

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Users', value: summary.total, color: 'text-slate-200', bg: 'bg-slate-800' },
          { label: 'Active', value: summary.active, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Admins', value: summary.admins, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { label: 'Managers', value: summary.managers, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-slate-800 rounded-xl p-3 text-center`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* User list */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">All Users</p>
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {users.map(u => {
            const RoleIcon = ROLE_ICONS[u.role] || User;
            return (
              <div key={u.user_id} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${u.is_active ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-900/30 border-slate-800/30 opacity-50'}`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200 leading-none">{u.name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${ROLE_COLORS[u.role]}`}>
                    <RoleIcon className="w-2.5 h-2.5" />{u.role}
                  </span>
                  {!u.is_active && <span className="text-[10px] text-slate-600">inactive</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Email recipients */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Mail className="w-4 h-4 text-blue-400" />
          <p className="text-sm font-semibold text-blue-300">Weekly Email Recipients ({emailRecipients.length})</p>
        </div>
        <p className="text-xs text-slate-400 mb-2">All active admins and managers receive the weekly summary.</p>
        <div className="flex flex-wrap gap-1.5">
          {emailRecipients.map(u => (
            <span key={u.user_id} className="text-[11px] bg-slate-800 border border-slate-700 text-slate-300 px-2 py-1 rounded-lg">
              {u.name}
            </span>
          ))}
          {emailRecipients.length === 0 && <span className="text-xs text-slate-500">No active admins or managers found</span>}
        </div>
      </div>
    </div>
  );
}

// ── Email Schedule Panel ───────────────────────────────────
function EmailSchedulePanel({ isAdmin }) {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({ enabled: true, day: 1, hour: 8, minute: 0 });
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [smtpOk, setSmtpOk] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    api.get('/agents/email-schedule').then(r => {
      setConfig(r.data.config);
      setForm(r.data.config);
    }).catch(() => {});
    api.get('/email/status').then(r => setSmtpOk(r.data.configured)).catch(() => setSmtpOk(false));
  }, []);

  const saveSchedule = async () => {
    setSaving(true);
    try {
      const r = await api.post('/agents/email-schedule', form);
      setConfig(r.data.config);
      toast.success('Schedule saved');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const sendNow = async () => {
    setSending(true);
    try {
      const r = await api.post('/email/send-weekly');
      toast.success(r.data.message);
    } catch (err) { toast.error(err.response?.data?.error || 'Send failed'); }
    finally { setSending(false); }
  };

  const loadPreview = async () => {
    setPreviewLoading(true);
    try {
      const r = await api.get('/email/preview');
      setPreview(r.data.data);
    } catch { toast.error('Preview failed'); }
    finally { setPreviewLoading(false); }
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 15, 30, 45];

  return (
    <div className="space-y-5">
      {/* SMTP status */}
      <div className={`flex items-center gap-3 p-3.5 rounded-xl text-sm border ${smtpOk === null ? 'bg-slate-800 border-slate-700 text-slate-400' : smtpOk ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${smtpOk === null ? 'bg-slate-500' : smtpOk ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        {smtpOk === null ? 'Checking SMTP...' : smtpOk ? 'SMTP configured — email sending is active' : 'SMTP not configured — set SMTP_USER and SMTP_PASS in .env'}
      </div>

      {/* Schedule config */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-200">Automatic Schedule</p>
            <p className="text-xs text-slate-500 mt-0.5">Weekly summary email sent automatically</p>
          </div>
          <button
            onClick={() => isAdmin && setForm(f => ({ ...f, enabled: !f.enabled }))}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${form.enabled ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
            disabled={!isAdmin}
          >
            {form.enabled ? <><CheckCircle className="w-3.5 h-3.5" /> Enabled</> : <><XCircle className="w-3.5 h-3.5" /> Disabled</>}
          </button>
        </div>

        {form.enabled && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold block mb-1.5">Day</label>
              <select
                value={form.day}
                onChange={e => setForm(f => ({ ...f, day: parseInt(e.target.value) }))}
                disabled={!isAdmin}
                className="w-full text-xs bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-2 focus:outline-none focus:border-slate-500 disabled:opacity-50"
              >
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold block mb-1.5">Hour</label>
              <select
                value={form.hour}
                onChange={e => setForm(f => ({ ...f, hour: parseInt(e.target.value) }))}
                disabled={!isAdmin}
                className="w-full text-xs bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-2 focus:outline-none focus:border-slate-500 disabled:opacity-50"
              >
                {hours.map(h => <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold block mb-1.5">Minute</label>
              <select
                value={form.minute}
                onChange={e => setForm(f => ({ ...f, minute: parseInt(e.target.value) }))}
                disabled={!isAdmin}
                className="w-full text-xs bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-2 focus:outline-none focus:border-slate-500 disabled:opacity-50"
              >
                {minutes.map(m => <option key={m} value={m}>:{String(m).padStart(2,'0')}</option>)}
              </select>
            </div>
          </div>
        )}

        {form.enabled && (
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/60 rounded-lg px-3 py-2">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Next send: <span className="text-slate-200 font-medium">{DAYS[form.day]} at {String(form.hour).padStart(2,'0')}:{String(form.minute).padStart(2,'0')} IST</span>
          </div>
        )}

        {isAdmin && (
          <button onClick={saveSchedule} disabled={saving} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-primary-500 to-accent-500 hover:opacity-90 disabled:opacity-50 transition-all">
            {saving ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...</> : <><CheckCircle className="w-3.5 h-3.5" /> Save Schedule</>}
          </button>
        )}
      </div>

      {/* Manual send */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <p className="text-sm font-semibold text-slate-200 mb-1">Send Report Now</p>
        <p className="text-xs text-slate-500 mb-3">Manually trigger the weekly summary email to all admins and managers.</p>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && smtpOk && (
            <button onClick={sendNow} disabled={sending} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 disabled:opacity-50 transition-all">
              {sending ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sending...</> : <><Send className="w-3.5 h-3.5" /> Send Now</>}
            </button>
          )}
          <button onClick={loadPreview} disabled={previewLoading} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50 transition-all">
            {previewLoading ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading...</> : <><Eye className="w-3.5 h-3.5" /> Preview Report</>}
          </button>
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-200">Report Preview — {preview.weekStart} to {preview.weekEnd}</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Transactions', value: preview.totalTransactions },
              { label: 'Stock In', value: preview.stockIn },
              { label: 'Stock Out', value: preview.stockOut },
              { label: 'New Orders', value: preview.newOrders },
              { label: 'Critical Alerts', value: preview.criticalAlerts },
              { label: 'Low Stock', value: preview.lowStockItems?.length },
            ].map(s => (
              <div key={s.label} className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-slate-100">{s.value ?? 0}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          {preview.aiSummary && (
            <div className="bg-primary-500/10 border border-primary-500/20 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-primary-400 mb-1">AI Summary</p>
              <p className="text-xs text-slate-300 leading-relaxed">{preview.aiSummary}</p>
            </div>
          )}
          <p className="text-[11px] text-slate-500">Recipients: {preview.recipients?.join(', ')}</p>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────
export default function Agents() {
  const { isAdmin } = useAuth();
  const [status, setStatus] = useState(null);
  const [running, setRunning] = useState({});
  const [results, setResults] = useState({});
  const [forecastDays, setForecastDays] = useState(14);
  const [settingsTab, setSettingsTab] = useState('users');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => { fetchStatus(); }, []);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/agents/status');
      setStatus(res.data.status);
    } catch (e) {}
  };

  const runAgent = async (agent) => {
    setRunning(r => ({ ...r, [agent.id]: true }));
    setResults(r => ({ ...r, [agent.id]: null }));
    try {
      const body = agent.id === 'forecast' ? { days: forecastDays } : {};
      const res = await api.post(agent.endpoint, body);
      setResults(r => ({ ...r, [agent.id]: res.data }));
      toast.success(`${agent.name} completed`);
      fetchStatus();
    } catch (err) {
      const msg = err.response?.data?.error || 'Agent failed';
      setResults(r => ({ ...r, [agent.id]: { error: msg } }));
      toast.error(msg);
    } finally {
      setRunning(r => ({ ...r, [agent.id]: false }));
    }
  };

  const renderResult = (agent) => {
    const result = results[agent.id];
    if (!result) return null;
    if (result.error) return (
      <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">{result.error}</div>
    );
    return (
      <div className="mt-4 border-t border-slate-700 pt-4">
        {agent.id === 'restock' && <RestockResult data={result} />}
        {agent.id === 'anomaly' && <AnomalyResult data={result} />}
        {agent.id === 'forecast' && <ForecastResult data={result} />}
        {agent.id === 'order-health' && <OrderHealthResult data={result} />}
      </div>
    );
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Agents</h1>
          <p className="page-subtitle">Autonomous agents that monitor, analyze, and act on your inventory data</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(s => !s)}
            className={`btn-secondary ${showSettings ? 'bg-primary-500/15 border-primary-500/30 text-primary-400' : ''}`}>
            <Settings className="w-4 h-4" /> Settings
          </button>
          <button onClick={fetchStatus} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Status bar */}
      {status && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Unresolved Alerts', value: status.unresolved_alerts, icon: Activity, color: 'text-slate-300', bg: 'bg-slate-800' },
            { label: 'Critical Alerts', value: status.critical_alerts, icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
            { label: 'Pending Orders', value: status.pending_orders, icon: ShoppingCart, color: 'text-amber-400', bg: 'bg-amber-500/10' },
            { label: 'Recent Anomalies', value: status.recent_anomalies, icon: Shield, color: 'text-rose-400', bg: 'bg-rose-500/10' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border border-slate-800 rounded-2xl p-4 flex items-center gap-3`}>
              <s.icon className={`w-5 h-5 ${s.color} flex-shrink-0`} />
              <div>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="mb-6 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-1 p-1 border-b border-slate-800 bg-slate-900/80">
            {[
              { id: 'users', icon: Users, label: 'Users' },
              { id: 'email', icon: Mail, label: 'Email Schedule' },
            ].map(t => (
              <button key={t.id} onClick={() => setSettingsTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${settingsTab === t.id ? 'bg-primary-500/15 text-primary-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
                <t.icon className="w-3.5 h-3.5" />{t.label}
              </button>
            ))}
          </div>
          <div className="p-5">
            {settingsTab === 'users' && <UsersPanel />}
            {settingsTab === 'email' && <EmailSchedulePanel isAdmin={isAdmin()} />}
          </div>
        </div>
      )}

      {/* Agent cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {AGENTS.map(agent => (
          <div key={agent.id} className={`bg-slate-900 border ${agent.border} rounded-2xl p-5 flex flex-col`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${agent.bg} flex items-center justify-center`}>
                  <agent.icon className={`w-5 h-5 ${agent.iconColor}`} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{agent.name}</h3>
                  <span className={`text-[10px] font-medium ${agent.iconColor} uppercase tracking-wider`}>{agent.badge}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {agent.configurable && (
                  <select value={forecastDays} onChange={e => setForecastDays(parseInt(e.target.value))}
                    className="text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-slate-600">
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                  </select>
                )}
                <button onClick={() => runAgent(agent)} disabled={running[agent.id]}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r ${agent.color} hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all`}>
                  {running[agent.id]
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Running...</>
                    : <><Play className="w-3.5 h-3.5" /> Run</>}
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-3">{agent.description}</p>

            {running[agent.id] && (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                <div className="flex gap-1">
                  {[0,1,2].map(i => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${agent.color} animate-bounce`}
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                Agent is working...
              </div>
            )}

            {renderResult(agent)}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-6 p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-start gap-3">
        <Bot className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-slate-300 mb-1">About AI Agents</p>
          <p className="text-xs text-slate-500 leading-relaxed">
            These agents use Gemini AI + real-time database analysis to autonomously detect issues and take action.
            Restock Agent creates draft orders (review before confirming). Anomaly Investigator updates alert summaries.
            Forecast Agent uses linear regression on 30-day history. Order Health Agent flags risks without modifying orders.
          </p>
        </div>
      </div>
    </div>
  );
}

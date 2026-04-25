import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  Warehouse, Package, IndianRupee, ClipboardList, Bell, AlertTriangle,
  TrendingUp, TrendingDown, ArrowRight, Activity, RefreshCw, Boxes, BarChart3
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#6366F1', '#14B8A6', '#F97316'];

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [stockTrend, setStockTrend] = useState([]);
  const [categorySplit, setCategorySplit] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [warehouseSummary, setWarehouseSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, canEdit } = useAuth();

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [sum, trend, cats, top, activity, wh] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/dashboard/stock-trend'),
        api.get('/dashboard/category-split'),
        api.get('/dashboard/top-products'),
        api.get('/dashboard/recent-activity'),
        api.get('/dashboard/warehouse-summary'),
      ]);
      setSummary(sum.data.data);
      setStockTrend(trend.data.data.map(t => ({
        ...t,
        stock_in: Number(t.stock_in),
        stock_out: Number(t.stock_out)
      })));
      setCategorySplit(cats.data.data.map(c => ({
        ...c,
        value: Number(c.value),
        quantity: Number(c.quantity)
      })));
      setTopProducts(top.data.data.map(p => ({
        ...p,
        total_in: Number(p.total_in),
        total_out: Number(p.total_out),
        total_movement: Number(p.total_movement)
      })));
      setRecentActivity(activity.data.data);
      setWarehouseSummary(wh.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    if (num >= 10000000) return `₹${(num/10000000).toFixed(1)}Cr`;
    if (num >= 100000) return `₹${(num/100000).toFixed(1)}L`;
    if (num >= 1000) return `₹${(num/1000).toFixed(1)}K`;
    return `₹${num.toFixed(0)}`;
  };

  const txnTypeLabel = (t) => ({
    stock_in: 'Stock In', stock_out: 'Stock Out', adjustment: 'Adjustment',
    transfer_in: 'Transfer In', transfer_out: 'Transfer Out',
    return_in: 'Return In', return_out: 'Return Out',
  }[t] || t);

  const txnTypeColor = (t) => {
    if (t.includes('in') || t === 'stock_in') return 'text-emerald-600 bg-emerald-50';
    if (t.includes('out') || t === 'stock_out') return 'text-red-600 bg-red-50';
    return 'text-amber-600 bg-amber-50';
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {[...Array(5)].map((_, i) => <div key={i} className="card p-5 h-24 skeleton" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => <div key={i} className="card h-80 skeleton" />)}
        </div>
      </div>
    );
  }

  const stats = [
    { label: 'Warehouses', value: summary?.total_warehouses || 0, icon: Warehouse, color: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400', link: '/warehouses' },
    { label: 'Total Products', value: summary?.total_products || 0, icon: Package, color: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400', link: '/products' },
    { label: 'Stock Value', value: formatCurrency(summary?.total_stock_value), icon: IndianRupee, color: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', link: '/inventory' },
    { label: 'Pending Orders', value: summary?.pending_orders || 0, icon: ClipboardList, color: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400', link: '/orders' },
    { label: 'Active Alerts', value: summary?.active_alerts || 0, icon: Bell, color: summary?.critical_alerts > 0 ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400', link: '/alerts', critical: summary?.critical_alerts },
  ];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">Here's what's happening across your warehouses today</p>
        </div>
        <button onClick={loadDashboard} className="btn-secondary">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {stats.map((stat, i) => (
          <Link key={i} to={stat.link} className="card-hover p-5 fade-up" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{stat.value}</p>
                {stat.critical > 0 && (
                  <p className="text-xs text-red-500 font-medium mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {stat.critical} critical
                  </p>
                )}
              </div>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Stock Trend Chart */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Stock Movement Trend</h3>
            <span className="text-xs text-slate-400">Last 30 days</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={stockTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }}
                     tickFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
              <Line type="monotone" dataKey="stock_in" stroke="#10B981" strokeWidth={2.5} dot={false} name="Stock In" />
              <Line type="monotone" dataKey="stock_out" stroke="#EF4444" strokeWidth={2.5} dot={false} name="Stock Out" />
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Category Breakdown */}
        <div className="card p-6 flex flex-col">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-4">Category Breakdown</h3>
          <div className="flex-1 flex flex-col justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={categorySplit} dataKey="value" nameKey="category" cx="50%" cy="50%"
                     innerRadius={65} outerRadius={95} paddingAngle={3}
                     label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                     labelLine={false}>
                  {categorySplit.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2 max-h-36 overflow-y-auto pr-1">
              {categorySplit.slice(0, 8).map((c, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-slate-600 dark:text-slate-400 truncate max-w-[120px]">{c.category}</span>
                  </div>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{formatCurrency(c.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Products */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Top Moving Products</h3>
            <Link to="/products" className="text-xs text-primary-500 hover:text-primary-600 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topProducts.slice(0, 8)} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11, fill: '#64748B' }}
                     tickFormatter={(v) => v.length > 18 ? v.substring(0, 18) + '...' : v} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0' }} />
              <Bar dataKey="total_in" fill="#10B981" name="Stock In" radius={[0, 4, 4, 0]} barSize={12} />
              <Bar dataKey="total_out" fill="#EF4444" name="Stock Out" radius={[0, 4, 4, 0]} barSize={12} />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Warehouse Summary */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Warehouse Overview</h3>
            <Link to="/warehouses" className="text-xs text-primary-500 hover:text-primary-600 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {warehouseSummary.map((wh, i) => (
              <Link key={i} to={`/warehouses/${wh.warehouse_id}`}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-primary-200 dark:hover:border-primary-700 hover:bg-primary-50/20 dark:hover:bg-primary-500/5 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center">
                    <Warehouse className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-primary-700 dark:group-hover:text-primary-400">{wh.name}</p>
                    <p className="text-xs text-slate-400">{wh.city} · {wh.sku_count} SKUs</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatCurrency(wh.stock_value)}</p>
                  {parseInt(wh.alert_count) > 0 && (
                    <span className="badge-danger text-[10px]">{wh.alert_count} alerts</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Recent Activity</h3>
          <Link to="/transactions" className="text-xs text-primary-500 hover:text-primary-600 flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Product</th>
                <th>Warehouse</th>
                <th>Quantity</th>
                <th>By</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.slice(0, 8).map((txn, i) => (
                <tr key={i}>
                  <td>
                    <span className={`badge ${txnTypeColor(txn.txn_type)}`}>
                      {txnTypeLabel(txn.txn_type)}
                    </span>
                  </td>
                  <td className="font-medium text-slate-800">{txn.product_name}</td>
                  <td className="text-slate-500">{txn.warehouse_name}</td>
                  <td className="font-semibold">{txn.quantity}</td>
                  <td className="text-slate-500">{txn.user_name}</td>
                  <td className="text-xs text-slate-400">
                    {new Date(txn.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

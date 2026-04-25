import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, ClipboardList, CheckCircle, Truck, XCircle, Package } from 'lucide-react';
import toast from 'react-hot-toast';

const statusConfig = {
  draft: { color: 'bg-slate-100 text-slate-700', label: 'Draft' },
  confirmed: { color: 'bg-blue-100 text-blue-700', label: 'Confirmed' },
  dispatched: { color: 'bg-amber-100 text-amber-700', label: 'Dispatched' },
  completed: { color: 'bg-emerald-100 text-emerald-700', label: 'Completed' },
  cancelled: { color: 'bg-red-100 text-red-700', label: 'Cancelled' },
};

export default function OrderDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { canEdit } = useAuth();

  const loadData = () => {
    api.get(`/orders/${id}`).then(res => { setData(res.data.data); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(() => { loadData(); }, [id]);

  const updateStatus = async (status) => {
    if (!confirm(`Change status to "${status}"?`)) return;
    try {
      await api.put(`/orders/${id}/status`, { status });
      toast.success(`Order ${status}`);
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Error updating status'); }
  };

  if (loading) return <div className="page-container"><div className="card h-96 skeleton" /></div>;
  if (!data) return <div className="page-container"><p>Order not found</p></div>;

  const nextActions = {
    draft: [{ status: 'confirmed', label: 'Confirm Order', icon: CheckCircle, color: 'btn-primary' }, { status: 'cancelled', label: 'Cancel', icon: XCircle, color: 'btn-danger' }],
    confirmed: [{ status: 'dispatched', label: 'Dispatch', icon: Truck, color: 'btn-primary bg-amber-500 hover:bg-amber-600' }, { status: 'cancelled', label: 'Cancel', icon: XCircle, color: 'btn-danger' }],
    dispatched: [{ status: 'completed', label: 'Mark Complete', icon: CheckCircle, color: 'btn-primary bg-emerald-500 hover:bg-emerald-600' }],
  };

  const statusSteps = ['draft', 'confirmed', 'dispatched', 'completed'];
  const currentStep = statusSteps.indexOf(data.status);

  return (
    <div className="page-container">
      <Link to="/orders" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Orders
      </Link>

      <div className="card p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center">
              <ClipboardList className="w-7 h-7 text-primary-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Order #{data.order_id.slice(0, 8)}</h1>
              <p className="text-sm text-slate-400">{data.warehouse_name} · {data.created_by_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`badge ${statusConfig[data.status]?.color} text-sm px-4 py-1.5`}>{statusConfig[data.status]?.label}</span>
            <p className="text-xl font-bold text-slate-800">₹{parseFloat(data.total_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>
        </div>

        {/* Status Pipeline */}
        {data.status !== 'cancelled' && (
          <div className="flex items-center gap-0 mb-6">
            {statusSteps.map((step, i) => (
              <div key={step} className="flex-1 flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i <= currentStep ? 'bg-primary-500 text-white' : 'bg-slate-200 text-slate-500'}`}>{i + 1}</div>
                <div className={`flex-1 h-1 ${i < statusSteps.length - 1 ? (i < currentStep ? 'bg-primary-500' : 'bg-slate-200') : ''}`} />
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-slate-400 text-xs">Customer</p><p className="font-medium">{data.customer_name || '-'}</p></div>
          <div><p className="text-slate-400 text-xs">Reference</p><p className="font-medium">{data.customer_ref || '-'}</p></div>
          <div><p className="text-slate-400 text-xs">Created</p><p className="font-medium">{new Date(data.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>
          <div><p className="text-slate-400 text-xs">Items</p><p className="font-medium">{data.items?.length || 0} products</p></div>
        </div>
      </div>

      {/* Actions */}
      {canEdit() && nextActions[data.status] && (
        <div className="flex gap-3 mb-6">
          {nextActions[data.status].map(a => (
            <button key={a.status} onClick={() => updateStatus(a.status)} className={a.color}>
              <a.icon className="w-4 h-4" /> {a.label}
            </button>
          ))}
        </div>
      )}

      {/* Line Items */}
      <div className="card mb-6">
        <div className="px-6 py-4 border-b border-slate-100"><h3 className="font-semibold">Order Items</h3></div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Product</th><th>SKU</th><th>Unit</th><th>Qty</th><th>Unit Price</th><th>Line Total</th></tr></thead>
            <tbody>
              {data.items?.map(item => (
                <tr key={item.item_id}>
                  <td className="font-medium text-slate-800">{item.product_name}</td>
                  <td className="font-mono text-xs text-slate-500">{item.sku}</td>
                  <td className="text-slate-500">{item.unit}</td>
                  <td className="font-semibold">{item.quantity}</td>
                  <td>₹{parseFloat(item.unit_price).toLocaleString('en-IN')}</td>
                  <td className="font-semibold">₹{parseFloat(item.line_total).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Returns */}
      {data.returns?.length > 0 && (
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100"><h3 className="font-semibold">Returns</h3></div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Product</th><th>Type</th><th>Qty</th><th>Reason</th></tr></thead>
              <tbody>
                {data.returns.map(r => (
                  <tr key={r.return_id}>
                    <td className="font-medium">{r.product_name}</td>
                    <td><span className={r.return_type === 'customer_return' ? 'badge-warning' : 'badge-info'}>{r.return_type === 'customer_return' ? 'Customer' : 'Supplier'}</span></td>
                    <td className="font-semibold">{r.quantity}</td>
                    <td className="text-slate-500 text-xs">{r.reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

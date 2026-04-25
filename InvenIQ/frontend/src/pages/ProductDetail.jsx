import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { ArrowLeft, Package, Warehouse } from 'lucide-react';

export default function ProductDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/products/${id}`).then(res => { setData(res.data.data); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-container"><div className="card h-96 skeleton" /></div>;
  if (!data) return <div className="page-container"><p className="text-slate-500">Product not found</p></div>;

  const txnTypeLabel = (t) => ({ stock_in: 'Stock In', stock_out: 'Stock Out', adjustment: 'Adjustment', transfer_in: 'Transfer In', transfer_out: 'Transfer Out', return_in: 'Return In', return_out: 'Return Out' }[t] || t);
  const txnColor = (t) => t.includes('in') || t === 'return_in' ? 'badge-success' : t.includes('out') ? 'badge-danger' : 'badge-warning';

  return (
    <div className="page-container">
      <Link to="/products" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Products
      </Link>

      <div className="card p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center">
              <Package className="w-7 h-7 text-primary-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">{data.name}</h1>
              <p className="text-sm text-slate-400 font-mono">{data.sku}</p>
              {data.description && <p className="text-sm text-slate-500 mt-1">{data.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-6 text-center">
            <div><p className="text-2xl font-bold text-slate-800">{data.total_stock}</p><p className="text-xs text-slate-500">Total Stock</p></div>
            <div className="w-px h-10 bg-slate-200" />
            <div><p className="text-2xl font-bold text-primary-600">₹{parseFloat(data.price).toLocaleString('en-IN')}</p><p className="text-xs text-slate-500">Unit Price</p></div>
            <div className="w-px h-10 bg-slate-200" />
            <div><span className="badge-info">{data.category_name || 'N/A'}</span><p className="text-xs text-slate-500 mt-1">Category</p></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Stock by Warehouse</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {data.stock_by_warehouse?.map(s => (
              <div key={s.inventory_id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <Warehouse className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{s.warehouse_name}</p>
                    <p className="text-xs text-slate-400">{s.city}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${s.low_stock ? 'text-red-600' : 'text-slate-800'}`}>{s.quantity} {data.unit}</p>
                  <p className="text-xs text-slate-400">Reorder: {s.reorder_level}</p>
                </div>
              </div>
            ))}
            {(!data.stock_by_warehouse || data.stock_by_warehouse.length === 0) && (
              <div className="px-6 py-8 text-center text-slate-400 text-sm">No stock in any warehouse</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Recent Transactions</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {data.recent_transactions?.map(t => (
              <div key={t.txn_id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <span className={`${txnColor(t.txn_type)} text-xs`}>{txnTypeLabel(t.txn_type)}</span>
                  <p className="text-xs text-slate-400 mt-1">{t.warehouse_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-800">{t.quantity} units</p>
                  <p className="text-xs text-slate-400">{new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

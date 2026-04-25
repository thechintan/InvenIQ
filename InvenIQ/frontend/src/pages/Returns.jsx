import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { RotateCcw, Plus, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import usePersistentFilters from '../hooks/usePersistentFilters';

export default function Returns() {
  const [returns, setReturns] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = usePersistentFilters('returns_filters', { warehouse_id: '', return_type: '' });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ warehouse_id: '', product_id: '', return_type: 'customer_return', quantity: '', reason: '', order_id: '' });
  const { canEdit } = useAuth();

  useEffect(() => {
    Promise.all([api.get('/warehouses'), api.get('/products')]).then(([w, p]) => { setWarehouses(w.data.data); setProducts(p.data.data); });
    loadData();
  }, []);

  useEffect(() => { loadData(); }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      Object.entries(filters).forEach(([k,v]) => { if(v) params[k]=v; });
      const res = await api.get('/returns', { params });
      setReturns(res.data.data);
    } catch {} finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/returns', { ...form, quantity: parseInt(form.quantity), order_id: form.order_id || null });
      toast.success('Return recorded'); setShowModal(false); loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Returns</h1><p className="page-subtitle">Track customer and supplier returns</p></div>
        {canEdit() && <button onClick={() => { setForm({ warehouse_id: '', product_id: '', return_type: 'customer_return', quantity: '', reason: '', order_id: '' }); setShowModal(true); }} className="btn-primary"><Plus className="w-4 h-4" /> Record Return</button>}
      </div>

      <div className="card p-4 mb-6">
        <div className="flex gap-3">
          <select className="select-field sm:w-48" value={filters.warehouse_id} onChange={e => setFilters({...filters, warehouse_id: e.target.value})}>
            <option value="">All Warehouses</option>
            {warehouses.map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>)}
          </select>
          <select className="select-field sm:w-48" value={filters.return_type} onChange={e => setFilters({...filters, return_type: e.target.value})}>
            <option value="">All Return Types</option>
            <option value="customer_return">Customer Return</option>
            <option value="supplier_return">Supplier Return</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Type</th><th>Product</th><th>SKU</th><th>Warehouse</th><th>Qty</th><th>Reason</th><th>Order</th><th>By</th><th>Date</th></tr></thead>
            <tbody>
              {loading ? [...Array(5)].map((_, i) => <tr key={i}><td colSpan={9}><div className="h-5 skeleton" /></td></tr>) :
              returns.length === 0 ? <tr><td colSpan={9} className="text-center py-12 text-slate-400">No returns found</td></tr> :
              returns.map(r => (
                <tr key={r.return_id}>
                  <td><span className={r.return_type === 'customer_return' ? 'badge-warning' : 'badge-info'}>{r.return_type === 'customer_return' ? 'Customer' : 'Supplier'}</span></td>
                  <td className="font-medium text-slate-800">{r.product_name}</td>
                  <td className="font-mono text-xs text-slate-500">{r.sku}</td>
                  <td className="text-slate-600">{r.warehouse_name}</td>
                  <td className="font-semibold">{r.quantity}</td>
                  <td className="text-slate-500 text-xs max-w-xs truncate">{r.reason || '-'}</td>
                  <td className="text-xs text-slate-400">{r.order_customer || '-'}</td>
                  <td className="text-slate-500">{r.created_by_name}</td>
                  <td className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Record Return" maxWidth="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="label-text">Return Type *</label>
            <select className="select-field" value={form.return_type} onChange={e => setForm({...form, return_type: e.target.value})}>
              <option value="customer_return">Customer Return</option><option value="supplier_return">Supplier Return</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label-text">Warehouse *</label><select className="select-field" value={form.warehouse_id} onChange={e => setForm({...form, warehouse_id: e.target.value})} required><option value="">Select</option>{warehouses.filter(w=>w.is_active).map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>)}</select></div>
            <div><label className="label-text">Product *</label><select className="select-field" value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value})} required><option value="">Select</option>{products.filter(p=>p.is_active).map(p => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}</select></div>
          </div>
          <div><label className="label-text">Quantity *</label><input type="number" min="1" className="input-field" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} required /></div>
          <div><label className="label-text">Reason</label><textarea className="input-field" rows={2} value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Record Return</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

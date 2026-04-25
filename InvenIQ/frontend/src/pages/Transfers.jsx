import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { ArrowLeftRight, Plus, ArrowRight, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import usePersistentFilters from '../hooks/usePersistentFilters';

export default function Transfers() {
  const [transfers, setTransfers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = usePersistentFilters('transfers_filters', { from_warehouse_id: '', to_warehouse_id: '' });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ from_warehouse_id: '', to_warehouse_id: '', product_id: '', quantity: '', note: '' });
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
      const res = await api.get('/transfers', { params });
      setTransfers(res.data.data);
    } catch {} finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/transfers', { ...form, quantity: parseInt(form.quantity) });
      toast.success('Transfer completed'); setShowModal(false); loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Transfers</h1><p className="page-subtitle">Inter-warehouse stock movements</p></div>
        {canEdit() && <button onClick={() => { setForm({ from_warehouse_id: '', to_warehouse_id: '', product_id: '', quantity: '', note: '' }); setShowModal(true); }} className="btn-primary"><Plus className="w-4 h-4" /> New Transfer</button>}
      </div>

      <div className="card p-4 mb-6">
        <div className="flex gap-3">
          <select className="select-field sm:w-48" value={filters.from_warehouse_id} onChange={e => setFilters({...filters, from_warehouse_id: e.target.value})}>
            <option value="">All Source Warehouses</option>
            {warehouses.map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>)}
          </select>
          <select className="select-field sm:w-48" value={filters.to_warehouse_id} onChange={e => setFilters({...filters, to_warehouse_id: e.target.value})}>
            <option value="">All Destination Warehouses</option>
            {warehouses.map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>)}
          </select>
        </div>
      </div>

      <div className="table-container">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Product</th><th>From</th><th></th><th>To</th><th>Qty</th><th>Note</th><th>By</th><th>Date</th></tr></thead>
            <tbody>
              {loading ? [...Array(5)].map((_, i) => <tr key={i}><td colSpan={8}><div className="h-5 skeleton" /></td></tr>) :
              transfers.length === 0 ? <tr><td colSpan={8} className="text-center py-12 text-slate-400">No transfers found</td></tr> :
              transfers.map(t => (
                <tr key={t.transfer_id}>
                  <td><div><p className="font-medium text-slate-800">{t.product_name}</p><p className="text-xs text-slate-400 font-mono">{t.sku}</p></div></td>
                  <td><div><p className="font-medium text-slate-700">{t.from_warehouse_name}</p><p className="text-xs text-slate-400">{t.from_city}</p></div></td>
                  <td><ArrowRight className="w-4 h-4 text-primary-400" /></td>
                  <td><div><p className="font-medium text-slate-700">{t.to_warehouse_name}</p><p className="text-xs text-slate-400">{t.to_city}</p></div></td>
                  <td className="font-bold text-primary-600">{t.quantity}</td>
                  <td className="text-slate-500 text-xs">{t.note || '-'}</td>
                  <td className="text-slate-500">{t.created_by_name}</td>
                  <td className="text-xs text-slate-400">{new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Transfer" maxWidth="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label-text">From Warehouse *</label><select className="select-field" value={form.from_warehouse_id} onChange={e => setForm({...form, from_warehouse_id: e.target.value})} required><option value="">Select</option>{warehouses.filter(w=>w.is_active).map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>)}</select></div>
            <div><label className="label-text">To Warehouse *</label><select className="select-field" value={form.to_warehouse_id} onChange={e => setForm({...form, to_warehouse_id: e.target.value})} required><option value="">Select</option>{warehouses.filter(w=>w.is_active && w.warehouse_id !== form.from_warehouse_id).map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label-text">Product *</label><select className="select-field" value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value})} required><option value="">Select</option>{products.filter(p=>p.is_active).map(p => <option key={p.product_id} value={p.product_id}>{p.name} ({p.sku})</option>)}</select></div>
            <div><label className="label-text">Quantity *</label><input type="number" min="1" className="input-field" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} required /></div>
          </div>
          <div><label className="label-text">Note</label><textarea className="input-field" rows={2} value={form.note} onChange={e => setForm({...form, note: e.target.value})} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Transfer Stock</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

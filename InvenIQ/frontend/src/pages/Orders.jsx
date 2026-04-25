import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { ClipboardList, Plus, Eye, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import usePersistentFilters from '../hooks/usePersistentFilters';

const statusColors = { draft: 'badge-neutral', confirmed: 'badge-info', dispatched: 'badge-warning', completed: 'badge-success', cancelled: 'badge-danger' };

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = usePersistentFilters('orders_filters', { warehouse_id: '', status: '' });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ warehouse_id: '', customer_name: '', customer_ref: '', notes: '', items: [{ product_id: '', quantity: 1, unit_price: 0 }] });
  const { canCreate } = useAuth();

  useEffect(() => {
    Promise.all([api.get('/warehouses'), api.get('/products')]).then(([w, p]) => { setWarehouses(w.data.data); setProducts(p.data.data); });
    loadData();
  }, []);
  useEffect(() => { loadData(); }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try { const params = {}; Object.entries(filters).forEach(([k,v]) => { if(v) params[k]=v; }); const res = await api.get('/orders', { params }); setOrders(res.data.data); } catch {} finally { setLoading(false); }
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { product_id: '', quantity: 1, unit_price: 0 }] });
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const updateItem = (i, field, val) => {
    const items = [...form.items];
    items[i][field] = val;
    if (field === 'product_id') {
      const prod = products.find(p => p.product_id === val);
      if (prod) items[i].unit_price = parseFloat(prod.price);
    }
    setForm({ ...form, items });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validItems = form.items.filter(i => i.product_id && i.quantity > 0);
    if (!form.warehouse_id || validItems.length === 0) return toast.error('Warehouse and at least one item required');
    try {
      await api.post('/orders', { ...form, items: validItems.map(i => ({ ...i, quantity: parseInt(i.quantity), unit_price: parseFloat(i.unit_price) })) });
      toast.success('Order created'); setShowModal(false); loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const totalValue = form.items.reduce((sum, i) => sum + (parseFloat(i.unit_price) || 0) * (parseInt(i.quantity) || 0), 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Orders</h1><p className="page-subtitle">Manage dispatch orders and track their status</p></div>
        {canCreate() && <button onClick={() => { setForm({ warehouse_id: '', customer_name: '', customer_ref: '', notes: '', items: [{ product_id: '', quantity: 1, unit_price: 0 }] }); setShowModal(true); }} className="btn-primary"><Plus className="w-4 h-4" /> Create Order</button>}
      </div>

      <div className="card p-4 mb-6">
        <div className="flex gap-3">
          <select className="select-field sm:w-48" value={filters.warehouse_id} onChange={e => setFilters({...filters, warehouse_id: e.target.value})}>
            <option value="">All Warehouses</option>
            {warehouses.map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>)}
          </select>
          <select className="select-field sm:w-40" value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
            <option value="">All Statuses</option>
            {['draft','confirmed','dispatched','completed','cancelled'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
          </select>
        </div>
      </div>

      <div className="table-container">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Order</th><th>Customer</th><th>Warehouse</th><th>Items</th><th>Total Value</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? [...Array(5)].map((_, i) => <tr key={i}><td colSpan={8}><div className="h-5 skeleton" /></td></tr>) :
              orders.length === 0 ? <tr><td colSpan={8} className="text-center py-12 text-slate-400">No orders found</td></tr> :
              orders.map(o => (
                <tr key={o.order_id}>
                  <td className="font-mono text-xs text-slate-500">{o.order_id.slice(0,8)}...</td>
                  <td className="font-medium text-slate-800">{o.customer_name || '-'}</td>
                  <td className="text-slate-600">{o.warehouse_name}</td>
                  <td>{o.item_count} items</td>
                  <td className="font-semibold">₹{parseFloat(o.total_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td><span className={statusColors[o.status]}>{o.status}</span></td>
                  <td className="text-xs text-slate-400">{new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td><Link to={`/orders/${o.order_id}`} className="btn-ghost text-xs"><Eye className="w-3.5 h-3.5" /> View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Order" maxWidth="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label-text">Warehouse *</label>
              <select className="select-field" value={form.warehouse_id} onChange={e => setForm({...form, warehouse_id: e.target.value})} required>
                <option value="">Select</option>{warehouses.filter(w=>w.is_active).map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>)}
              </select>
            </div>
            <div><label className="label-text">Customer Name</label><input className="input-field" value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label-text">Customer Ref</label><input className="input-field" value={form.customer_ref} onChange={e => setForm({...form, customer_ref: e.target.value})} /></div>
            <div><label className="label-text">Notes</label><input className="input-field" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2"><label className="label-text mb-0">Order Items *</label><button type="button" onClick={addItem} className="text-xs text-primary-500 hover:text-primary-600 font-medium">+ Add Item</button></div>
            <div className="space-y-2">
              {form.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select className="select-field flex-1" value={item.product_id} onChange={e => updateItem(i, 'product_id', e.target.value)}>
                    <option value="">Select Product</option>{products.filter(p=>p.is_active).map(p => <option key={p.product_id} value={p.product_id}>{p.name} (₹{p.price})</option>)}
                  </select>
                  <input type="number" min="1" className="input-field w-20" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} placeholder="Qty" />
                  <input type="number" step="0.01" className="input-field w-28" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} placeholder="Price" />
                  {form.items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="p-2 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
                </div>
              ))}
            </div>
            <p className="text-right text-sm font-semibold text-slate-700 mt-2">Total: ₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create Order</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

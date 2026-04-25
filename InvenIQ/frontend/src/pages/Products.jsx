import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { Package, Plus, Search, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

// Returns styling based on how close expiry is
function ExpiryBadge({ date }) {
  if (!date) return <span className="text-slate-400 text-xs">—</span>;
  const today = new Date();
  const exp = new Date(date);
  const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
  const label = exp.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  if (diffDays < 0)
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3" /> Expired</span>;
  if (diffDays <= 30)
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3" />{label}</span>;
  return <span className="text-xs text-slate-500">{label}</span>;
}

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');

  useEffect(() => {
    if (categoryFilter) setSearchParams({ category: categoryFilter });
    else setSearchParams({});
  }, [categoryFilter, setSearchParams]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', sku: '', category_id: '', unit: 'pcs', price: '', description: '', expiry_date: '' });
  const { canEdit, isAdmin } = useAuth();

  useEffect(() => { loadData(); loadCategories(); }, []);
  useEffect(() => { const t = setTimeout(() => loadData(), 300); return () => clearTimeout(t); }, [search, categoryFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      const res = await api.get('/products', { params });
      setProducts(res.data.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const loadCategories = async () => {
    try { const res = await api.get('/categories'); setCategories(res.data.data); } catch {}
  };

  const openCreate = () => { setEditItem(null); setForm({ name: '', sku: '', category_id: '', unit: 'pcs', price: '', description: '', expiry_date: '' }); setShowModal(true); };
  const openEdit = (p) => { setEditItem(p); setForm({ name: p.name, sku: p.sku, category_id: p.category_id || '', unit: p.unit, price: p.price, description: p.description || '', expiry_date: p.expiry_date ? p.expiry_date.split('T')[0] : '' }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editItem) {
        await api.put(`/products/${editItem.product_id}`, form);
        toast.success('Product updated');
      } else {
        await api.post('/products', form);
        toast.success('Product created');
      }
      setShowModal(false); loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const toggleProduct = async (p) => {
    try {
      await api.delete(`/products/${p.product_id}`);
      toast.success(`Product ${p.is_active ? 'deactivated' : 'activated'}`);
      loadData();
    } catch (err) { toast.error('Error'); }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">Manage your product catalog and SKU details</p>
        </div>
        {canEdit() && <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> Add Product</button>}
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input-field pl-10" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="select-field sm:w-48" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="table-container">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Price</th>
                <th>Expiry Date</th>
                <th>Total Stock</th>
                <th>Warehouses</th>
                <th>Status</th>
                {canEdit() && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}><td colSpan={9}><div className="h-6 skeleton w-full" /></td></tr>
                ))
              ) : products.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400">No products found</td></tr>
              ) : (
                products.map(p => (
                  <tr key={p.product_id}>
                    <td>
                      <Link to={`/products/${p.product_id}`} className="font-medium text-slate-800 hover:text-primary-600">
                        {p.name}
                      </Link>
                    </td>
                    <td className="font-mono text-xs text-slate-500">{p.sku}</td>
                    <td><span className="badge-info">{p.category_name || 'Uncategorized'}</span></td>
                    <td className="text-slate-500">{p.unit}</td>
                    <td className="font-medium">₹{parseFloat(p.price).toLocaleString('en-IN')}</td>
                    <td><ExpiryBadge date={p.expiry_date} /></td>
                    <td className={`font-semibold ${parseInt(p.total_stock) <= 10 ? 'text-red-600' : 'text-slate-800'}`}>{p.total_stock}</td>
                    <td className="text-slate-500">{p.warehouse_count}</td>
                    <td>{p.is_active ? <span className="badge-success">Active</span> : <span className="badge-neutral">Inactive</span>}</td>
                    {canEdit() && (
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(p)} className="btn-ghost text-xs">Edit</button>
                          {isAdmin() && <button onClick={() => toggleProduct(p)} className="btn-ghost text-xs text-red-500">{p.is_active ? 'Deactivate' : 'Activate'}</button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Product' : 'Add Product'} maxWidth="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label-text">Product Name *</label><input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
            <div><label className="label-text">SKU Code *</label><input className="input-field" value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} required disabled={!!editItem} /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label-text">Category</label>
              <select className="select-field" value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})}>
                <option value="">Select</option>
                {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="label-text">Unit</label>
              <select className="select-field" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}>
                {['pcs', 'kg', 'litre', 'box', 'set', 'pair'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div><label className="label-text">Price (₹) *</label><input type="number" step="0.01" className="input-field" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required /></div>
          </div>
          <div><label className="label-text">Description</label><textarea className="input-field" rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
          <div><label className="label-text">Expiry Date <span className="text-slate-400 font-normal">(Food &amp; Pharma only)</span></label><input type="date" className="input-field" value={form.expiry_date} onChange={e => setForm({...form, expiry_date: e.target.value})} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editItem ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

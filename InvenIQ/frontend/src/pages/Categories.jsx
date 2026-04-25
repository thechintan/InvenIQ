import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { FolderOpen, Plus, Edit2, Trash2, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);
  const loadData = async () => { setLoading(true); try { const res = await api.get('/categories'); setCategories(res.data.data); } catch {} finally { setLoading(false); } };

  const openCreate = () => { setEditItem(null); setForm({ name: '', description: '' }); setShowModal(true); };
  const openEdit = (c) => { setEditItem(c); setForm({ name: c.name, description: c.description || '' }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editItem) { await api.put(`/categories/${editItem.category_id}`, form); toast.success('Updated'); }
      else { await api.post('/categories', form); toast.success('Created'); }
      setShowModal(false); loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const deleteCategory = async (c) => {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    try { await api.delete(`/categories/${c.category_id}`); toast.success('Deleted'); loadData(); }
    catch (err) { toast.error(err.response?.data?.error || 'Cannot delete'); }
  };

  const colors = ['bg-blue-50 text-blue-600', 'bg-emerald-50 text-emerald-600', 'bg-purple-50 text-purple-600', 'bg-amber-50 text-amber-600', 'bg-rose-50 text-rose-600', 'bg-cyan-50 text-cyan-600', 'bg-indigo-50 text-indigo-600', 'bg-orange-50 text-orange-600', 'bg-teal-50 text-teal-600', 'bg-pink-50 text-pink-600'];

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Categories</h1><p className="page-subtitle">Organize products into categories</p></div>
        {isAdmin() && <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> Add Category</button>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? [...Array(4)].map((_, i) => <div key={i} className="card h-32 skeleton" />) :
        categories.map((c, i) => (
          <div key={c.category_id} className="card-hover p-5 fade-up cursor-pointer" style={{ animationDelay: `${i * 40}ms` }} onClick={() => navigate(`/products?category=${c.category_id}`)}>
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[i % colors.length]}`}>
                <FolderOpen className="w-5 h-5" />
              </div>
              {isAdmin() && (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteCategory(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
            <h3 className="font-semibold text-slate-800 mb-1">{c.name}</h3>
            {c.description && <p className="text-xs text-slate-400 mb-2 line-clamp-2">{c.description}</p>}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Package className="w-3.5 h-3.5" /> {c.product_count} products
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Category' : 'Add Category'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="label-text">Name *</label><input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
          <div><label className="label-text">Description</label><textarea className="input-field" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editItem ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

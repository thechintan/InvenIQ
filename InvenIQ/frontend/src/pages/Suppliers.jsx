import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { Truck, Plus, Search, Phone, Mail, MapPin, Edit2, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', contact_name: '', phone: '', email: '', address: '' });
  const { canEdit, isAdmin } = useAuth();

  useEffect(() => { loadData(); }, []);
  useEffect(() => { const t = setTimeout(() => loadData(), 300); return () => clearTimeout(t); }, [search]);

  const loadData = async () => {
    setLoading(true);
    try { const res = await api.get('/suppliers', { params: { search } }); setSuppliers(res.data.data); }
    catch {} finally { setLoading(false); }
  };

  const openCreate = () => { setEditItem(null); setForm({ name: '', contact_name: '', phone: '', email: '', address: '' }); setShowModal(true); };
  const openEdit = (s) => { setEditItem(s); setForm({ name: s.name, contact_name: s.contact_name || '', phone: s.phone || '', email: s.email || '', address: s.address || '' }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editItem) { await api.put(`/suppliers/${editItem.supplier_id}`, form); toast.success('Updated'); }
      else { await api.post('/suppliers', form); toast.success('Created'); }
      setShowModal(false); loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const toggleSupplier = async (s) => {
    try {
      await api.delete(`/suppliers/${s.supplier_id}`);
      toast.success(`Supplier ${s.is_active ? 'deactivated' : 'activated'}`);
      loadData();
    } catch (err) { toast.error('Error toggling supplier'); }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Suppliers</h1><p className="page-subtitle">Manage your supplier contacts and details</p></div>
        {canEdit() && <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> Add Supplier</button>}
      </div>

      <div className="card p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input-field pl-10" placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? [...Array(6)].map((_, i) => <div key={i} className="card h-40 skeleton" />) :
        suppliers.map((s, i) => (
          <div key={s.supplier_id} className="card-hover p-5 fade-up" style={{ animationDelay: `${i * 40}ms` }}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">{s.name}</h3>
                  {s.contact_name && <p className="text-xs text-slate-400">{s.contact_name}</p>}
                </div>
              </div>
              <span className={s.is_active ? 'badge-success' : 'badge-neutral'}>{s.is_active ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-500 mb-3">
              {s.phone && <p className="flex items-center gap-2"><Phone className="w-3 h-3" />{s.phone}</p>}
              {s.email && <p className="flex items-center gap-2"><Mail className="w-3 h-3" />{s.email}</p>}
              {s.address && <p className="flex items-center gap-2"><MapPin className="w-3 h-3" />{s.address}</p>}
            </div>
            {canEdit() && (
              <div className="flex items-center gap-1 mt-3">
                <button onClick={() => openEdit(s)} className="btn-ghost text-xs flex-1 justify-center border border-slate-200">
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
                {isAdmin() && (
                  <button onClick={() => toggleSupplier(s)} className="btn-ghost text-xs flex-1 justify-center border border-slate-200">
                    {s.is_active ? <ToggleRight className="w-3.5 h-3.5 text-emerald-500" /> : <ToggleLeft className="w-3.5 h-3.5 text-slate-400" />}
                    {s.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Supplier' : 'Add Supplier'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="label-text">Company Name *</label><input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label-text">Contact Person</label><input className="input-field" value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})} /></div>
            <div><label className="label-text">Phone</label><input className="input-field" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
          </div>
          <div><label className="label-text">Email</label><input type="email" className="input-field" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
          <div><label className="label-text">Address</label><textarea className="input-field" rows={2} value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editItem ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

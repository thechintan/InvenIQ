import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { Warehouse, Plus, MapPin, Package, IndianRupee, AlertTriangle, Edit2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', city: '', address: '', pincode: '', capacity_sqft: '' });
  const { isAdmin } = useAuth();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/warehouses');
      setWarehouses(res.data.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const openCreate = () => { setEditItem(null); setForm({ name: '', city: '', address: '', pincode: '', capacity_sqft: '' }); setShowModal(true); };
  const openEdit = (wh) => { setEditItem(wh); setForm({ name: wh.name, city: wh.city, address: wh.address || '', pincode: wh.pincode || '', capacity_sqft: wh.capacity_sqft || '' }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editItem) {
        await api.put(`/warehouses/${editItem.warehouse_id}`, form);
        toast.success('Warehouse updated');
      } else {
        await api.post('/warehouses', form);
        toast.success('Warehouse created');
      }
      setShowModal(false);
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const toggleWarehouse = async (wh) => {
    try {
      await api.delete(`/warehouses/${wh.warehouse_id}`);
      toast.success(`Warehouse ${wh.is_active ? 'deactivated' : 'activated'}`);
      loadData();
    } catch (err) { toast.error('Error'); }
  };

  const deleteWarehouse = async (wh) => {
    if (!window.confirm(`Are you sure you want to permanently remove ${wh.name}? This action cannot be undone.`)) return;
    try {
      await api.delete(`/warehouses/${wh.warehouse_id}/hard`);
      toast.success('Warehouse permanently removed');
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Error removing warehouse'); }
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    if (num >= 100000) return `₹${(num/100000).toFixed(1)}L`;
    if (num >= 1000) return `₹${(num/1000).toFixed(1)}K`;
    return `₹${num.toFixed(0)}`;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Warehouses</h1>
          <p className="page-subtitle">Manage your warehouse locations and monitor stock levels</p>
        </div>
        {isAdmin() && (
          <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> Add Warehouse</button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => <div key={i} className="card h-52 skeleton" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {warehouses.map((wh, i) => (
            <div key={wh.warehouse_id} className="card-hover overflow-hidden fade-up" style={{ animationDelay: `${i * 60}ms` }}>
              <Link to={`/warehouses/${wh.warehouse_id}`} className="block p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center">
                      <Warehouse className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 text-sm">{wh.name}</h3>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />{wh.city}
                      </p>
                    </div>
                  </div>
                  <span className={wh.is_active ? 'badge-success' : 'badge-neutral'}>
                    {wh.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <Package className="w-4 h-4 mx-auto text-slate-400 mb-1" />
                    <p className="text-lg font-bold text-slate-800">{wh.total_skus}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">SKUs</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <IndianRupee className="w-4 h-4 mx-auto text-slate-400 mb-1" />
                    <p className="text-lg font-bold text-slate-800">{formatCurrency(wh.stock_value)}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Value</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <AlertTriangle className="w-4 h-4 mx-auto text-slate-400 mb-1" />
                    <p className={`text-lg font-bold ${parseInt(wh.active_alerts) > 0 ? 'text-red-600' : 'text-slate-800'}`}>{wh.active_alerts}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Alerts</p>
                  </div>
                </div>
              </Link>

              {isAdmin() && (
                <div className="flex items-center gap-1 px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                  <button onClick={(e) => { e.preventDefault(); openEdit(wh); }} className="btn-ghost text-xs"><Edit2 className="w-3.5 h-3.5" /> Edit</button>
                  <button onClick={(e) => { e.preventDefault(); toggleWarehouse(wh); }} className="btn-ghost text-xs">
                    {wh.is_active ? <ToggleRight className="w-3.5 h-3.5 text-emerald-500" /> : <ToggleLeft className="w-3.5 h-3.5 text-slate-400" />}
                    {wh.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={(e) => { e.preventDefault(); deleteWarehouse(wh); }} className="btn-ghost text-xs text-red-500 hover:bg-red-50 hover:text-red-600 ml-auto">
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Warehouse' : 'Create Warehouse'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="label-text">Name *</label><input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label-text">City *</label><input className="input-field" value={form.city} onChange={e => setForm({...form, city: e.target.value})} required /></div>
            <div><label className="label-text">Pincode</label><input className="input-field" value={form.pincode} onChange={e => setForm({...form, pincode: e.target.value})} /></div>
          </div>
          <div><label className="label-text">Address</label><textarea className="input-field" rows={2} value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
          <div><label className="label-text">Capacity (sq ft)</label><input type="number" className="input-field" value={form.capacity_sqft} onChange={e => setForm({...form, capacity_sqft: e.target.value})} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editItem ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

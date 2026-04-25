import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { Users as UsersIcon, Plus, Edit2, Shield, UserX, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';

const roleColors = { admin: 'bg-purple-100 text-purple-700', manager: 'bg-blue-100 text-blue-700', staff: 'bg-emerald-100 text-emerald-700', viewer: 'bg-slate-100 text-slate-700' };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff' });

  useEffect(() => { loadData(); }, []);
  const loadData = async () => { setLoading(true); try { const res = await api.get('/users'); setUsers(res.data.data); } catch {} finally { setLoading(false); } };

  const openCreate = () => { setEditItem(null); setForm({ name: '', email: '', password: '', role: 'staff' }); setShowModal(true); };
  const openEdit = (u) => { setEditItem(u); setForm({ name: u.name, email: u.email, password: '', role: u.role }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form };
    if (!payload.password && editItem) delete payload.password;
    try {
      if (editItem) { await api.put(`/users/${editItem.user_id}`, payload); toast.success('User updated'); }
      else { await api.post('/users', payload); toast.success('User created'); }
      setShowModal(false); loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const toggleUser = async (u) => {
    try { await api.delete(`/users/${u.user_id}`); toast.success(`User ${u.is_active ? 'deactivated' : 'activated'}`); loadData(); }
    catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">User Management</h1><p className="page-subtitle">Manage accounts and role assignments</p></div>
        <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> Add User</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? [...Array(4)].map((_, i) => <div key={i} className="card h-40 skeleton" />) :
        users.map((u, i) => (
          <div key={u.user_id} className={`card-hover p-5 fade-up ${!u.is_active ? 'opacity-60' : ''}`} style={{ animationDelay: `${i * 40}ms` }}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-base font-bold text-primary-700">{u.name.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">{u.name}</h3>
                  <p className="text-xs text-slate-400">{u.email}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className={`badge ${roleColors[u.role]}`}><Shield className="w-3 h-3 mr-1" />{u.role}</span>
              <span className={u.is_active ? 'badge-success' : 'badge-danger'}>{u.is_active ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-100">
              <button onClick={() => openEdit(u)} className="btn-ghost text-xs flex-1 justify-center"><Edit2 className="w-3 h-3" /> Edit</button>
              <button onClick={() => toggleUser(u)} className={`btn-ghost text-xs flex-1 justify-center ${u.is_active ? 'text-red-500 hover:bg-red-50' : 'text-emerald-500 hover:bg-emerald-50'}`}>
                {u.is_active ? <><UserX className="w-3 h-3" /> Deactivate</> : <><UserCheck className="w-3 h-3" /> Activate</>}
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit User' : 'Add User'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="label-text">Full Name *</label><input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
          <div><label className="label-text">Email *</label><input type="email" className="input-field" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required /></div>
          <div><label className="label-text">{editItem ? 'New Password (leave blank to keep)' : 'Password *'}</label><input type="password" className="input-field" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required={!editItem} /></div>
          <div><label className="label-text">Role *</label>
            <select className="select-field" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
              <option value="admin">Admin</option><option value="manager">Manager</option><option value="staff">Staff</option><option value="viewer">Viewer</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editItem ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

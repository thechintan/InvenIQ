import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { ArrowLeftRight, Plus, Search, ArrowDown, ArrowUp, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import usePersistentFilters from '../hooks/usePersistentFilters';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = usePersistentFilters('transactions_filters', { warehouse_id: '', txn_type: '', start_date: '', end_date: '' });
  const [showStockIn, setShowStockIn] = useState(false);
  const [showStockOut, setShowStockOut] = useState(false);
  const [form, setForm] = useState({ warehouse_id: '', product_id: '', quantity: '', note: '', supplier_name: '' });
  const { canCreate } = useAuth();
  const [pagination, setPagination] = useState({});

  useEffect(() => {
    Promise.all([api.get('/warehouses'), api.get('/products')]).then(([w, p]) => {
      setWarehouses(w.data.data); setProducts(p.data.data);
    });
    loadData();
  }, []);
  useEffect(() => { loadData(); }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await api.get('/transactions', { params });
      setTransactions(res.data.data);
      setPagination(res.data.pagination);
    } catch {} finally { setLoading(false); }
  };

  const handleStockIn = async (e) => {
    e.preventDefault();
    try {
      await api.post('/transactions/stock-in', { ...form, quantity: parseInt(form.quantity) });
      toast.success('Stock-in recorded');
      setShowStockIn(false); setForm({ warehouse_id: '', product_id: '', quantity: '', note: '', supplier_name: '' });
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const handleStockOut = async (e) => {
    e.preventDefault();
    try {
      await api.post('/transactions/stock-out', { ...form, quantity: parseInt(form.quantity) });
      toast.success('Stock-out recorded');
      setShowStockOut(false); setForm({ warehouse_id: '', product_id: '', quantity: '', note: '', supplier_name: '' });
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const txnLabel = (t) => ({ stock_in: 'Stock In', stock_out: 'Stock Out', adjustment: 'Adjustment', transfer_in: 'Transfer In', transfer_out: 'Transfer Out', return_in: 'Return In', return_out: 'Return Out' }[t] || t);
  const txnColor = (t) => { if (t.includes('in') || t === 'return_in') return 'badge-success'; if (t.includes('out') || t === 'stock_out') return 'badge-danger'; return 'badge-warning'; };

  const StockForm = ({ onSubmit, title, isIn }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label-text">Warehouse *</label>
          <select className="select-field" value={form.warehouse_id} onChange={e => setForm({...form, warehouse_id: e.target.value})} required>
            <option value="">Select</option>
            {warehouses.filter(w => w.is_active).map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>)}
          </select>
        </div>
        <div><label className="label-text">Product *</label>
          <select className="select-field" value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value})} required>
            <option value="">Select</option>
            {products.filter(p => p.is_active).map(p => <option key={p.product_id} value={p.product_id}>{p.name} ({p.sku})</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label-text">Quantity *</label><input type="number" min="1" className="input-field" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} required /></div>
        {isIn && <div><label className="label-text">Supplier</label><input className="input-field" value={form.supplier_name} onChange={e => setForm({...form, supplier_name: e.target.value})} /></div>}
      </div>
      <div><label className="label-text">Note</label><textarea className="input-field" rows={2} value={form.note} onChange={e => setForm({...form, note: e.target.value})} /></div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={() => { setShowStockIn(false); setShowStockOut(false); }} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary">{isIn ? 'Record Stock In' : 'Record Stock Out'}</button>
      </div>
    </form>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Transactions</h1><p className="page-subtitle">Complete log of all stock movements</p></div>
        {canCreate() && (
          <div className="flex gap-2">
            <button onClick={() => { setForm({ warehouse_id: '', product_id: '', quantity: '', note: '', supplier_name: '' }); setShowStockIn(true); }} className="btn-primary bg-emerald-500 hover:bg-emerald-600"><ArrowDown className="w-4 h-4" /> Stock In</button>
            <button onClick={() => { setForm({ warehouse_id: '', product_id: '', quantity: '', note: '', supplier_name: '' }); setShowStockOut(true); }} className="btn-primary bg-red-500 hover:bg-red-600"><ArrowUp className="w-4 h-4" /> Stock Out</button>
          </div>
        )}
      </div>

      <div className="card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <select className="select-field sm:w-48" value={filters.warehouse_id} onChange={e => setFilters({...filters, warehouse_id: e.target.value})}>
            <option value="">All Warehouses</option>
            {warehouses.map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>)}
          </select>
          <select className="select-field sm:w-40" value={filters.txn_type} onChange={e => setFilters({...filters, txn_type: e.target.value})}>
            <option value="">All Types</option>
            <option value="stock_in">Stock In</option>
            <option value="stock_out">Stock Out</option>
            <option value="adjustment">Adjustment</option>
            <option value="transfer_in">Transfer In</option>
            <option value="transfer_out">Transfer Out</option>
            <option value="return_in">Return In</option>
            <option value="return_out">Return Out</option>
          </select>
          <input type="date" className="input-field sm:w-40" value={filters.start_date} onChange={e => setFilters({...filters, start_date: e.target.value})} />
          <input type="date" className="input-field sm:w-40" value={filters.end_date} onChange={e => setFilters({...filters, end_date: e.target.value})} />
        </div>
      </div>

      <div className="table-container">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Type</th><th>Product</th><th>SKU</th><th>Warehouse</th><th>Quantity</th><th>Note</th><th>By</th><th>Date</th></tr></thead>
            <tbody>
              {loading ? [...Array(8)].map((_, i) => <tr key={i}><td colSpan={8}><div className="h-5 skeleton w-full" /></td></tr>) :
              transactions.length === 0 ? <tr><td colSpan={8} className="text-center py-12 text-slate-400">No transactions found</td></tr> :
              transactions.map(t => (
                <tr key={t.txn_id}>
                  <td><span className={txnColor(t.txn_type)}>{txnLabel(t.txn_type)}</span></td>
                  <td className="font-medium text-slate-800">{t.product_name}</td>
                  <td className="font-mono text-xs text-slate-500">{t.sku}</td>
                  <td className="text-slate-600">{t.warehouse_name}</td>
                  <td className="font-bold">{t.quantity}</td>
                  <td className="text-slate-500 text-xs max-w-xs truncate">{t.note || '-'}</td>
                  <td className="text-slate-500">{t.user_name}</td>
                  <td className="text-xs text-slate-400">{new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination.total > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 text-xs text-slate-500">
            Showing {transactions.length} of {pagination.total} transactions
          </div>
        )}
      </div>

      <Modal isOpen={showStockIn} onClose={() => setShowStockIn(false)} title="Record Stock In" maxWidth="max-w-xl">
        <StockForm onSubmit={handleStockIn} title="Stock In" isIn={true} />
      </Modal>
      <Modal isOpen={showStockOut} onClose={() => setShowStockOut(false)} title="Record Stock Out" maxWidth="max-w-xl">
        <StockForm onSubmit={handleStockOut} title="Stock Out" isIn={false} />
      </Modal>
    </div>
  );
}

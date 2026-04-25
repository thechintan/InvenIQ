import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { Warehouse, ArrowLeft, Package, IndianRupee, AlertTriangle, MapPin, Maximize, Plus } from 'lucide-react';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';

export default function WarehouseDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ product_id: '', quantity: '', note: '', supplier_name: '' });

  const loadData = () => {
    setLoading(true);
    Promise.all([api.get(`/warehouses/${id}`), api.get('/products')])
      .then(([whRes, pRes]) => { 
        setData(whRes.data.data); 
        setProducts(pRes.data.data);
        setLoading(false); 
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/transactions/stock-in', { ...form, warehouse_id: id, quantity: parseInt(form.quantity) });
      toast.success('Stock added to warehouse');
      setShowModal(false);
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Error adding stock'); }
  };

  if (loading) return <div className="page-container"><div className="card h-96 skeleton" /></div>;
  if (!data) return <div className="page-container"><p className="text-slate-500">Warehouse not found</p></div>;

  return (
    <div className="page-container">
      <Link to="/warehouses" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Warehouses
      </Link>

      <div className="card p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center">
              <Warehouse className="w-7 h-7 text-primary-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">{data.name}</h1>
              <p className="text-sm text-slate-400 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{data.city} {data.pincode && `- ${data.pincode}`}</p>
              {data.address && <p className="text-xs text-slate-400 mt-0.5">{data.address}</p>}
            </div>
          </div>
          <div className="flex items-center gap-6 text-center">
            <div><p className="text-2xl font-bold text-slate-800">{data.summary?.total_skus}</p><p className="text-xs text-slate-500">SKUs</p></div>
            <div className="w-px h-10 bg-slate-200" />
            <div><p className="text-2xl font-bold text-slate-800">{data.summary?.total_stock.toLocaleString()}</p><p className="text-xs text-slate-500">Total Units</p></div>
            <div className="w-px h-10 bg-slate-200" />
            <div><p className="text-2xl font-bold text-emerald-600">₹{(data.summary?.stock_value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p><p className="text-xs text-slate-500">Stock Value</p></div>
            {data.capacity_sqft && (<><div className="w-px h-10 bg-slate-200" /><div><p className="text-2xl font-bold text-slate-800">{data.capacity_sqft.toLocaleString()}</p><p className="text-xs text-slate-500">Sq Ft</p></div></>)}
          </div>
        </div>
      </div>

      {data.alerts?.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Active Alerts ({data.alerts.length})
          </h3>
          <div className="space-y-2">
            {data.alerts.map(a => (
              <div key={a.alert_id} className={`card p-3 border-l-4 ${a.severity === 'critical' ? 'border-l-red-500 bg-red-50/30' : 'border-l-amber-500 bg-amber-50/30'}`}>
                <p className="text-sm text-slate-700">{a.message}</p>
                {a.ai_summary && <p className="text-xs text-slate-500 mt-1 italic">{a.ai_summary}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">Inventory ({data.inventory?.length || 0} items)</h3>
          <button onClick={() => { setForm({ product_id: '', quantity: '', note: '', supplier_name: '' }); setShowModal(true); }} className="btn-secondary text-xs py-1.5">
            <Plus className="w-3.5 h-3.5" /> Receive Stock
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Reorder Level</th>
                <th>Unit Price</th>
                <th>Stock Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.inventory?.map(item => (
                <tr key={item.inventory_id}>
                  <td className="font-medium text-slate-800">
                    <Link to={`/products/${item.product_id}`} className="hover:text-primary-600">{item.product_name}</Link>
                  </td>
                  <td className="text-xs font-mono text-slate-500">{item.sku}</td>
                  <td>{item.category_name || '-'}</td>
                  <td className="font-semibold">{item.quantity}</td>
                  <td className="text-slate-500">{item.reorder_level}</td>
                  <td>₹{parseFloat(item.price).toLocaleString('en-IN')}</td>
                  <td className="font-medium">₹{parseFloat(item.stock_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td>
                    {item.low_stock ? (
                      <span className="badge-danger">Low Stock</span>
                    ) : (
                      <span className="badge-success">In Stock</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Receive Stock">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="label-text">Product *</label>
            <select className="select-field" value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value})} required>
              <option value="">Select Product</option>
              {products.filter(p=>p.is_active).map(p => <option key={p.product_id} value={p.product_id}>{p.name} ({p.sku})</option>)}
            </select>
          </div>
          <div><label className="label-text">Quantity to Receive *</label><input type="number" min="1" className="input-field" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} required /></div>
          <div><label className="label-text">Supplier (Optional)</label><input className="input-field" value={form.supplier_name} onChange={e => setForm({...form, supplier_name: e.target.value})} /></div>
          <div><label className="label-text">Notes</label><textarea className="input-field" rows={2} value={form.note} onChange={e => setForm({...form, note: e.target.value})} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Add Stock</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

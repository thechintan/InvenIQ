import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Search, Filter, AlertTriangle, Boxes } from 'lucide-react';
import usePersistentFilters from '../hooks/usePersistentFilters';

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = usePersistentFilters('inventory_filters', { warehouse_id: '', category_id: '', low_stock: '', search: '' });

  useEffect(() => {
    Promise.all([api.get('/warehouses'), api.get('/categories')]).then(([w, c]) => {
      setWarehouses(w.data.data); setCategories(c.data.data);
    });
    loadData();
  }, []);

  useEffect(() => { const t = setTimeout(() => loadData(), 300); return () => clearTimeout(t); }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.warehouse_id) params.warehouse_id = filters.warehouse_id;
      if (filters.category_id) params.category_id = filters.category_id;
      if (filters.low_stock) params.low_stock = filters.low_stock;
      if (filters.search) params.search = filters.search;
      const res = await api.get('/inventory', { params });
      setInventory(res.data.data);
    } catch {} finally { setLoading(false); }
  };

  const totalValue = inventory.reduce((sum, i) => sum + parseFloat(i.stock_value || 0), 0);
  const lowStockCount = inventory.filter(i => i.low_stock).length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Inventory</h1><p className="page-subtitle">Complete stock levels across all warehouses</p></div>
        <div className="flex items-center gap-4 text-sm">
          <div className="card px-4 py-2">
            <span className="text-slate-500">Total Value: </span>
            <span className="font-bold text-emerald-600">₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
          {lowStockCount > 0 && (
            <div className="card px-4 py-2 border-amber-200 bg-amber-50">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 inline mr-1.5" />
              <span className="font-semibold text-amber-700">{lowStockCount} low stock items</span>
            </div>
          )}
        </div>
      </div>

      <div className="card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input-field pl-10" placeholder="Search by product name or SKU..." value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} />
          </div>
          <select className="select-field sm:w-48" value={filters.warehouse_id} onChange={e => setFilters({...filters, warehouse_id: e.target.value})}>
            <option value="">All Warehouses</option>
            {warehouses.map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>)}
          </select>
          <select className="select-field sm:w-44" value={filters.category_id} onChange={e => setFilters({...filters, category_id: e.target.value})}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
          </select>
          <select className="select-field sm:w-36" value={filters.low_stock} onChange={e => setFilters({...filters, low_stock: e.target.value})}>
            <option value="">All Stock</option>
            <option value="true">Low Stock Only</option>
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
                <th>Warehouse</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Reorder Level</th>
                <th>Unit Price</th>
                <th>Stock Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? [...Array(8)].map((_, i) => <tr key={i}><td colSpan={9}><div className="h-5 skeleton w-full" /></td></tr>) :
              inventory.length === 0 ? <tr><td colSpan={9} className="text-center py-12 text-slate-400">No inventory records found</td></tr> :
              inventory.map(item => (
                <tr key={item.inventory_id} className={item.low_stock ? 'bg-red-50/30' : ''}>
                  <td className="font-medium text-slate-800">{item.product_name}</td>
                  <td className="font-mono text-xs text-slate-500">{item.sku}</td>
                  <td className="text-slate-600">{item.warehouse_name}</td>
                  <td><span className="badge-info">{item.category_name || '-'}</span></td>
                  <td className={`font-bold ${item.low_stock ? 'text-red-600' : 'text-slate-800'}`}>{item.quantity}</td>
                  <td className="text-slate-500">{item.reorder_level}</td>
                  <td>₹{parseFloat(item.price).toLocaleString('en-IN')}</td>
                  <td className="font-medium">₹{parseFloat(item.stock_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td>{item.low_stock ? <span className="badge-danger">⚠ Low</span> : <span className="badge-success">OK</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

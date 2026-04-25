const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/dashboard/summary
router.get('/summary', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM warehouses) as total_warehouses,
        (SELECT COUNT(*) FROM products WHERE is_active = true) as total_products,
        (SELECT COALESCE(SUM(i.quantity * p.price), 0) FROM inventory i JOIN products p ON i.product_id = p.product_id) as total_stock_value,
        (SELECT COALESCE(SUM(quantity), 0) FROM inventory) as total_stock_units,
        (SELECT COUNT(*) FROM orders WHERE status IN ('draft', 'confirmed')) as pending_orders,
        (SELECT COUNT(*) FROM alerts WHERE is_resolved = false) as active_alerts,
        (SELECT COUNT(*) FROM alerts WHERE is_resolved = false AND severity = 'critical') as critical_alerts,
        (SELECT COUNT(*) FROM transactions WHERE created_at >= NOW() - INTERVAL '7 days') as weekly_transactions,
        (SELECT COUNT(*) FROM inventory WHERE quantity <= reorder_level) as low_stock_items,
        (SELECT COUNT(*) FROM returns WHERE created_at >= NOW() - INTERVAL '30 days') as monthly_returns
    `);
    res.json({ success: true, data: stats.rows[0] });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/dashboard/stock-trend - Daily movement for last 30 days
router.get('/stock-trend', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        TO_CHAR(d.date, 'YYYY-MM-DD') as date,
        COALESCE(SUM(CASE WHEN t.txn_type IN ('stock_in', 'transfer_in', 'return_in') THEN t.quantity ELSE 0 END), 0) as stock_in,
        COALESCE(SUM(CASE WHEN t.txn_type IN ('stock_out', 'transfer_out', 'return_out') THEN t.quantity ELSE 0 END), 0) as stock_out
      FROM (
        SELECT current_date - i AS date
        FROM generate_series(0, 29) i
      ) d
      LEFT JOIN transactions t ON DATE(t.created_at) = d.date
      GROUP BY d.date
      ORDER BY d.date
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Stock trend error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/dashboard/category-split - Stock value per category
router.get('/category-split', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.name as category, 
        COALESCE(SUM(i.quantity * p.price), 0) as value,
        COALESCE(SUM(i.quantity), 0) as quantity,
        COUNT(DISTINCT p.product_id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.category_id = p.category_id
      LEFT JOIN inventory i ON p.product_id = i.product_id
      GROUP BY c.category_id, c.name
      HAVING COALESCE(SUM(i.quantity * p.price), 0) > 0
      ORDER BY value DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Category split error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/dashboard/top-products - Top 5 most moved products
router.get('/top-products', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.name, p.sku,
        SUM(t.quantity) as total_movement,
        SUM(CASE WHEN t.txn_type = 'stock_in' THEN t.quantity ELSE 0 END) as total_in,
        SUM(CASE WHEN t.txn_type = 'stock_out' THEN t.quantity ELSE 0 END) as total_out
      FROM transactions t
      JOIN inventory i ON t.inventory_id = i.inventory_id
      JOIN products p ON i.product_id = p.product_id
      WHERE t.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY p.product_id, p.name, p.sku
      ORDER BY total_movement DESC
      LIMIT 10
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Top products error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/dashboard/recent-activity
router.get('/recent-activity', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.txn_id, t.txn_type, t.quantity, t.note, t.created_at,
        p.name as product_name, p.sku, w.name as warehouse_name, u.name as user_name
      FROM transactions t
      JOIN inventory i ON t.inventory_id = i.inventory_id
      JOIN products p ON i.product_id = p.product_id
      JOIN warehouses w ON i.warehouse_id = w.warehouse_id
      LEFT JOIN users u ON t.created_by = u.user_id
      ORDER BY t.created_at DESC
      LIMIT 15
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Recent activity error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/dashboard/warehouse-summary
router.get('/warehouse-summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT w.warehouse_id, w.name, w.city,
        COALESCE(SUM(i.quantity), 0) as total_stock,
        COALESCE(SUM(i.quantity * p.price), 0) as stock_value,
        COUNT(DISTINCT i.product_id) as sku_count,
        COALESCE(al.alert_count, 0) as alert_count
      FROM warehouses w
      LEFT JOIN inventory i ON w.warehouse_id = i.warehouse_id
      LEFT JOIN products p ON i.product_id = p.product_id
      LEFT JOIN (
        SELECT inv.warehouse_id, COUNT(*) as alert_count
        FROM alerts a JOIN inventory inv ON a.inventory_id = inv.inventory_id
        WHERE a.is_resolved = false
        GROUP BY inv.warehouse_id
      ) al ON w.warehouse_id = al.warehouse_id
      GROUP BY w.warehouse_id, w.name, w.city, al.alert_count
      ORDER BY stock_value DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Warehouse summary error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;

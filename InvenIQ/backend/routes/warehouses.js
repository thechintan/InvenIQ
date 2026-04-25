const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const requireRole = require('../middleware/rbac');

// GET /api/warehouses - List all warehouses
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT w.*, u.name as created_by_name,
        COALESCE(inv.total_skus, 0) as total_skus,
        COALESCE(inv.total_stock, 0) as total_stock,
        COALESCE(inv.stock_value, 0) as stock_value,
        COALESCE(al.active_alerts, 0) as active_alerts
      FROM warehouses w
      LEFT JOIN users u ON w.created_by = u.user_id
      LEFT JOIN (
        SELECT i.warehouse_id, 
          COUNT(DISTINCT i.product_id) as total_skus,
          SUM(i.quantity) as total_stock,
          SUM(i.quantity * p.price) as stock_value
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id
        GROUP BY i.warehouse_id
      ) inv ON w.warehouse_id = inv.warehouse_id
      LEFT JOIN (
        SELECT i.warehouse_id, COUNT(*) as active_alerts
        FROM alerts a
        JOIN inventory i ON a.inventory_id = i.inventory_id
        WHERE a.is_resolved = false
        GROUP BY i.warehouse_id
      ) al ON w.warehouse_id = al.warehouse_id
      ORDER BY w.created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('List warehouses error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/warehouses/:id - Get warehouse details with inventory
router.get('/:id', async (req, res) => {
  try {
    const warehouseResult = await pool.query(
      `SELECT w.*, u.name as created_by_name FROM warehouses w 
       LEFT JOIN users u ON w.created_by = u.user_id 
       WHERE w.warehouse_id = $1`,
      [req.params.id]
    );
    if (warehouseResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Warehouse not found' });
    }

    const inventoryResult = await pool.query(`
      SELECT i.*, p.name as product_name, p.sku, p.unit, p.price, c.name as category_name,
        (i.quantity * p.price) as stock_value,
        CASE WHEN i.quantity <= i.reorder_level THEN true ELSE false END as low_stock
      FROM inventory i
      JOIN products p ON i.product_id = p.product_id
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE i.warehouse_id = $1
      ORDER BY p.name
    `, [req.params.id]);

    const alertsResult = await pool.query(`
      SELECT a.* FROM alerts a
      JOIN inventory i ON a.inventory_id = i.inventory_id
      WHERE i.warehouse_id = $1 AND a.is_resolved = false
      ORDER BY a.created_at DESC LIMIT 10
    `, [req.params.id]);

    res.json({
      success: true,
      data: {
        ...warehouseResult.rows[0],
        inventory: inventoryResult.rows,
        alerts: alertsResult.rows,
        summary: {
          total_skus: inventoryResult.rows.length,
          total_stock: inventoryResult.rows.reduce((sum, r) => sum + r.quantity, 0),
          stock_value: inventoryResult.rows.reduce((sum, r) => sum + parseFloat(r.stock_value || 0), 0),
          low_stock_items: inventoryResult.rows.filter(r => r.low_stock).length,
        }
      },
    });
  } catch (err) {
    console.error('Get warehouse error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/warehouses - Create warehouse (Admin only)
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { name, city, address, pincode, capacity_sqft } = req.body;
    if (!name || !city) {
      return res.status(400).json({ success: false, error: 'Name and city are required' });
    }

    const result = await pool.query(
      `INSERT INTO warehouses (name, city, address, pincode, capacity_sqft, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, city, address, pincode, capacity_sqft, req.user.userId]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Create warehouse error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PUT /api/warehouses/:id - Update warehouse (Admin only)
router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { name, city, address, pincode, capacity_sqft } = req.body;
    const result = await pool.query(
      `UPDATE warehouses SET 
        name = COALESCE($1, name), city = COALESCE($2, city), 
        address = COALESCE($3, address), pincode = COALESCE($4, pincode),
        capacity_sqft = COALESCE($5, capacity_sqft)
       WHERE warehouse_id = $6 RETURNING *`,
      [name, city, address, pincode, capacity_sqft, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Warehouse not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Update warehouse error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// DELETE /api/warehouses/:id - Soft deactivate (Admin only)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE warehouses SET is_active = NOT is_active WHERE warehouse_id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Warehouse not found' });
    }
    const action = result.rows[0].is_active ? 'activated' : 'deactivated';
    res.json({ success: true, message: `Warehouse ${action}`, data: result.rows[0] });
  } catch (err) {
    console.error('Toggle warehouse error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// DELETE /api/warehouses/:id/hard - Hard delete (Admin only)
router.delete('/:id/hard', requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM warehouses WHERE warehouse_id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Warehouse not found' });
    }
    res.json({ success: true, message: 'Warehouse deleted successfully' });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ success: false, error: 'Cannot delete warehouse with existing inventory or history. Please deactivate it instead.' });
    }
    console.error('Hard delete warehouse error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;

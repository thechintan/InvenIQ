const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/inventory - Full inventory list with filters
router.get('/', async (req, res) => {
  try {
    const { warehouse_id, category_id, low_stock, search, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    let whereClauses = [];
    const params = [];
    let paramIdx = 1;

    if (warehouse_id) {
      whereClauses.push(`i.warehouse_id = $${paramIdx++}`);
      params.push(warehouse_id);
    }
    if (category_id) {
      whereClauses.push(`p.category_id = $${paramIdx++}`);
      params.push(category_id);
    }
    if (low_stock === 'true') {
      whereClauses.push('i.quantity <= i.reorder_level');
    }
    if (search) {
      whereClauses.push(`(p.name ILIKE $${paramIdx} OR p.sku ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const result = await pool.query(`
      SELECT i.*, p.name as product_name, p.sku, p.unit, p.price, p.is_active as product_active,
        c.name as category_name, w.name as warehouse_name, w.city as warehouse_city,
        (i.quantity * p.price) as stock_value,
        CASE WHEN i.quantity <= i.reorder_level THEN true ELSE false END as low_stock
      FROM inventory i
      JOIN products p ON i.product_id = p.product_id
      JOIN warehouses w ON i.warehouse_id = w.warehouse_id
      LEFT JOIN categories c ON p.category_id = c.category_id
      ${whereStr}
      ORDER BY w.name, p.name
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `, [...params, limit, offset]);

    const countResult = await pool.query(`
      SELECT COUNT(*) FROM inventory i
      JOIN products p ON i.product_id = p.product_id
      JOIN warehouses w ON i.warehouse_id = w.warehouse_id
      LEFT JOIN categories c ON p.category_id = c.category_id
      ${whereStr}
    `, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countResult.rows[0].count / limit),
      },
    });
  } catch (err) {
    console.error('List inventory error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/inventory/:warehouseId - Stock levels for one warehouse
router.get('/:warehouseId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.*, p.name as product_name, p.sku, p.unit, p.price,
        c.name as category_name,
        (i.quantity * p.price) as stock_value,
        CASE WHEN i.quantity <= i.reorder_level THEN true ELSE false END as low_stock
      FROM inventory i
      JOIN products p ON i.product_id = p.product_id
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE i.warehouse_id = $1
      ORDER BY p.name
    `, [req.params.warehouseId]);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get warehouse inventory error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;

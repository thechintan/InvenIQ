const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const requireRole = require('../middleware/rbac');

// GET /api/products - List all products with stock across warehouses
router.get('/', async (req, res) => {
  try {
    const { category, search, low_stock, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (category) {
      whereClause += ` AND p.category_id = $${paramIdx++}`;
      params.push(category);
    }
    if (search) {
      whereClause += ` AND (p.name ILIKE $${paramIdx} OR p.sku ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    const result = await pool.query(`
      SELECT p.*, c.name as category_name,
        COALESCE(inv.total_stock, 0) as total_stock,
        COALESCE(inv.warehouse_count, 0) as warehouse_count,
        COALESCE(inv.total_value, 0) as total_value
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN (
        SELECT product_id, 
          SUM(quantity) as total_stock,
          COUNT(DISTINCT warehouse_id) as warehouse_count,
          SUM(quantity * (SELECT price FROM products WHERE product_id = i.product_id)) as total_value
        FROM inventory i
        GROUP BY product_id
      ) inv ON p.product_id = inv.product_id
      ${whereClause}
      ${low_stock === 'true' ? 'AND COALESCE(inv.total_stock, 0) <= 10' : ''}
      ORDER BY p.name
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `, [...params, limit, offset]);

    const countResult = await pool.query(`
      SELECT COUNT(*) FROM products p ${whereClause}
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
    console.error('List products error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/products/:id - Product detail with per-warehouse stock
router.get('/:id', async (req, res) => {
  try {
    const productResult = await pool.query(`
      SELECT p.*, c.name as category_name, u.name as created_by_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN users u ON p.created_by = u.user_id
      WHERE p.product_id = $1
    `, [req.params.id]);

    if (productResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const stockResult = await pool.query(`
      SELECT i.*, w.name as warehouse_name, w.city,
        CASE WHEN i.quantity <= i.reorder_level THEN true ELSE false END as low_stock
      FROM inventory i
      JOIN warehouses w ON i.warehouse_id = w.warehouse_id
      WHERE i.product_id = $1
      ORDER BY w.name
    `, [req.params.id]);

    const txnResult = await pool.query(`
      SELECT t.*, w.name as warehouse_name
      FROM transactions t
      JOIN inventory i ON t.inventory_id = i.inventory_id
      JOIN warehouses w ON i.warehouse_id = w.warehouse_id
      WHERE i.product_id = $1
      ORDER BY t.created_at DESC
      LIMIT 20
    `, [req.params.id]);

    res.json({
      success: true,
      data: {
        ...productResult.rows[0],
        stock_by_warehouse: stockResult.rows,
        recent_transactions: txnResult.rows,
        total_stock: stockResult.rows.reduce((sum, r) => sum + r.quantity, 0),
      },
    });
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/products - Create product (Admin/Manager)
router.post('/', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { name, sku, category_id, unit, price, description, expiry_date } = req.body;
    if (!name || !sku || !price) {
      return res.status(400).json({ success: false, error: 'Name, SKU, and price are required' });
    }

    const existing = await pool.query('SELECT product_id FROM products WHERE sku = $1', [sku]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'SKU already exists' });
    }

    const result = await pool.query(
      `INSERT INTO products (name, sku, category_id, unit, price, description, expiry_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [name, sku.toUpperCase(), category_id, unit || 'pcs', price, description, expiry_date || null, req.user.userId]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PUT /api/products/:id - Update product
router.put('/:id', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { name, category_id, unit, price, description, expiry_date } = req.body;
    const result = await pool.query(
      `UPDATE products SET 
        name = COALESCE($1, name), category_id = COALESCE($2, category_id),
        unit = COALESCE($3, unit), price = COALESCE($4, price),
        description = COALESCE($5, description),
        expiry_date = $6
       WHERE product_id = $7 RETURNING *`,
      [name, category_id, unit, price, description, expiry_date || null, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// DELETE /api/products/:id - Soft deactivate
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE products SET is_active = NOT is_active WHERE product_id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Toggle product error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;

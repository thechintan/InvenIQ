const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const requireRole = require('../middleware/rbac');

// GET /api/returns - List all returns
router.get('/', async (req, res) => {
  try {
    const { warehouse_id, return_type, page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;
    let whereClauses = [];
    const params = [];
    let paramIdx = 1;

    if (warehouse_id) { whereClauses.push(`r.warehouse_id = $${paramIdx++}`); params.push(warehouse_id); }
    if (return_type) { whereClauses.push(`r.return_type = $${paramIdx++}`); params.push(return_type); }

    const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const result = await pool.query(`
      SELECT r.*, p.name as product_name, p.sku, w.name as warehouse_name,
        o.customer_name as order_customer, u.name as created_by_name
      FROM returns r
      JOIN products p ON r.product_id = p.product_id
      JOIN warehouses w ON r.warehouse_id = w.warehouse_id
      LEFT JOIN orders o ON r.order_id = o.order_id
      LEFT JOIN users u ON r.created_by = u.user_id
      ${whereStr}
      ORDER BY r.created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `, [...params, limit, offset]);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('List returns error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/returns - Record a return
router.post('/', requireRole('admin', 'manager'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { order_id, warehouse_id, product_id, return_type, quantity, reason } = req.body;
    if (!warehouse_id || !product_id || !quantity || !return_type) {
      return res.status(400).json({ success: false, error: 'Warehouse, product, quantity and return type required' });
    }

    await client.query('BEGIN');

    // Create return record
    const returnResult = await client.query(
      `INSERT INTO returns (order_id, warehouse_id, product_id, return_type, quantity, reason, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [order_id, warehouse_id, product_id, return_type, quantity, reason, req.user.userId]
    );

    // Get or create inventory record
    let invResult = await client.query(
      'SELECT inventory_id FROM inventory WHERE warehouse_id = $1 AND product_id = $2',
      [warehouse_id, product_id]
    );

    let inventoryId;
    if (invResult.rows.length === 0) {
      const newInv = await client.query(
        'INSERT INTO inventory (warehouse_id, product_id, quantity) VALUES ($1, $2, 0) RETURNING inventory_id',
        [warehouse_id, product_id]
      );
      inventoryId = newInv.rows[0].inventory_id;
    } else {
      inventoryId = invResult.rows[0].inventory_id;
    }

    if (return_type === 'customer_return') {
      // Customer return: stock credited back
      await client.query(
        'UPDATE inventory SET quantity = quantity + $1, last_updated = NOW() WHERE inventory_id = $2',
        [quantity, inventoryId]
      );
      await client.query(
        `INSERT INTO transactions (inventory_id, txn_type, quantity, reference_id, note, created_by)
         VALUES ($1, 'return_in', $2, $3, $4, $5)`,
        [inventoryId, quantity, returnResult.rows[0].return_id, `Customer return: ${reason || 'N/A'}`, req.user.userId]
      );
    } else {
      // Supplier return: stock deducted
      const currentInv = await client.query('SELECT quantity FROM inventory WHERE inventory_id = $1', [inventoryId]);
      if (currentInv.rows[0].quantity < quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: 'Insufficient stock for supplier return' });
      }
      await client.query(
        'UPDATE inventory SET quantity = quantity - $1, last_updated = NOW() WHERE inventory_id = $2',
        [quantity, inventoryId]
      );
      await client.query(
        `INSERT INTO transactions (inventory_id, txn_type, quantity, reference_id, note, created_by)
         VALUES ($1, 'return_out', $2, $3, $4, $5)`,
        [inventoryId, quantity, returnResult.rows[0].return_id, `Supplier return: ${reason || 'N/A'}`, req.user.userId]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: returnResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create return error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;

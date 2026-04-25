const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const requireRole = require('../middleware/rbac');

// GET /api/transfers
router.get('/', async (req, res) => {
  try {
    const { from_warehouse_id, to_warehouse_id, page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;
    let whereClauses = [];
    const params = [];
    let paramIdx = 1;

    if (from_warehouse_id) { whereClauses.push(`t.from_warehouse_id = $${paramIdx++}`); params.push(from_warehouse_id); }
    if (to_warehouse_id) { whereClauses.push(`t.to_warehouse_id = $${paramIdx++}`); params.push(to_warehouse_id); }

    const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const result = await pool.query(`
      SELECT t.*, 
        fw.name as from_warehouse_name, fw.city as from_city,
        tw.name as to_warehouse_name, tw.city as to_city,
        p.name as product_name, p.sku,
        u.name as created_by_name
      FROM transfers t
      JOIN warehouses fw ON t.from_warehouse_id = fw.warehouse_id
      JOIN warehouses tw ON t.to_warehouse_id = tw.warehouse_id
      JOIN products p ON t.product_id = p.product_id
      LEFT JOIN users u ON t.created_by = u.user_id
      ${whereStr}
      ORDER BY t.created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `, [...params, limit, offset]);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('List transfers error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/transfers - handled by /api/transactions/transfer
// This route provides an alternate endpoint
router.post('/', requireRole('admin', 'manager'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { from_warehouse_id, to_warehouse_id, product_id, quantity, note } = req.body;
    if (!from_warehouse_id || !to_warehouse_id || !product_id || !quantity || quantity <= 0) {
      return res.status(400).json({ success: false, error: 'All fields required' });
    }
    if (from_warehouse_id === to_warehouse_id) {
      return res.status(400).json({ success: false, error: 'Source and destination must be different' });
    }

    await client.query('BEGIN');

    const srcResult = await client.query(
      'SELECT inventory_id, quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2',
      [from_warehouse_id, product_id]
    );
    if (srcResult.rows.length === 0 || srcResult.rows[0].quantity < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Insufficient stock in source warehouse' });
    }

    let dstResult = await client.query(
      'SELECT inventory_id FROM inventory WHERE warehouse_id = $1 AND product_id = $2',
      [to_warehouse_id, product_id]
    );
    let dstInventoryId;
    if (dstResult.rows.length === 0) {
      const newInv = await client.query(
        'INSERT INTO inventory (warehouse_id, product_id, quantity) VALUES ($1, $2, 0) RETURNING inventory_id',
        [to_warehouse_id, product_id]
      );
      dstInventoryId = newInv.rows[0].inventory_id;
    } else {
      dstInventoryId = dstResult.rows[0].inventory_id;
    }

    const transferResult = await client.query(
      `INSERT INTO transfers (from_warehouse_id, to_warehouse_id, product_id, quantity, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [from_warehouse_id, to_warehouse_id, product_id, quantity, note, req.user.userId]
    );

    await client.query('UPDATE inventory SET quantity = quantity - $1 WHERE inventory_id = $2',
      [quantity, srcResult.rows[0].inventory_id]);
    await client.query('UPDATE inventory SET quantity = quantity + $1 WHERE inventory_id = $2',
      [quantity, dstInventoryId]);

    await client.query(
      `INSERT INTO transactions (inventory_id, txn_type, quantity, reference_id, note, created_by)
       VALUES ($1, 'transfer_out', $2, $3, $4, $5)`,
      [srcResult.rows[0].inventory_id, quantity, transferResult.rows[0].transfer_id, note, req.user.userId]
    );
    await client.query(
      `INSERT INTO transactions (inventory_id, txn_type, quantity, reference_id, note, created_by)
       VALUES ($1, 'transfer_in', $2, $3, $4, $5)`,
      [dstInventoryId, quantity, transferResult.rows[0].transfer_id, note, req.user.userId]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: transferResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Transfer error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const requireRole = require('../middleware/rbac');

// GET /api/transactions - Transaction log with filters
router.get('/', async (req, res) => {
  try {
    const { warehouse_id, product_id, txn_type, start_date, end_date, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    let whereClauses = [];
    const params = [];
    let paramIdx = 1;

    if (warehouse_id) {
      whereClauses.push(`i.warehouse_id = $${paramIdx++}`);
      params.push(warehouse_id);
    }
    if (product_id) {
      whereClauses.push(`i.product_id = $${paramIdx++}`);
      params.push(product_id);
    }
    if (txn_type) {
      whereClauses.push(`t.txn_type = $${paramIdx++}`);
      params.push(txn_type);
    }
    if (start_date) {
      whereClauses.push(`t.created_at >= $${paramIdx++}`);
      params.push(start_date);
    }
    if (end_date) {
      whereClauses.push(`t.created_at <= $${paramIdx++}`);
      params.push(end_date);
    }

    const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const result = await pool.query(`
      SELECT t.*, p.name as product_name, p.sku, w.name as warehouse_name, u.name as user_name
      FROM transactions t
      JOIN inventory i ON t.inventory_id = i.inventory_id
      JOIN products p ON i.product_id = p.product_id
      JOIN warehouses w ON i.warehouse_id = w.warehouse_id
      LEFT JOIN users u ON t.created_by = u.user_id
      ${whereStr}
      ORDER BY t.created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `, [...params, limit, offset]);

    const countResult = await pool.query(`
      SELECT COUNT(*) FROM transactions t
      JOIN inventory i ON t.inventory_id = i.inventory_id
      JOIN products p ON i.product_id = p.product_id
      JOIN warehouses w ON i.warehouse_id = w.warehouse_id
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
    console.error('List transactions error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/transactions/stock-in - Record stock receipt
router.post('/stock-in', requireRole('admin', 'manager', 'staff'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { warehouse_id, product_id, quantity, note, supplier_name } = req.body;
    if (!warehouse_id || !product_id || !quantity || quantity <= 0) {
      return res.status(400).json({ success: false, error: 'Warehouse, product and positive quantity required' });
    }

    await client.query('BEGIN');

    // Get or create inventory record
    let invResult = await client.query(
      'SELECT inventory_id, quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2',
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

    // Update inventory quantity
    await client.query(
      'UPDATE inventory SET quantity = quantity + $1, last_updated = NOW() WHERE inventory_id = $2',
      [quantity, inventoryId]
    );

    // Create transaction record
    const txnNote = supplier_name ? `Stock-in from supplier: ${supplier_name}. ${note || ''}` : note;
    const txn = await client.query(
      `INSERT INTO transactions (inventory_id, txn_type, quantity, note, created_by)
       VALUES ($1, 'stock_in', $2, $3, $4) RETURNING *`,
      [inventoryId, quantity, txnNote, req.user.userId]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: txn.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Stock-in error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  } finally {
    client.release();
  }
});

// POST /api/transactions/stock-out - Record stock dispatch
router.post('/stock-out', requireRole('admin', 'manager', 'staff'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { warehouse_id, product_id, quantity, note } = req.body;
    if (!warehouse_id || !product_id || !quantity || quantity <= 0) {
      return res.status(400).json({ success: false, error: 'Warehouse, product and positive quantity required' });
    }

    await client.query('BEGIN');

    const invResult = await client.query(
      'SELECT inventory_id, quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2',
      [warehouse_id, product_id]
    );

    if (invResult.rows.length === 0 || invResult.rows[0].quantity < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Insufficient stock' });
    }

    const inventoryId = invResult.rows[0].inventory_id;

    await client.query(
      'UPDATE inventory SET quantity = quantity - $1, last_updated = NOW() WHERE inventory_id = $2',
      [quantity, inventoryId]
    );

    const txn = await client.query(
      `INSERT INTO transactions (inventory_id, txn_type, quantity, note, created_by)
       VALUES ($1, 'stock_out', $2, $3, $4) RETURNING *`,
      [inventoryId, quantity, note, req.user.userId]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: txn.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Stock-out error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  } finally {
    client.release();
  }
});

// POST /api/transactions/adjustment - Admin stock correction
router.post('/adjustment', requireRole('admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { warehouse_id, product_id, new_quantity, reason } = req.body;
    if (!warehouse_id || !product_id || new_quantity === undefined || !reason) {
      return res.status(400).json({ success: false, error: 'Warehouse, product, new quantity and reason required' });
    }

    await client.query('BEGIN');

    let invResult = await client.query(
      'SELECT inventory_id, quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2',
      [warehouse_id, product_id]
    );

    let inventoryId, currentQty;
    if (invResult.rows.length === 0) {
      const newInv = await client.query(
        'INSERT INTO inventory (warehouse_id, product_id, quantity) VALUES ($1, $2, 0) RETURNING inventory_id',
        [warehouse_id, product_id]
      );
      inventoryId = newInv.rows[0].inventory_id;
      currentQty = 0;
    } else {
      inventoryId = invResult.rows[0].inventory_id;
      currentQty = invResult.rows[0].quantity;
    }

    const diff = Math.abs(new_quantity - currentQty);
    if (diff === 0) {
      await client.query('ROLLBACK');
      return res.json({ success: true, message: 'No adjustment needed' });
    }

    await client.query(
      'UPDATE inventory SET quantity = $1, last_updated = NOW() WHERE inventory_id = $2',
      [new_quantity, inventoryId]
    );

    const txn = await client.query(
      `INSERT INTO transactions (inventory_id, txn_type, quantity, note, created_by)
       VALUES ($1, 'adjustment', $2, $3, $4) RETURNING *`,
      [inventoryId, diff, `Adjustment: ${currentQty} → ${new_quantity}. Reason: ${reason}`, req.user.userId]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: txn.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Adjustment error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  } finally {
    client.release();
  }
});

// POST /api/transactions/transfer - Inter-warehouse transfer
router.post('/transfer', requireRole('admin', 'manager'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { from_warehouse_id, to_warehouse_id, product_id, quantity, note } = req.body;
    if (!from_warehouse_id || !to_warehouse_id || !product_id || !quantity || quantity <= 0) {
      return res.status(400).json({ success: false, error: 'Source, destination, product and positive quantity required' });
    }
    if (from_warehouse_id === to_warehouse_id) {
      return res.status(400).json({ success: false, error: 'Source and destination warehouses must be different' });
    }

    await client.query('BEGIN');

    // Check source inventory
    const srcResult = await client.query(
      'SELECT inventory_id, quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2',
      [from_warehouse_id, product_id]
    );

    if (srcResult.rows.length === 0 || srcResult.rows[0].quantity < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Insufficient stock in source warehouse' });
    }

    // Get or create destination inventory
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

    // Create transfer record
    const transferResult = await client.query(
      `INSERT INTO transfers (from_warehouse_id, to_warehouse_id, product_id, quantity, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING transfer_id`,
      [from_warehouse_id, to_warehouse_id, product_id, quantity, note, req.user.userId]
    );
    const transferId = transferResult.rows[0].transfer_id;

    // Deduct from source
    await client.query('UPDATE inventory SET quantity = quantity - $1, last_updated = NOW() WHERE inventory_id = $2',
      [quantity, srcResult.rows[0].inventory_id]);

    // Credit to destination
    await client.query('UPDATE inventory SET quantity = quantity + $1, last_updated = NOW() WHERE inventory_id = $2',
      [quantity, dstInventoryId]);

    // Create two transaction records
    await client.query(
      `INSERT INTO transactions (inventory_id, txn_type, quantity, reference_id, note, created_by)
       VALUES ($1, 'transfer_out', $2, $3, $4, $5)`,
      [srcResult.rows[0].inventory_id, quantity, transferId, note, req.user.userId]
    );

    await client.query(
      `INSERT INTO transactions (inventory_id, txn_type, quantity, reference_id, note, created_by)
       VALUES ($1, 'transfer_in', $2, $3, $4, $5)`,
      [dstInventoryId, quantity, transferId, note, req.user.userId]
    );

    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      data: { transfer_id: transferId, from_warehouse_id, to_warehouse_id, product_id, quantity },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Transfer error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;

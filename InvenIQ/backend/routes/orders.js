const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const requireRole = require('../middleware/rbac');

// GET /api/orders - List all orders with filters
router.get('/', async (req, res) => {
  try {
    const { warehouse_id, status, start_date, end_date, page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;
    let whereClauses = [];
    const params = [];
    let paramIdx = 1;

    if (warehouse_id) { whereClauses.push(`o.warehouse_id = $${paramIdx++}`); params.push(warehouse_id); }
    if (status) { whereClauses.push(`o.status = $${paramIdx++}`); params.push(status); }
    if (start_date) { whereClauses.push(`o.created_at >= $${paramIdx++}`); params.push(start_date); }
    if (end_date) { whereClauses.push(`o.created_at <= $${paramIdx++}`); params.push(end_date); }

    const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const result = await pool.query(`
      SELECT o.*, w.name as warehouse_name, w.city as warehouse_city, u.name as created_by_name,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.order_id) as item_count
      FROM orders o
      JOIN warehouses w ON o.warehouse_id = w.warehouse_id
      LEFT JOIN users u ON o.created_by = u.user_id
      ${whereStr}
      ORDER BY o.created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `, [...params, limit, offset]);

    const countResult = await pool.query(`
      SELECT COUNT(*) FROM orders o ${whereStr}
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
    console.error('List orders error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/orders/:id - Order detail with line items
router.get('/:id', async (req, res) => {
  try {
    const orderResult = await pool.query(`
      SELECT o.*, w.name as warehouse_name, w.city as warehouse_city, u.name as created_by_name
      FROM orders o
      JOIN warehouses w ON o.warehouse_id = w.warehouse_id
      LEFT JOIN users u ON o.created_by = u.user_id
      WHERE o.order_id = $1
    `, [req.params.id]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const itemsResult = await pool.query(`
      SELECT oi.*, p.name as product_name, p.sku, p.unit,
        (oi.quantity * oi.unit_price) as line_total
      FROM order_items oi
      JOIN products p ON oi.product_id = p.product_id
      WHERE oi.order_id = $1
      ORDER BY p.name
    `, [req.params.id]);

    const returnsResult = await pool.query(`
      SELECT r.*, p.name as product_name, p.sku
      FROM returns r
      JOIN products p ON r.product_id = p.product_id
      WHERE r.order_id = $1
    `, [req.params.id]);

    res.json({
      success: true,
      data: {
        ...orderResult.rows[0],
        items: itemsResult.rows,
        returns: returnsResult.rows,
      },
    });
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/orders - Create new dispatch order
router.post('/', requireRole('admin', 'manager', 'staff'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { warehouse_id, customer_name, customer_ref, notes, items } = req.body;
    if (!warehouse_id || !items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Warehouse and at least one item required' });
    }

    await client.query('BEGIN');

    // Calculate total value
    let totalValue = 0;
    for (const item of items) {
      totalValue += item.quantity * item.unit_price;
    }

    const orderResult = await client.query(
      `INSERT INTO orders (warehouse_id, customer_name, customer_ref, notes, total_value, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [warehouse_id, customer_name, customer_ref, notes, totalValue, req.user.userId]
    );

    const orderId = orderResult.rows[0].order_id;

    // Insert order items
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [orderId, item.product_id, item.quantity, item.unit_price]
      );
    }

    await client.query('COMMIT');

    // Fetch the full order with items
    const fullOrder = await pool.query(`
      SELECT o.*, w.name as warehouse_name FROM orders o
      JOIN warehouses w ON o.warehouse_id = w.warehouse_id
      WHERE o.order_id = $1
    `, [orderId]);

    res.status(201).json({ success: true, data: fullOrder.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create order error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  } finally {
    client.release();
  }
});

// PUT /api/orders/:id/status - Update order status
router.put('/:id/status', requireRole('admin', 'manager'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { status } = req.body;
    const validStatuses = ['draft', 'confirmed', 'dispatched', 'completed', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    await client.query('BEGIN');

    // Get current order
    const orderResult = await client.query(
      'SELECT * FROM orders WHERE order_id = $1', [req.params.id]
    );
    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const currentOrder = orderResult.rows[0];

    // Validate status transitions
    const validTransitions = {
      draft: ['confirmed', 'cancelled'],
      confirmed: ['dispatched', 'cancelled'],
      dispatched: ['completed'],
      completed: [],
      cancelled: [],
    };

    if (!validTransitions[currentOrder.status]?.includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: `Cannot transition from ${currentOrder.status} to ${status}`,
      });
    }

    // If dispatching, deduct stock
    if (status === 'dispatched') {
      const items = await client.query(
        'SELECT * FROM order_items WHERE order_id = $1', [req.params.id]
      );

      for (const item of items.rows) {
        const inv = await client.query(
          'SELECT inventory_id, quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2',
          [currentOrder.warehouse_id, item.product_id]
        );

        if (inv.rows.length === 0 || inv.rows[0].quantity < item.quantity) {
          await client.query('ROLLBACK');
          const prod = await pool.query('SELECT name FROM products WHERE product_id=$1', [item.product_id]);
          return res.status(400).json({
            success: false,
            error: `Insufficient stock for ${prod.rows[0]?.name || item.product_id}`,
          });
        }

        await client.query(
          'UPDATE inventory SET quantity = quantity - $1, last_updated = NOW() WHERE inventory_id = $2',
          [item.quantity, inv.rows[0].inventory_id]
        );

        await client.query(
          `INSERT INTO transactions (inventory_id, txn_type, quantity, reference_id, note, created_by)
           VALUES ($1, 'stock_out', $2, $3, $4, $5)`,
          [inv.rows[0].inventory_id, item.quantity, req.params.id, `Order dispatch: ${currentOrder.customer_name || 'N/A'}`, req.user.userId]
        );
      }
    }

    // Update order status
    const updated = await client.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE order_id = $2 RETURNING *',
      [status, req.params.id]
    );

    await client.query('COMMIT');
    res.json({ success: true, data: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update order status error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const requireRole = require('../middleware/rbac');

// GET /api/alerts
router.get('/', async (req, res) => {
  try {
    const { alert_type, severity, is_resolved, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    let whereClauses = [];
    const params = [];
    let paramIdx = 1;

    if (alert_type) { whereClauses.push(`a.alert_type = $${paramIdx++}`); params.push(alert_type); }
    if (severity) { whereClauses.push(`a.severity = $${paramIdx++}`); params.push(severity); }
    if (is_resolved !== undefined) { whereClauses.push(`a.is_resolved = $${paramIdx++}`); params.push(is_resolved === 'true'); }

    const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const result = await pool.query(`
      SELECT a.*, p.name as product_name, p.sku, w.name as warehouse_name, w.city as warehouse_city,
        i.quantity as current_quantity, i.reorder_level, ru.name as resolved_by_name
      FROM alerts a
      JOIN inventory i ON a.inventory_id = i.inventory_id
      JOIN products p ON i.product_id = p.product_id
      JOIN warehouses w ON i.warehouse_id = w.warehouse_id
      LEFT JOIN users ru ON a.resolved_by = ru.user_id
      ${whereStr}
      ORDER BY 
        CASE a.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
        a.created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `, [...params, limit, offset]);

    const countResult = await pool.query(`
      SELECT COUNT(*) FROM alerts a ${whereStr}
    `, params);

    // Get counts by type
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE severity = 'critical' AND is_resolved = false) as critical_count,
        COUNT(*) FILTER (WHERE severity = 'warning' AND is_resolved = false) as warning_count,
        COUNT(*) FILTER (WHERE is_resolved = false) as unresolved_count,
        COUNT(*) as total_count
      FROM alerts
    `);

    res.json({
      success: true,
      data: result.rows,
      stats: statsResult.rows[0],
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countResult.rows[0].count / limit),
      },
    });
  } catch (err) {
    console.error('List alerts error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PUT /api/alerts/:id/resolve
router.put('/:id/resolve', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE alerts SET is_resolved = true, resolved_by = $1, resolved_at = NOW()
       WHERE alert_id = $2 RETURNING *`,
      [req.user.userId, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Alert not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Resolve alert error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;

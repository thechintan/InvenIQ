const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const requireRole = require('../middleware/rbac');

// GET /api/suppliers
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM suppliers';
    const params = [];
    if (search) {
      query += ' WHERE name ILIKE $1 OR contact_name ILIKE $1 OR email ILIKE $1';
      params.push(`%${search}%`);
    }
    query += ' ORDER BY name';
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('List suppliers error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/suppliers/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM suppliers WHERE supplier_id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Supplier not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Get supplier error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/suppliers
router.post('/', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { name, contact_name, phone, email, address } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
    const result = await pool.query(
      `INSERT INTO suppliers (name, contact_name, phone, email, address) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, contact_name, phone, email, address]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Create supplier error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PUT /api/suppliers/:id
router.put('/:id', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { name, contact_name, phone, email, address } = req.body;
    const result = await pool.query(
      `UPDATE suppliers SET name=COALESCE($1,name), contact_name=COALESCE($2,contact_name),
       phone=COALESCE($3,phone), email=COALESCE($4,email), address=COALESCE($5,address)
       WHERE supplier_id=$6 RETURNING *`,
      [name, contact_name, phone, email, address, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Supplier not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Update supplier error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// DELETE /api/suppliers/:id
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE suppliers SET is_active = NOT is_active WHERE supplier_id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Supplier not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Toggle supplier error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;

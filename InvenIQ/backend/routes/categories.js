const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const requireRole = require('../middleware/rbac');

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, COUNT(p.product_id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.category_id = p.category_id
      GROUP BY c.category_id
      ORDER BY c.name
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('List categories error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/categories
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });

    const result = await pool.query(
      'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'Category already exists' });
    }
    console.error('Create category error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PUT /api/categories/:id
router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { name, description } = req.body;
    const result = await pool.query(
      'UPDATE categories SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE category_id = $3 RETURNING *',
      [name, description, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Category not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// DELETE /api/categories/:id
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const products = await pool.query('SELECT COUNT(*) FROM products WHERE category_id = $1', [req.params.id]);
    if (parseInt(products.rows[0].count) > 0) {
      return res.status(400).json({ success: false, error: 'Cannot delete category with existing products' });
    }
    const result = await pool.query('DELETE FROM categories WHERE category_id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Category not found' });
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;

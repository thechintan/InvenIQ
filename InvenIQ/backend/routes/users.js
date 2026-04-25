const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const requireRole = require('../middleware/rbac');

// GET /api/users - List all users (Admin only)
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id, name, email, role, is_active, created_at, updated_at FROM users ORDER BY created_at DESC'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id, name, email, role, is_active, created_at, updated_at FROM users WHERE user_id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/users - Create user (Admin only)
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
    }

    // Check if email exists
    const existing = await pool.query('SELECT user_id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) 
       RETURNING user_id, name, email, role, is_active, created_at`,
      [name, email.toLowerCase(), password_hash, role || 'staff']
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PUT /api/users/profile - Update own profile
router.put('/profile', requireRole('admin', 'manager', 'staff'), async (req, res) => {
  try {
    const { name, current_password, new_password } = req.body;
    const userId = req.user.userId;

    if (new_password) {
      if (!current_password) {
        return res.status(400).json({ success: false, error: 'Current password is required to set a new password' });
      }
      
      const userResult = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [userId]);
      const isValid = await bcrypt.compare(current_password, userResult.rows[0].password_hash);
      if (!isValid) {
        return res.status(401).json({ success: false, error: 'Incorrect current password' });
      }

      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(new_password, salt);
      
      const result = await pool.query(
        `UPDATE users SET name = COALESCE($1, name), password_hash = $2, updated_at = NOW() 
         WHERE user_id = $3 RETURNING user_id, name, email, role, is_active`,
        [name, password_hash, userId]
      );
      return res.json({ success: true, data: result.rows[0] });
    }

    const result = await pool.query(
      `UPDATE users SET name = COALESCE($1, name), updated_at = NOW() 
       WHERE user_id = $2 RETURNING user_id, name, email, role, is_active`,
      [name, userId]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PUT /api/users/:id - Update user (Admin only)
router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { name, email, role, password } = req.body;
    let query, params;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      query = `UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), 
               role = COALESCE($3, role), password_hash = $4, updated_at = NOW() 
               WHERE user_id = $5 RETURNING user_id, name, email, role, is_active, updated_at`;
      params = [name, email?.toLowerCase(), role, password_hash, req.params.id];
    } else {
      query = `UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), 
               role = COALESCE($3, role), updated_at = NOW() 
               WHERE user_id = $4 RETURNING user_id, name, email, role, is_active, updated_at`;
      params = [name, email?.toLowerCase(), role, req.params.id];
    }

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// DELETE /api/users/:id - Soft deactivate user (Admin only)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    // Prevent self-deactivation
    if (req.params.id === req.user.userId) {
      return res.status(400).json({ success: false, error: 'Cannot deactivate your own account' });
    }

    const result = await pool.query(
      `UPDATE users SET is_active = NOT is_active, updated_at = NOW() 
       WHERE user_id = $1 RETURNING user_id, name, email, role, is_active`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const action = result.rows[0].is_active ? 'activated' : 'deactivated';
    res.json({ success: true, message: `User ${action} successfully`, data: result.rows[0] });
  } catch (err) {
    console.error('Toggle user error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;

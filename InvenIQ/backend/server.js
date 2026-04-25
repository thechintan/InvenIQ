const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const authenticate = require('./middleware/auth');
const requireRole = require('./middleware/rbac');
const { startScheduler, compileWeeklyReport, rescheduleWeeklyEmail } = require('./utils/scheduler');
const { sendWeeklySummaryEmail } = require('./utils/emailService');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Public Routes
app.use('/api/auth', require('./routes/auth'));

// Protected Routes - all require authentication
app.use('/api/users', authenticate, require('./routes/users'));
app.use('/api/warehouses', authenticate, require('./routes/warehouses'));
app.use('/api/products', authenticate, require('./routes/products'));
app.use('/api/categories', authenticate, require('./routes/categories'));
app.use('/api/suppliers', authenticate, require('./routes/suppliers'));
app.use('/api/inventory', authenticate, require('./routes/inventory'));
app.use('/api/transactions', authenticate, require('./routes/transactions'));
app.use('/api/orders', authenticate, require('./routes/orders'));
app.use('/api/returns', authenticate, require('./routes/returns'));
app.use('/api/transfers', authenticate, require('./routes/transfers'));
app.use('/api/alerts', authenticate, require('./routes/alerts'));
app.use('/api/dashboard', authenticate, require('./routes/dashboard'));
app.use('/api/ai', authenticate, require('./routes/ai'));
app.use('/api/agents', authenticate, require('./routes/agents'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Manual trigger: send weekly summary now (admin only)
app.post('/api/email/send-weekly', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const report = await compileWeeklyReport();
    if (report.recipients.length === 0) {
      return res.status(400).json({ success: false, error: 'No manager/admin emails found in database' });
    }
    const result = await sendWeeklySummaryEmail(report);
    if (result.skipped) {
      return res.status(400).json({ success: false, error: 'Email not configured. Set SMTP_USER and SMTP_PASS in .env' });
    }
    res.json({ success: true, message: `Weekly summary sent to ${result.recipients.length} recipient(s)`, recipients: result.recipients });
  } catch (err) {
    console.error('Manual email error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Preview weekly report data (admin only)
app.get('/api/email/preview', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const report = await compileWeeklyReport();
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Check if SMTP is configured
app.get('/api/email/status', authenticate, requireRole('admin'), (req, res) => {
  const configured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
  res.json({
    success: true,
    configured,
    smtp_user: configured ? process.env.SMTP_USER : null,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════════╗`);
  console.log(`  ║   InvenIQ Backend Server                 ║`);
  console.log(`  ║   Running on http://localhost:${PORT}        ║`);
  console.log(`  ╚══════════════════════════════════════════╝\n`);
  
  // Start scheduler
  startScheduler();
});

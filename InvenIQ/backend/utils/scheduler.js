const cron = require('node-cron');
const pool = require('../config/db');
const { sendWeeklySummaryEmail } = require('./emailService');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Compile the full weekly report from the database.
 */
async function compileWeeklyReport() {
  const client = await pool.connect();
  try {
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const weekStart = weekAgo.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const weekEnd   = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    // Transaction stats
    const txnStats = await client.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN txn_type = 'stock_in' THEN quantity ELSE 0 END) as stock_in,
        SUM(CASE WHEN txn_type = 'stock_out' THEN quantity ELSE 0 END) as stock_out
      FROM transactions
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);

    // Order stats
    const orderStats = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as new_orders,
        COUNT(*) FILTER (WHERE status = 'completed' AND updated_at >= NOW() - INTERVAL '7 days') as completed_orders,
        COUNT(*) FILTER (WHERE status IN ('draft','confirmed')) as pending_orders
      FROM orders
    `);

    // Alert stats
    const alertStats = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE severity = 'critical' AND is_resolved = false) as critical_alerts,
        COUNT(*) FILTER (WHERE is_resolved = false) as total_alerts,
        COUNT(*) FILTER (WHERE is_resolved = true AND resolved_at >= NOW() - INTERVAL '7 days') as resolved_alerts
      FROM alerts
    `);

    // Top moving products this week
    const topProducts = await client.query(`
      SELECT p.name, p.sku,
        SUM(CASE WHEN t.txn_type = 'stock_in' THEN t.quantity ELSE 0 END) as total_in,
        SUM(CASE WHEN t.txn_type = 'stock_out' THEN t.quantity ELSE 0 END) as total_out
      FROM transactions t
      JOIN inventory i ON t.inventory_id = i.inventory_id
      JOIN products p ON i.product_id = p.product_id
      WHERE t.created_at >= NOW() - INTERVAL '7 days'
      GROUP BY p.product_id, p.name, p.sku
      ORDER BY (SUM(t.quantity)) DESC
      LIMIT 10
    `);

    // Low stock items
    const lowStock = await client.query(`
      SELECT p.name as product_name, w.name as warehouse_name,
             i.quantity, i.reorder_level
      FROM inventory i
      JOIN products p ON i.product_id = p.product_id
      JOIN warehouses w ON i.warehouse_id = w.warehouse_id
      WHERE i.quantity <= i.reorder_level AND p.is_active = true
      ORDER BY (i.quantity::float / NULLIF(i.reorder_level, 0)) ASC
      LIMIT 15
    `);

    // Anomalies this week
    const anomalies = await client.query(`
      SELECT p.name as product_name, w.name as warehouse_name, a.severity
      FROM alerts a
      JOIN inventory i ON a.inventory_id = i.inventory_id
      JOIN products p ON i.product_id = p.product_id
      JOIN warehouses w ON i.warehouse_id = w.warehouse_id
      WHERE a.alert_type = 'anomaly'
        AND a.created_at >= NOW() - INTERVAL '7 days'
      ORDER BY a.severity DESC
      LIMIT 10
    `);

    // Get manager + admin emails
    const recipients = await client.query(`
      SELECT email FROM users WHERE role IN ('admin','manager') AND is_active = true
    `);

    const ts = txnStats.rows[0];
    const os = orderStats.rows[0];
    const as = alertStats.rows[0];

    // Build AI summary
    let aiSummary = '';
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `You are InvenIQ's weekly reporting agent. Write a concise 3-sentence executive summary for the inventory manager based on this week's data. Be specific with numbers and highlight the most important action items.

Week: ${weekStart} to ${weekEnd}
Transactions: ${ts.total} total (${ts.stock_in} units in, ${ts.stock_out} units out)
Orders: ${os.new_orders} new, ${os.completed_orders} completed, ${os.pending_orders} pending
Alerts: ${as.critical_alerts} critical, ${as.total_alerts} total unresolved, ${as.resolved_alerts} resolved this week
Low stock items: ${lowStock.rows.length}
Anomalies detected: ${anomalies.rows.length}
Top product: ${topProducts.rows[0]?.name || 'N/A'}`;

      const result = await model.generateContent(prompt);
      aiSummary = result.response.text().trim();
    } catch (e) {
      aiSummary = `This week saw ${ts.total} transactions with ${ts.stock_in} units received and ${ts.stock_out} units dispatched. There are currently ${as.critical_alerts} critical alerts and ${lowStock.rows.length} items below reorder level requiring attention. ${os.pending_orders} orders are pending action.`;
    }

    return {
      weekStart, weekEnd,
      totalTransactions: parseInt(ts.total),
      stockIn: parseInt(ts.stock_in) || 0,
      stockOut: parseInt(ts.stock_out) || 0,
      newOrders: parseInt(os.new_orders) || 0,
      completedOrders: parseInt(os.completed_orders) || 0,
      pendingOrders: parseInt(os.pending_orders) || 0,
      criticalAlerts: parseInt(as.critical_alerts) || 0,
      totalAlerts: parseInt(as.total_alerts) || 0,
      resolvedAlerts: parseInt(as.resolved_alerts) || 0,
      topProducts: topProducts.rows,
      lowStockItems: lowStock.rows,
      anomalies: anomalies.rows,
      aiSummary,
      recipients: recipients.rows.map(r => r.email),
    };
  } finally {
    client.release();
  }
}

let weeklyEmailTask = null;

async function runWeeklyEmail() {
  console.log('\n📅 [Scheduler] Running weekly summary email...');
  try {
    const report = await compileWeeklyReport();
    if (report.recipients.length === 0) {
      console.warn('⚠️  No manager/admin emails found in DB');
      return;
    }
    const result = await sendWeeklySummaryEmail(report);
    if (result.skipped) {
      console.warn('⚠️  Email skipped — SMTP not configured');
    } else {
      console.log(`✅ Weekly summary sent to ${result.recipients.length} recipients`);
    }
  } catch (err) {
    console.error('❌ Weekly email failed:', err.message);
  }
}

/**
 * Start all scheduled jobs.
 */
function startScheduler() {
  // Default: Every Monday at 8:00 AM IST
  weeklyEmailTask = cron.schedule('0 8 * * 1', runWeeklyEmail, { timezone: 'Asia/Kolkata' });
  console.log('⏰ Scheduler started — Weekly summary email: Every Monday 8:00 AM IST');
}

/**
 * Reschedule the weekly email with new config.
 * @param {{ enabled: boolean, day: number, hour: number, minute: number, timezone: string }} config
 */
function rescheduleWeeklyEmail(config) {
  if (weeklyEmailTask) {
    weeklyEmailTask.stop();
    weeklyEmailTask = null;
  }
  if (!config.enabled) {
    console.log('⏰ Weekly email scheduler disabled');
    return;
  }
  const cronExpr = `${config.minute} ${config.hour} * * ${config.day}`;
  weeklyEmailTask = cron.schedule(cronExpr, runWeeklyEmail, { timezone: config.timezone || 'Asia/Kolkata' });
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  console.log(`⏰ Weekly email rescheduled — ${days[config.day]} at ${String(config.hour).padStart(2,'0')}:${String(config.minute).padStart(2,'0')} IST`);
}

module.exports = { startScheduler, compileWeeklyReport, rescheduleWeeklyEmail };

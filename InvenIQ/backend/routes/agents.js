const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const requireRole = require('../middleware/rbac');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─────────────────────────────────────────────────────────────
// AGENT 1: Restock Agent
// Scans all critical/warning restock alerts and auto-drafts
// purchase orders grouped by warehouse, with AI reasoning.
// ─────────────────────────────────────────────────────────────
router.post('/restock-agent', requireRole('admin', 'manager'), async (req, res) => {
  const client = await pool.connect();
  try {
    // 1. Find all unresolved critical/warning restock alerts
    const alerts = await client.query(`
      SELECT a.alert_id, a.severity, a.message, a.metadata,
             i.inventory_id, i.quantity, i.reorder_level,
             p.product_id, p.name as product_name, p.sku, p.price, p.unit,
             w.warehouse_id, w.name as warehouse_name, w.city
      FROM alerts a
      JOIN inventory i ON a.inventory_id = i.inventory_id
      JOIN products p ON i.product_id = p.product_id
      JOIN warehouses w ON i.warehouse_id = w.warehouse_id
      WHERE a.alert_type = 'restock' AND a.is_resolved = false
        AND a.severity IN ('critical', 'warning')
      ORDER BY a.severity DESC, (a.metadata->>'days_to_stockout')::int ASC
    `);

    if (alerts.rows.length === 0) {
      return res.json({ success: true, message: 'No critical restock alerts found. Inventory looks healthy!', orders_drafted: 0, actions: [] });
    }

    // 2. Group by warehouse
    const byWarehouse = {};
    for (const alert of alerts.rows) {
      const wid = alert.warehouse_id;
      if (!byWarehouse[wid]) {
        byWarehouse[wid] = { warehouse_id: wid, warehouse_name: alert.warehouse_name, city: alert.city, items: [] };
      }
      const meta = alert.metadata || {};
      byWarehouse[wid].items.push({
        alert_id: alert.alert_id,
        product_id: alert.product_id,
        product_name: alert.product_name,
        sku: alert.sku,
        price: parseFloat(alert.price),
        unit: alert.unit,
        current_qty: alert.quantity,
        reorder_level: alert.reorder_level,
        days_to_stockout: meta.days_to_stockout || 0,
        avg_daily: meta.avg_daily_consumption || 0,
        suggested_qty: meta.suggested_restock || Math.ceil(alert.reorder_level * 2),
        severity: alert.severity,
      });
    }

    const actions = [];
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // 3. For each warehouse, get AI reasoning then draft order
    for (const wh of Object.values(byWarehouse)) {
      const itemsSummary = wh.items.map(it =>
        `- ${it.product_name} (${it.sku}): ${it.current_qty} units left, ~${it.days_to_stockout} days to stockout, suggest ordering ${it.suggested_qty} units @ ₹${it.price}`
      ).join('\n');

      const totalValue = wh.items.reduce((sum, it) => sum + it.suggested_qty * it.price, 0);

      // AI reasoning
      let reasoning = '';
      try {
        const prompt = `You are an autonomous inventory restock agent for InvenIQ. Analyze these low-stock items at ${wh.warehouse_name} (${wh.city}) and provide a 2-3 sentence action summary explaining urgency and recommended approach. Be concise and specific with numbers.

Items needing restock:
${itemsSummary}

Total estimated order value: ₹${totalValue.toFixed(2)}`;
        const result = await model.generateContent(prompt);
        reasoning = result.response.text().trim();
      } catch (e) {
        reasoning = `Auto-drafted restock order for ${wh.items.length} critical items at ${wh.warehouse_name}. Immediate action required to prevent stockouts.`;
      }

      // Find a system user (admin) to attribute the order to
      const adminUser = await client.query(`SELECT user_id FROM users WHERE role = 'admin' LIMIT 1`);
      const createdBy = adminUser.rows[0]?.user_id;

      // Draft the order
      await client.query('BEGIN');
      const orderRes = await client.query(`
        INSERT INTO orders (warehouse_id, status, customer_name, customer_ref, total_value, notes, created_by)
        VALUES ($1, 'draft', 'RESTOCK ORDER', $2, $3, $4, $5)
        RETURNING order_id
      `, [
        wh.warehouse_id,
        `AGENT-RESTOCK-${Date.now()}`,
        totalValue,
        `[AUTO] Restock Agent: ${reasoning}`,
        createdBy,
      ]);

      const orderId = orderRes.rows[0].order_id;

      for (const item of wh.items) {
        await client.query(`
          INSERT INTO order_items (order_id, product_id, quantity, unit_price)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (order_id, product_id) DO NOTHING
        `, [orderId, item.product_id, item.suggested_qty, item.price]);
      }

      await client.query('COMMIT');

      actions.push({
        warehouse: wh.warehouse_name,
        city: wh.city,
        order_id: orderId,
        items_count: wh.items.length,
        total_value: totalValue,
        reasoning,
        items: wh.items.map(i => ({ name: i.product_name, sku: i.sku, qty: i.suggested_qty, days_left: i.days_to_stockout, severity: i.severity })),
      });
    }

    res.json({
      success: true,
      message: `Restock Agent drafted ${actions.length} purchase order(s) covering ${alerts.rows.length} critical items.`,
      orders_drafted: actions.length,
      actions,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Restock agent error:', err);
    res.status(500).json({ success: false, error: 'Restock agent failed: ' + err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────
// AGENT 2: Anomaly Investigator Agent
// For each unresolved anomaly alert, uses AI to investigate
// root cause, cross-reference patterns, and suggest action.
// ─────────────────────────────────────────────────────────────
router.post('/anomaly-agent', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const anomalies = await pool.query(`
      SELECT a.alert_id, a.severity, a.message, a.metadata, a.created_at,
             i.inventory_id, i.quantity,
             p.name as product_name, p.sku, p.price, p.unit,
             w.name as warehouse_name, w.city
      FROM alerts a
      JOIN inventory i ON a.inventory_id = i.inventory_id
      JOIN products p ON i.product_id = p.product_id
      JOIN warehouses w ON i.warehouse_id = w.warehouse_id
      WHERE a.alert_type = 'anomaly' AND a.is_resolved = false
      ORDER BY a.severity DESC, a.created_at DESC
      LIMIT 10
    `);

    if (anomalies.rows.length === 0) {
      return res.json({ success: true, message: 'No unresolved anomalies found. All movements look normal!', investigations: [] });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const investigations = [];

    for (const anomaly of anomalies.rows) {
      // Get recent transaction history for context
      const history = await pool.query(`
        SELECT DATE(t.created_at) as date, t.txn_type, SUM(t.quantity) as qty,
               u.name as user_name
        FROM transactions t
        JOIN inventory i ON t.inventory_id = i.inventory_id
        LEFT JOIN users u ON t.created_by = u.user_id
        WHERE i.inventory_id = $1 AND t.created_at >= NOW() - INTERVAL '14 days'
        GROUP BY DATE(t.created_at), t.txn_type, u.name
        ORDER BY date DESC
        LIMIT 20
      `, [anomaly.inventory_id]);

      const historyText = history.rows.map(h =>
        `${h.date}: ${h.txn_type} x${h.qty} (by ${h.user_name || 'system'})`
      ).join('\n');

      const meta = anomaly.metadata || {};

      let investigation = { verdict: '', root_cause: '', action: '', risk: 'medium' };
      try {
        const prompt = `You are an autonomous anomaly investigation agent for InvenIQ inventory system. Analyze this anomaly and provide a structured investigation.

ANOMALY DETAILS:
Product: ${anomaly.product_name} (${anomaly.sku}) @ ${anomaly.warehouse_name}, ${anomaly.city}
Current Stock: ${anomaly.quantity} units
Anomaly Date: ${meta.txn_date || 'recent'}
Units Moved: ${meta.daily_qty || 'unknown'} (${meta.deviation_percent || '?'}% deviation from mean of ${meta.mean?.toFixed(1) || '?'})
Z-Score: ${meta.z_score?.toFixed(2) || '?'} (threshold: 2.0)
Transaction Types: ${anomaly.message}

RECENT 14-DAY HISTORY:
${historyText || 'No history available'}

Respond in this exact JSON format (no markdown):
{
  "verdict": "one sentence verdict",
  "root_cause": "likely root cause in 1-2 sentences",
  "action": "specific recommended action",
  "risk": "low|medium|high"
}`;

        const result = await model.generateContent(prompt);
        let text = result.response.text().trim();
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        investigation = JSON.parse(text);
      } catch (e) {
        investigation = {
          verdict: `Unusual movement detected for ${anomaly.product_name}.`,
          root_cause: `Z-score of ${anomaly.metadata?.z_score?.toFixed(2)} indicates significant deviation from normal patterns.`,
          action: 'Review recent transactions and verify with warehouse staff.',
          risk: anomaly.severity === 'critical' ? 'high' : 'medium',
        };
      }

      // Update alert with AI summary
      await pool.query(
        `UPDATE alerts SET ai_summary = $1 WHERE alert_id = $2`,
        [`${investigation.verdict} Root cause: ${investigation.root_cause} Action: ${investigation.action}`, anomaly.alert_id]
      );

      investigations.push({
        alert_id: anomaly.alert_id,
        product: anomaly.product_name,
        sku: anomaly.sku,
        warehouse: anomaly.warehouse_name,
        severity: anomaly.severity,
        ...investigation,
      });
    }

    res.json({
      success: true,
      message: `Anomaly Agent investigated ${investigations.length} anomalies and generated action plans.`,
      investigations,
    });
  } catch (err) {
    console.error('Anomaly agent error:', err);
    res.status(500).json({ success: false, error: 'Anomaly agent failed: ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// AGENT 3: Demand Forecast Agent
// Predicts next 7/14/30 day demand for top-moving products
// using linear regression on transaction history.
// ─────────────────────────────────────────────────────────────
router.post('/forecast-agent', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { days = 14 } = req.body;
    const forecastDays = Math.min(Math.max(parseInt(days) || 14, 7), 30);

    // Get top 15 products by transaction volume
    const topProducts = await pool.query(`
      SELECT i.inventory_id, i.quantity, i.reorder_level,
             p.product_id, p.name as product_name, p.sku, p.price, p.unit,
             w.warehouse_id, w.name as warehouse_name,
             SUM(t.quantity) as total_moved
      FROM transactions t
      JOIN inventory i ON t.inventory_id = i.inventory_id
      JOIN products p ON i.product_id = p.product_id
      JOIN warehouses w ON i.warehouse_id = w.warehouse_id
      WHERE t.txn_type IN ('stock_out', 'transfer_out')
        AND t.created_at >= NOW() - INTERVAL '30 days'
        AND p.is_active = true
      GROUP BY i.inventory_id, i.quantity, i.reorder_level,
               p.product_id, p.name, p.sku, p.price, p.unit,
               w.warehouse_id, w.name
      ORDER BY total_moved DESC
      LIMIT 15
    `);

    const forecasts = [];

    for (const product of topProducts.rows) {
      // Get daily consumption for last 30 days
      const daily = await pool.query(`
        SELECT DATE(created_at) as day, SUM(quantity) as qty
        FROM transactions
        WHERE inventory_id = $1
          AND txn_type IN ('stock_out', 'transfer_out')
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY day
      `, [product.inventory_id]);

      if (daily.rows.length < 3) continue;

      const values = daily.rows.map(r => parseInt(r.qty));
      const n = values.length;

      // Simple linear regression
      const xMean = (n - 1) / 2;
      const yMean = values.reduce((a, b) => a + b, 0) / n;
      let num = 0, den = 0;
      values.forEach((y, x) => { num += (x - xMean) * (y - yMean); den += (x - xMean) ** 2; });
      const slope = den !== 0 ? num / den : 0;
      const intercept = yMean - slope * xMean;

      // Forecast next N days
      const forecastedDemand = Math.max(0, Math.round((intercept + slope * (n + forecastDays / 2)) * forecastDays));
      const avgDaily = yMean;
      const trend = slope > 0.5 ? 'increasing' : slope < -0.5 ? 'decreasing' : 'stable';
      const willStockout = product.quantity < forecastedDemand;
      const daysUntilStockout = avgDaily > 0 ? Math.round(product.quantity / avgDaily) : 999;

      forecasts.push({
        product: product.product_name,
        sku: product.sku,
        warehouse: product.warehouse_name,
        current_stock: product.quantity,
        reorder_level: product.reorder_level,
        avg_daily_demand: Math.round(avgDaily * 10) / 10,
        forecasted_demand: forecastedDemand,
        forecast_days: forecastDays,
        trend,
        will_stockout: willStockout,
        days_until_stockout: daysUntilStockout,
        recommended_order: willStockout ? Math.max(0, forecastedDemand - product.quantity + product.reorder_level) : 0,
        confidence: daily.rows.length >= 20 ? 'high' : daily.rows.length >= 10 ? 'medium' : 'low',
      });
    }

    // Sort: stockout risk first
    forecasts.sort((a, b) => (a.will_stockout === b.will_stockout ? a.days_until_stockout - b.days_until_stockout : a.will_stockout ? -1 : 1));

    const atRisk = forecasts.filter(f => f.will_stockout).length;

    res.json({
      success: true,
      message: `Forecast Agent analyzed ${forecasts.length} products for next ${forecastDays} days. ${atRisk} at stockout risk.`,
      forecast_days: forecastDays,
      at_risk_count: atRisk,
      forecasts,
    });
  } catch (err) {
    console.error('Forecast agent error:', err);
    res.status(500).json({ success: false, error: 'Forecast agent failed: ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// AGENT 4: Order Health Agent
// Reviews all pending/confirmed orders, flags issues like
// insufficient stock, stale orders, and high-value risks.
// ─────────────────────────────────────────────────────────────
router.post('/order-health-agent', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const orders = await pool.query(`
      SELECT o.order_id, o.status, o.customer_name, o.customer_ref,
             o.total_value, o.notes, o.created_at,
             w.name as warehouse_name, w.city,
             u.name as created_by_name,
             COUNT(oi.item_id) as item_count,
             EXTRACT(EPOCH FROM (NOW() - o.created_at))/3600 as age_hours
      FROM orders o
      JOIN warehouses w ON o.warehouse_id = w.warehouse_id
      LEFT JOIN users u ON o.created_by = u.user_id
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
      WHERE o.status IN ('draft', 'confirmed')
      GROUP BY o.order_id, w.name, w.city, u.name
      ORDER BY o.created_at ASC
    `);

    if (orders.rows.length === 0) {
      return res.json({ success: true, message: 'No pending orders to review. All clear!', issues: [], healthy: 0 });
    }

    const issues = [];
    let healthy = 0;

    for (const order of orders.rows) {
      const orderIssues = [];

      // Check stock availability for each item
      const items = await pool.query(`
        SELECT oi.quantity as ordered_qty, oi.unit_price,
               p.name as product_name, p.sku,
               i.quantity as available_qty
        FROM order_items oi
        JOIN products p ON oi.product_id = p.product_id
        LEFT JOIN inventory i ON i.product_id = p.product_id
          AND i.warehouse_id = (SELECT warehouse_id FROM orders WHERE order_id = $1)
        WHERE oi.order_id = $1
      `, [order.order_id]);

      for (const item of items.rows) {
        if (item.available_qty !== null && item.available_qty < item.ordered_qty) {
          orderIssues.push({
            type: 'insufficient_stock',
            message: `${item.product_name} (${item.sku}): ordered ${item.ordered_qty}, only ${item.available_qty} available`,
            severity: 'critical',
          });
        }
      }

      // Stale draft orders (>48 hours)
      if (order.status === 'draft' && order.age_hours > 48) {
        orderIssues.push({
          type: 'stale_draft',
          message: `Draft order is ${Math.round(order.age_hours)} hours old — needs confirmation or cancellation`,
          severity: 'warning',
        });
      }

      // High value unconfirmed
      if (order.status === 'draft' && parseFloat(order.total_value) > 50000) {
        orderIssues.push({
          type: 'high_value_draft',
          message: `High-value draft order (₹${parseFloat(order.total_value).toLocaleString()}) awaiting confirmation`,
          severity: 'warning',
        });
      }

      if (orderIssues.length > 0) {
        issues.push({
          order_id: order.order_id,
          customer: order.customer_name,
          ref: order.customer_ref,
          warehouse: order.warehouse_name,
          status: order.status,
          total_value: parseFloat(order.total_value),
          age_hours: Math.round(order.age_hours),
          issues: orderIssues,
        });
      } else {
        healthy++;
      }
    }

    // AI summary of overall order health
    let summary = '';
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `You are an order health monitoring agent for InvenIQ. Summarize the current order health in 2 sentences. Be specific with numbers.

Total pending orders: ${orders.rows.length}
Orders with issues: ${issues.length}
Healthy orders: ${healthy}
Issue types: ${[...new Set(issues.flatMap(i => i.issues.map(x => x.type)))].join(', ') || 'none'}
Critical issues: ${issues.flatMap(i => i.issues).filter(x => x.severity === 'critical').length}`;
      const result = await model.generateContent(prompt);
      summary = result.response.text().trim();
    } catch (e) {
      summary = `${issues.length} of ${orders.rows.length} pending orders have issues requiring attention. ${healthy} orders are healthy and on track.`;
    }

    res.json({
      success: true,
      message: summary,
      total_orders: orders.rows.length,
      issues_count: issues.length,
      healthy,
      issues,
    });
  } catch (err) {
    console.error('Order health agent error:', err);
    res.status(500).json({ success: false, error: 'Order health agent failed: ' + err.message });
  }
});

// GET /api/agents/status - Quick status of all agents
router.get('/status', async (req, res) => {
  try {
    const [unresolvedAlerts, criticalAlerts, pendingOrders, recentAnomalies] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM alerts WHERE is_resolved = false`),
      pool.query(`SELECT COUNT(*) FROM alerts WHERE is_resolved = false AND severity = 'critical'`),
      pool.query(`SELECT COUNT(*) FROM orders WHERE status IN ('draft','confirmed')`),
      pool.query(`SELECT COUNT(*) FROM alerts WHERE alert_type = 'anomaly' AND is_resolved = false AND created_at >= NOW() - INTERVAL '24 hours'`),
    ]);

    res.json({
      success: true,
      status: {
        unresolved_alerts: parseInt(unresolvedAlerts.rows[0].count),
        critical_alerts: parseInt(criticalAlerts.rows[0].count),
        pending_orders: parseInt(pendingOrders.rows[0].count),
        recent_anomalies: parseInt(recentAnomalies.rows[0].count),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/agents/users-summary - Users overview for Agents panel
// ─────────────────────────────────────────────────────────────
router.get('/users-summary', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE role = 'admin') as admins,
        COUNT(*) FILTER (WHERE role = 'manager') as managers,
        COUNT(*) FILTER (WHERE role = 'staff') as staff,
        COUNT(*) FILTER (WHERE role = 'viewer') as viewers,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) FILTER (WHERE is_active = false) as inactive,
        json_agg(json_build_object(
          'user_id', user_id, 'name', name, 'email', email,
          'role', role, 'is_active', is_active
        ) ORDER BY role, name) as users
      FROM users
    `);
    const row = result.rows[0];
    // Email recipients = active admins + managers
    const emailRecipients = (row.users || []).filter(u => u.is_active && ['admin','manager'].includes(u.role));
    res.json({
      success: true,
      summary: {
        total: parseInt(row.total),
        admins: parseInt(row.admins),
        managers: parseInt(row.managers),
        staff: parseInt(row.staff),
        viewers: parseInt(row.viewers),
        active: parseInt(row.active),
        inactive: parseInt(row.inactive),
      },
      users: row.users || [],
      emailRecipients,
    });
  } catch (err) {
    console.error('Users summary error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/agents/email-schedule - Get current email schedule config
// POST /api/agents/email-schedule - Update email schedule config
// Config stored in-memory (persisted to .env comment or just runtime)
// ─────────────────────────────────────────────────────────────
let emailScheduleConfig = {
  enabled: true,
  day: 1,        // 0=Sun, 1=Mon ... 6=Sat
  hour: 8,       // 0-23
  minute: 0,
  timezone: 'Asia/Kolkata',
};

router.get('/email-schedule', requireRole('admin', 'manager'), (req, res) => {
  res.json({ success: true, config: emailScheduleConfig });
});

router.post('/email-schedule', requireRole('admin'), async (req, res) => {
  const { enabled, day, hour, minute } = req.body;
  if (typeof enabled !== 'undefined') emailScheduleConfig.enabled = !!enabled;
  if (typeof day !== 'undefined') emailScheduleConfig.day = Math.min(6, Math.max(0, parseInt(day)));
  if (typeof hour !== 'undefined') emailScheduleConfig.hour = Math.min(23, Math.max(0, parseInt(hour)));
  if (typeof minute !== 'undefined') emailScheduleConfig.minute = Math.min(59, Math.max(0, parseInt(minute)));

  // Reschedule the cron job
  const { rescheduleWeeklyEmail } = require('../utils/scheduler');
  rescheduleWeeklyEmail(emailScheduleConfig);

  res.json({ success: true, config: emailScheduleConfig, message: 'Email schedule updated' });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const requireRole = require('../middleware/rbac');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const DB_SCHEMA_CONTEXT = `
You are querying a PostgreSQL database for an Inventory Management System called InvenIQ.
The database has these tables:
- categories (category_id UUID PK, name, description, created_at)
- users (user_id UUID PK, name, email, password_hash, role ENUM('admin','manager','staff','viewer'), is_active, created_at, updated_at)
- warehouses (warehouse_id UUID PK, name, city, address, pincode, capacity_sqft, is_active, created_by FK->users, created_at)
- suppliers (supplier_id UUID PK, name, contact_name, phone, email, address, is_active, created_at)
- products (product_id UUID PK, category_id FK->categories, sku, name, unit, price DECIMAL, description, is_active, created_by FK->users, created_at)
- inventory (inventory_id UUID PK, warehouse_id FK->warehouses, product_id FK->products, quantity INT, reorder_level INT, last_updated, UNIQUE(warehouse_id, product_id))
- transactions (txn_id UUID PK, inventory_id FK->inventory, txn_type ENUM('stock_in','stock_out','adjustment','transfer_out','transfer_in','return_in','return_out'), quantity INT, reference_id UUID, note, created_by FK->users, created_at)
- orders (order_id UUID PK, warehouse_id FK->warehouses, status ENUM('draft','confirmed','dispatched','completed','cancelled'), customer_name, customer_ref, total_value DECIMAL, notes, created_by FK->users, created_at, updated_at)
- order_items (item_id UUID PK, order_id FK->orders, product_id FK->products, quantity INT, unit_price DECIMAL, UNIQUE(order_id, product_id))
- returns (return_id UUID PK, order_id FK->orders, warehouse_id FK->warehouses, product_id FK->products, return_type ENUM('customer_return','supplier_return'), quantity INT, reason, created_by FK->users, created_at)
- transfers (transfer_id UUID PK, from_warehouse_id FK->warehouses, to_warehouse_id FK->warehouses, product_id FK->products, quantity INT, note, created_by FK->users, created_at)
- alerts (alert_id UUID PK, inventory_id FK->inventory, alert_type ENUM('restock','anomaly'), severity ENUM('critical','warning','info'), message, ai_summary, metadata JSONB, is_resolved, resolved_by FK->users, resolved_at, created_at)
`;

// POST /api/ai/run-restock - Trigger restock prediction
router.post('/run-restock', requireRole('admin', 'manager'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get all inventory items with their transaction history
    const inventoryItems = await client.query(`
      SELECT i.inventory_id, i.warehouse_id, i.product_id, i.quantity, i.reorder_level,
        p.name as product_name, p.sku, w.name as warehouse_name
      FROM inventory i
      JOIN products p ON i.product_id = p.product_id
      JOIN warehouses w ON i.warehouse_id = w.warehouse_id
      WHERE p.is_active = true AND w.is_active = true
    `);

    let alertsCreated = 0;

    for (const item of inventoryItems.rows) {
      // Get stock-out transactions from last 30 days
      const txns = await client.query(`
        SELECT DATE(created_at) as txn_date, SUM(quantity) as daily_qty
        FROM transactions
        WHERE inventory_id = $1 
          AND txn_type IN ('stock_out', 'transfer_out', 'return_out')
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY txn_date
      `, [item.inventory_id]);

      if (txns.rows.length === 0) continue;

      // Calculate average daily consumption
      const totalConsumed = txns.rows.reduce((sum, r) => sum + parseInt(r.daily_qty), 0);
      const avgDailyConsumption = totalConsumed / 30;

      if (avgDailyConsumption <= 0) continue;

      const daysToStockout = Math.round(item.quantity / avgDailyConsumption);
      const suggestedRestock = Math.ceil(14 * avgDailyConsumption);

      let severity;
      if (daysToStockout < 5) severity = 'critical';
      else if (daysToStockout <= 14) severity = 'warning';
      else continue; // OK - no alert needed

      const message = `${item.product_name} (${item.sku}) in ${item.warehouse_name}: ${daysToStockout} days to stockout. Current stock: ${item.quantity}. Avg daily consumption: ${avgDailyConsumption.toFixed(1)} units. Suggested restock: ${suggestedRestock} units.`;

      // Check if similar unresolved alert exists
      const existing = await client.query(
        `SELECT alert_id FROM alerts WHERE inventory_id = $1 AND alert_type = 'restock' AND is_resolved = false`,
        [item.inventory_id]
      );

      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE alerts SET severity = $1, message = $2, metadata = $3, created_at = NOW() WHERE alert_id = $4`,
          [severity, message, JSON.stringify({ days_to_stockout: daysToStockout, avg_daily_consumption: avgDailyConsumption, suggested_restock: suggestedRestock, current_quantity: item.quantity }), existing.rows[0].alert_id]
        );
      } else {
        await client.query(
          `INSERT INTO alerts (inventory_id, alert_type, severity, message, metadata)
           VALUES ($1, 'restock', $2, $3, $4)`,
          [item.inventory_id, severity, message, JSON.stringify({ days_to_stockout: daysToStockout, avg_daily_consumption: avgDailyConsumption, suggested_restock: suggestedRestock, current_quantity: item.quantity })]
        );
      }
      alertsCreated++;
    }

    await client.query('COMMIT');
    res.json({ success: true, message: `Restock analysis complete. ${alertsCreated} alerts generated/updated.`, alerts_count: alertsCreated });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Restock predictor error:', err);
    res.status(500).json({ success: false, error: 'Restock prediction failed' });
  } finally {
    client.release();
  }
});

// POST /api/ai/run-anomaly - Trigger anomaly detection
router.post('/run-anomaly', requireRole('admin', 'manager'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const inventoryItems = await client.query(`
      SELECT i.inventory_id, i.warehouse_id, i.product_id, i.quantity,
        p.name as product_name, p.sku, w.name as warehouse_name
      FROM inventory i
      JOIN products p ON i.product_id = p.product_id
      JOIN warehouses w ON i.warehouse_id = w.warehouse_id
      WHERE p.is_active = true AND w.is_active = true
    `);

    let anomaliesFound = 0;

    for (const item of inventoryItems.rows) {
      const txns = await client.query(`
        SELECT DATE(created_at) as txn_date, SUM(quantity) as daily_qty, 
          string_agg(DISTINCT txn_type::text, ', ') as types
        FROM transactions
        WHERE inventory_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY txn_date
      `, [item.inventory_id]);

      if (txns.rows.length < 5) continue; // Not enough data

      const quantities = txns.rows.map(r => parseInt(r.daily_qty));
      const mean = quantities.reduce((a, b) => a + b, 0) / quantities.length;
      const stdDev = Math.sqrt(quantities.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / quantities.length);

      if (stdDev === 0) continue;

      // Check last 3 days for anomalies
      const recentTxns = txns.rows.slice(-3);
      for (const txn of recentTxns) {
        const zScore = Math.abs((parseInt(txn.daily_qty) - mean) / stdDev);
        if (zScore > 2) {
          const deviation = ((parseInt(txn.daily_qty) - mean) / mean * 100).toFixed(1);
          const message = `Anomaly detected for ${item.product_name} (${item.sku}) in ${item.warehouse_name} on ${txn.txn_date}: ${txn.daily_qty} units moved (${deviation}% deviation from mean of ${mean.toFixed(1)}). Z-score: ${zScore.toFixed(2)}. Types: ${txn.types}`;

          const existing = await client.query(
            `SELECT alert_id FROM alerts WHERE inventory_id = $1 AND alert_type = 'anomaly' AND is_resolved = false AND DATE(created_at) = $2`,
            [item.inventory_id, txn.txn_date]
          );

          if (existing.rows.length === 0) {
            await client.query(
              `INSERT INTO alerts (inventory_id, alert_type, severity, message, metadata)
               VALUES ($1, 'anomaly', $2, $3, $4)`,
              [item.inventory_id, zScore > 3 ? 'critical' : 'warning', message,
                JSON.stringify({ z_score: zScore, daily_qty: parseInt(txn.daily_qty), mean, std_dev: stdDev, deviation_percent: deviation, txn_date: txn.txn_date })]
            );
            anomaliesFound++;
          }
        }
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: `Anomaly detection complete. ${anomaliesFound} anomalies found.`, anomalies_count: anomaliesFound });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Anomaly detector error:', err);
    res.status(500).json({ success: false, error: 'Anomaly detection failed' });
  } finally {
    client.release();
  }
});

// POST /api/ai/summarize/:id - Generate AI summary for an alert
router.post('/summarize/:id', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const alertResult = await pool.query(`
      SELECT a.*, p.name as product_name, p.sku, p.price, w.name as warehouse_name, w.city,
        i.quantity as current_quantity, i.reorder_level
      FROM alerts a
      JOIN inventory i ON a.inventory_id = i.inventory_id
      JOIN products p ON i.product_id = p.product_id
      JOIN warehouses w ON i.warehouse_id = w.warehouse_id
      WHERE a.alert_id = $1
    `, [req.params.id]);

    if (alertResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    const alert = alertResult.rows[0];

    // Check if already summarized
    if (alert.ai_summary) {
      return res.json({ success: true, data: { summary: alert.ai_summary, cached: true } });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are an inventory management AI assistant for InvenIQ. Generate a concise, actionable 2-3 sentence summary for this alert that a non-technical warehouse manager can understand.

Alert Type: ${alert.alert_type}
Severity: ${alert.severity}
Product: ${alert.product_name} (SKU: ${alert.sku})
Warehouse: ${alert.warehouse_name}, ${alert.city}
Current Stock: ${alert.current_quantity} units
Reorder Level: ${alert.reorder_level} units
Product Price: ₹${alert.price}
Alert Message: ${alert.message}
Metadata: ${JSON.stringify(alert.metadata)}

Provide a clear, human-readable summary explaining what happened, why it matters, and what action to take. Use specific numbers. Start directly with the analysis - no preamble.`;

    const result = await model.generateContent(prompt);
    const summary = result.response.text();

    await pool.query('UPDATE alerts SET ai_summary = $1 WHERE alert_id = $2', [summary, req.params.id]);

    res.json({ success: true, data: { summary, cached: false } });
  } catch (err) {
    console.error('AI summarize error:', err);
    // Fallback summary
    const fallback = `Alert requires attention. Please review the alert details and take appropriate action based on the severity level.`;
    res.json({ success: true, data: { summary: fallback, cached: false, fallback: true } });
  }
});

// POST /api/ai/nl-query - Natural language query
router.post('/nl-query', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ success: false, error: 'Question is required' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `${DB_SCHEMA_CONTEXT}

Convert the following natural language question into a PostgreSQL SELECT query. 
IMPORTANT RULES:
1. Return ONLY the SQL query, no explanation, no markdown formatting, no code blocks.
2. ONLY use SELECT statements. Never use INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER.
3. Use proper JOIN syntax and table aliases.
4. Use meaningful column aliases for readability.
5. Limit results to 50 rows max.
6. For monetary values, format with 2 decimal places.
7. Always include relevant identifying columns (name, sku, etc.)

Question: ${question}`;

    const result = await model.generateContent(prompt);
    let sqlQuery = result.response.text().trim();

    // Clean up the query - remove markdown code blocks if present
    sqlQuery = sqlQuery.replace(/```sql\n?/gi, '').replace(/```\n?/g, '').trim();

    // Safety check - only allow SELECT queries
    const forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'GRANT', 'REVOKE'];
    const upperQuery = sqlQuery.toUpperCase();
    for (const keyword of forbidden) {
      if (upperQuery.includes(keyword)) {
        return res.status(400).json({
          success: false,
          error: `Query rejected: contains forbidden keyword '${keyword}'. Only SELECT queries are allowed.`,
        });
      }
    }

    if (!upperQuery.trimStart().startsWith('SELECT')) {
      return res.status(400).json({ success: false, error: 'Only SELECT queries are allowed.' });
    }

    // Execute the query
    const queryResult = await pool.query(sqlQuery);

    res.json({
      success: true,
      data: {
        question,
        sql: sqlQuery,
        results: queryResult.rows,
        row_count: queryResult.rowCount,
        columns: queryResult.fields.map(f => f.name),
      },
    });
  } catch (err) {
    console.error('NL query error:', err);
    res.status(500).json({
      success: false,
      error: `Failed to process query: ${err.message}`,
    });
  }
});

module.exports = router;

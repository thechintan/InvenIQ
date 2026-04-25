const nodemailer = require('nodemailer');

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Send the Monday weekly summary email to all managers + admins.
 * @param {object} report - The compiled weekly report data
 */
async function sendWeeklySummaryEmail(report) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️  Email not configured — skipping send. Set SMTP_USER and SMTP_PASS in .env');
    return { skipped: true };
  }

  const transporter = createTransporter();

  const {
    weekStart, weekEnd,
    totalTransactions, stockIn, stockOut,
    newOrders, completedOrders, pendingOrders,
    criticalAlerts, totalAlerts, resolvedAlerts,
    topProducts, lowStockItems, anomalies,
    aiSummary, recipients,
  } = report;

  const html = buildEmailHtml(report);

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || `InvenIQ <${process.env.SMTP_USER}>`,
    to: recipients.join(', '),
    subject: `📦 InvenIQ Weekly Summary — Week of ${weekStart}`,
    html,
  });

  console.log(`✅ Weekly summary email sent to: ${recipients.join(', ')} (${info.messageId})`);
  return { sent: true, messageId: info.messageId, recipients };
}

function buildEmailHtml(report) {
  const {
    weekStart, weekEnd,
    totalTransactions, stockIn, stockOut,
    newOrders, completedOrders, pendingOrders,
    criticalAlerts, totalAlerts, resolvedAlerts,
    topProducts = [], lowStockItems = [], anomalies = [],
    aiSummary,
  } = report;

  const topProductsRows = topProducts.slice(0, 8).map(p => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155">${p.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b">${p.sku}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#10b981;font-weight:600">${p.total_in || 0}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#ef4444;font-weight:600">${p.total_out || 0}</td>
    </tr>`).join('');

  const lowStockRows = lowStockItems.slice(0, 8).map(i => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155">${i.product_name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b">${i.warehouse_name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#ef4444;font-weight:700">${i.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#94a3b8">${i.reorder_level}</td>
    </tr>`).join('');

  const anomalyRows = anomalies.slice(0, 5).map(a => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155">${a.product_name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b">${a.warehouse_name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#f59e0b;font-weight:600">${a.severity}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:640px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4f46e5 0%,#0891b2 100%);padding:32px 36px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        <div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:12px;display:flex;align-items:center;justify-content:center">
          <span style="font-size:20px">📦</span>
        </div>
        <span style="font-size:22px;font-weight:700;color:#ffffff">InvenIQ</span>
      </div>
      <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff">Weekly Inventory Summary</h1>
      <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.75)">${weekStart} — ${weekEnd}</p>
    </div>

    <!-- AI Summary -->
    ${aiSummary ? `
    <div style="background:#f0f4ff;border-left:4px solid #6366f1;margin:24px 24px 0;padding:16px 20px;border-radius:0 12px 12px 0">
      <div style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">✨ AI Summary</div>
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.6">${aiSummary}</p>
    </div>` : ''}

    <!-- Stats Grid -->
    <div style="padding:24px 24px 0">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
        ${statBox('📥 Stock In', stockIn, '#10b981')}
        ${statBox('📤 Stock Out', stockOut, '#ef4444')}
        ${statBox('🔄 Transactions', totalTransactions, '#6366f1')}
        ${statBox('🛒 New Orders', newOrders, '#f59e0b')}
        ${statBox('✅ Completed', completedOrders, '#10b981')}
        ${statBox('⏳ Pending', pendingOrders, '#94a3b8')}
        ${statBox('🚨 Critical Alerts', criticalAlerts, '#ef4444')}
        ${statBox('🔔 Total Alerts', totalAlerts, '#f59e0b')}
        ${statBox('✔️ Resolved', resolvedAlerts, '#10b981')}
      </div>
    </div>

    <!-- Top Products -->
    ${topProducts.length > 0 ? `
    <div style="padding:24px 24px 0">
      <h2 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#1e293b">📊 Top Moving Products</h2>
      <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:12px;overflow:hidden">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Product</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">SKU</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">In</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Out</th>
          </tr>
        </thead>
        <tbody>${topProductsRows}</tbody>
      </table>
    </div>` : ''}

    <!-- Low Stock -->
    ${lowStockItems.length > 0 ? `
    <div style="padding:24px 24px 0">
      <h2 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#1e293b">⚠️ Low Stock Items (${lowStockItems.length})</h2>
      <table style="width:100%;border-collapse:collapse;background:#fff7ed;border-radius:12px;overflow:hidden">
        <thead>
          <tr style="background:#ffedd5">
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#9a3412;text-transform:uppercase;letter-spacing:0.05em">Product</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#9a3412;text-transform:uppercase;letter-spacing:0.05em">Warehouse</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#9a3412;text-transform:uppercase;letter-spacing:0.05em">Stock</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#9a3412;text-transform:uppercase;letter-spacing:0.05em">Reorder At</th>
          </tr>
        </thead>
        <tbody>${lowStockRows}</tbody>
      </table>
    </div>` : ''}

    <!-- Anomalies -->
    ${anomalies.length > 0 ? `
    <div style="padding:24px 24px 0">
      <h2 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#1e293b">🔍 Anomalies Detected (${anomalies.length})</h2>
      <table style="width:100%;border-collapse:collapse;background:#fff1f2;border-radius:12px;overflow:hidden">
        <thead>
          <tr style="background:#ffe4e6">
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#9f1239;text-transform:uppercase;letter-spacing:0.05em">Product</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#9f1239;text-transform:uppercase;letter-spacing:0.05em">Warehouse</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#9f1239;text-transform:uppercase;letter-spacing:0.05em">Severity</th>
          </tr>
        </thead>
        <tbody>${anomalyRows}</tbody>
      </table>
    </div>` : ''}

    <!-- Footer -->
    <div style="padding:24px 24px 32px;margin-top:24px;border-top:1px solid #f1f5f9;text-align:center">
      <p style="margin:0;font-size:12px;color:#94a3b8">This is an automated weekly report from <strong>InvenIQ</strong>.</p>
      <p style="margin:4px 0 0;font-size:12px;color:#cbd5e1">Generated on ${new Date().toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}</p>
    </div>
  </div>
</body>
</html>`;
}

function statBox(label, value, color) {
  return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;text-align:center">
    <div style="font-size:20px;font-weight:800;color:${color}">${value ?? 0}</div>
    <div style="font-size:11px;color:#64748b;margin-top:2px">${label}</div>
  </div>`;
}

module.exports = { sendWeeklySummaryEmail };

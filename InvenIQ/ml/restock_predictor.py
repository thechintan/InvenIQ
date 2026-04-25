"""
InvenIQ — Restock Predictor (ML Model)
Analyzes last 30 days of stock-out transactions per product per warehouse.
Calculates average daily consumption velocity and predicts days to stockout.
Writes restock alerts to the alerts table.
"""

import os
import sys
import json
import psycopg2
from datetime import datetime, timedelta

DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'port': os.environ.get('DB_PORT', '5432'),
    'user': os.environ.get('DB_USER', 'postgres'),
    'password': os.environ.get('DB_PASSWORD', 'Chint@n1'),
    'database': os.environ.get('DB_NAME', 'inveniq'),
}

def run_restock_analysis():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    print("🔍 Running Restock Prediction Analysis...")
    print(f"   Analysis window: 30 days")
    print(f"   Date range: {(datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')} to {datetime.now().strftime('%Y-%m-%d')}")
    print()
    
    # Get all active inventory items
    cur.execute("""
        SELECT i.inventory_id, i.warehouse_id, i.product_id, i.quantity, i.reorder_level,
               p.name as product_name, p.sku, w.name as warehouse_name
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id
        JOIN warehouses w ON i.warehouse_id = w.warehouse_id
        WHERE p.is_active = TRUE AND w.is_active = TRUE
    """)
    inventory_items = cur.fetchall()
    
    alerts_created = 0
    alerts_updated = 0
    
    for item in inventory_items:
        inv_id, wh_id, prod_id, quantity, reorder_level, prod_name, sku, wh_name = item
        
        # Get stock-out transactions from last 30 days
        cur.execute("""
            SELECT DATE(created_at) as txn_date, SUM(quantity) as daily_qty
            FROM transactions
            WHERE inventory_id = %s
              AND txn_type IN ('stock_out', 'transfer_out', 'return_out')
              AND created_at >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY txn_date
        """, (str(inv_id),))
        txns = cur.fetchall()
        
        if len(txns) == 0:
            continue
        
        # Calculate average daily consumption
        total_consumed = sum(row[1] for row in txns)
        avg_daily_consumption = total_consumed / 30.0
        
        if avg_daily_consumption <= 0:
            continue
        
        # Predict days to stockout
        days_to_stockout = round(quantity / avg_daily_consumption)
        suggested_restock = int(14 * avg_daily_consumption)
        
        # Classify severity
        if days_to_stockout < 5:
            severity = 'critical'
        elif days_to_stockout <= 14:
            severity = 'warning'
        else:
            continue  # OK — no alert needed
        
        message = (
            f"{prod_name} ({sku}) in {wh_name}: {days_to_stockout} days to stockout. "
            f"Current stock: {quantity}. Avg daily consumption: {avg_daily_consumption:.1f} units. "
            f"Suggested restock: {suggested_restock} units."
        )
        
        metadata = json.dumps({
            'days_to_stockout': days_to_stockout,
            'avg_daily_consumption': round(avg_daily_consumption, 2),
            'suggested_restock': suggested_restock,
            'current_quantity': quantity,
            'reorder_level': reorder_level,
            'analysis_date': datetime.now().isoformat(),
        })
        
        # Check for existing unresolved alert
        cur.execute(
            "SELECT alert_id FROM alerts WHERE inventory_id = %s AND alert_type = 'restock' AND is_resolved = FALSE",
            (str(inv_id),)
        )
        existing = cur.fetchone()
        
        if existing:
            cur.execute(
                "UPDATE alerts SET severity = %s, message = %s, metadata = %s, created_at = NOW() WHERE alert_id = %s",
                (severity, message, metadata, str(existing[0]))
            )
            alerts_updated += 1
        else:
            cur.execute(
                "INSERT INTO alerts (inventory_id, alert_type, severity, message, metadata) VALUES (%s, 'restock', %s, %s, %s)",
                (str(inv_id), severity, message, metadata)
            )
            alerts_created += 1
        
        icon = "🔴" if severity == 'critical' else "🟡"
        print(f"  {icon} [{severity.upper()}] {prod_name} ({sku}) @ {wh_name}")
        print(f"     Stock: {quantity} | Daily consumption: {avg_daily_consumption:.1f} | Days left: {days_to_stockout}")
        print(f"     Suggested restock: {suggested_restock} units")
        print()
    
    conn.commit()
    cur.close()
    conn.close()
    
    print(f"✅ Restock analysis complete!")
    print(f"   New alerts: {alerts_created}")
    print(f"   Updated alerts: {alerts_updated}")

if __name__ == '__main__':
    run_restock_analysis()

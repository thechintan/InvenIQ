"""
InvenIQ — Anomaly Detector (ML Model)
Uses Z-score method to detect unusual stock movements.
For each product per warehouse, computes 30-day rolling mean and std deviation.
Flags movements deviating more than 2 standard deviations from the mean.
"""

import os
import sys
import json
import math
import psycopg2
from datetime import datetime, timedelta

DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'port': os.environ.get('DB_PORT', '5432'),
    'user': os.environ.get('DB_USER', 'postgres'),
    'password': os.environ.get('DB_PASSWORD', 'Chint@n1'),
    'database': os.environ.get('DB_NAME', 'inveniq'),
}

def calculate_z_score(value, mean, std_dev):
    if std_dev == 0:
        return 0
    return abs((value - mean) / std_dev)

def run_anomaly_detection():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    print("🔍 Running Anomaly Detection...")
    print(f"   Method: Z-Score (threshold: 2σ)")
    print(f"   Window: 30 days rolling")
    print()
    
    # Get all active inventory items
    cur.execute("""
        SELECT i.inventory_id, i.warehouse_id, i.product_id, i.quantity,
               p.name as product_name, p.sku, w.name as warehouse_name
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id
        JOIN warehouses w ON i.warehouse_id = w.warehouse_id
        WHERE p.is_active = TRUE AND w.is_active = TRUE
    """)
    inventory_items = cur.fetchall()
    
    anomalies_found = 0
    items_analyzed = 0
    
    for item in inventory_items:
        inv_id, wh_id, prod_id, quantity, prod_name, sku, wh_name = item
        
        # Get daily transaction volumes for last 30 days
        cur.execute("""
            SELECT DATE(created_at) as txn_date, 
                   SUM(quantity) as daily_qty,
                   string_agg(DISTINCT txn_type::text, ', ') as types
            FROM transactions
            WHERE inventory_id = %s 
              AND created_at >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY txn_date
        """, (str(inv_id),))
        txns = cur.fetchall()
        
        if len(txns) < 5:
            continue  # Not enough data points
        
        items_analyzed += 1
        quantities = [row[1] for row in txns]
        
        # Calculate statistics
        n = len(quantities)
        mean = sum(quantities) / n
        variance = sum((q - mean) ** 2 for q in quantities) / n
        std_dev = math.sqrt(variance)
        
        if std_dev == 0:
            continue
        
        # Check recent days for anomalies (last 3 days)
        recent_txns = txns[-3:]
        
        for txn in recent_txns:
            txn_date, daily_qty, txn_types = txn
            z_score = calculate_z_score(daily_qty, mean, std_dev)
            
            if z_score > 2:
                deviation_percent = round(((daily_qty - mean) / mean) * 100, 1)
                severity = 'critical' if z_score > 3 else 'warning'
                
                # Determine anomaly type
                if 'stock_out' in txn_types:
                    anomaly_desc = "unusual stock-out spike"
                elif 'stock_in' in txn_types:
                    anomaly_desc = "sudden stock-in spike"
                elif 'return' in txn_types:
                    anomaly_desc = "abnormal return volume"
                else:
                    anomaly_desc = "unusual movement"
                
                message = (
                    f"Anomaly: {anomaly_desc} for {prod_name} ({sku}) in {wh_name} "
                    f"on {txn_date}: {daily_qty} units moved "
                    f"({deviation_percent}% deviation from mean of {mean:.1f}). "
                    f"Z-score: {z_score:.2f}. Movement types: {txn_types}"
                )
                
                metadata = json.dumps({
                    'z_score': round(z_score, 3),
                    'daily_qty': daily_qty,
                    'mean': round(mean, 2),
                    'std_dev': round(std_dev, 2),
                    'deviation_percent': deviation_percent,
                    'txn_date': str(txn_date),
                    'txn_types': txn_types,
                    'anomaly_type': anomaly_desc,
                })
                
                # Check if similar alert already exists
                cur.execute(
                    """SELECT alert_id FROM alerts 
                       WHERE inventory_id = %s AND alert_type = 'anomaly' 
                       AND is_resolved = FALSE AND DATE(created_at) = %s""",
                    (str(inv_id), str(txn_date))
                )
                existing = cur.fetchone()
                
                if not existing:
                    cur.execute(
                        """INSERT INTO alerts (inventory_id, alert_type, severity, message, metadata) 
                           VALUES (%s, 'anomaly', %s, %s, %s)""",
                        (str(inv_id), severity, message, metadata)
                    )
                    anomalies_found += 1
                    
                    icon = "🔴" if severity == 'critical' else "🟡"
                    print(f"  {icon} [{severity.upper()}] {prod_name} ({sku}) @ {wh_name}")
                    print(f"     Date: {txn_date} | Units: {daily_qty} | Mean: {mean:.1f} | Std: {std_dev:.1f}")
                    print(f"     Z-score: {z_score:.2f} | Deviation: {deviation_percent}%")
                    print(f"     Type: {anomaly_desc}")
                    print()
    
    conn.commit()
    cur.close()
    conn.close()
    
    print(f"✅ Anomaly detection complete!")
    print(f"   Items analyzed: {items_analyzed}")
    print(f"   Anomalies found: {anomalies_found}")

if __name__ == '__main__':
    run_anomaly_detection()

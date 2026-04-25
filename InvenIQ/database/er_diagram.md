# InvenIQ — ER Diagram

Paste the code block below at **[mermaid.live](https://mermaid.live)** → click "Copy" → Export as PNG or SVG.

```mermaid
erDiagram
    categories {
        UUID category_id PK
        VARCHAR name
        TEXT description
        TIMESTAMP created_at
    }

    users {
        UUID user_id PK
        VARCHAR name
        VARCHAR email
        TEXT password_hash
        VARCHAR role
        BOOLEAN is_active
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    warehouses {
        UUID warehouse_id PK
        VARCHAR name
        VARCHAR city
        TEXT address
        VARCHAR pincode
        INTEGER capacity_sqft
        BOOLEAN is_active
        UUID created_by FK
        TIMESTAMP created_at
    }

    suppliers {
        UUID supplier_id PK
        VARCHAR name
        VARCHAR contact_name
        VARCHAR phone
        VARCHAR email
        TEXT address
        BOOLEAN is_active
        TIMESTAMP created_at
    }

    products {
        UUID product_id PK
        UUID category_id FK
        VARCHAR sku
        VARCHAR name
        VARCHAR unit
        DECIMAL price
        BOOLEAN is_active
        DATE expiry_date
        UUID created_by FK
        TIMESTAMP created_at
    }

    inventory {
        UUID inventory_id PK
        UUID warehouse_id FK
        UUID product_id FK
        INTEGER quantity
        INTEGER reorder_level
        TIMESTAMP last_updated
    }

    transactions {
        UUID txn_id PK
        UUID inventory_id FK
        VARCHAR txn_type
        INTEGER quantity
        UUID reference_id
        TEXT note
        UUID created_by FK
        TIMESTAMP created_at
    }

    orders {
        UUID order_id PK
        UUID warehouse_id FK
        VARCHAR status
        VARCHAR customer_name
        VARCHAR customer_ref
        DECIMAL total_value
        TEXT notes
        UUID created_by FK
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    order_items {
        UUID item_id PK
        UUID order_id FK
        UUID product_id FK
        INTEGER quantity
        DECIMAL unit_price
    }

    returns {
        UUID return_id PK
        UUID order_id FK
        UUID warehouse_id FK
        UUID product_id FK
        VARCHAR return_type
        INTEGER quantity
        TEXT reason
        UUID created_by FK
        TIMESTAMP created_at
    }

    transfers {
        UUID transfer_id PK
        UUID from_warehouse_id FK
        UUID to_warehouse_id FK
        UUID product_id FK
        INTEGER quantity
        TEXT note
        UUID created_by FK
        TIMESTAMP created_at
    }

    alerts {
        UUID alert_id PK
        UUID inventory_id FK
        VARCHAR alert_type
        VARCHAR severity
        TEXT message
        TEXT ai_summary
        JSONB metadata
        BOOLEAN is_resolved
        UUID resolved_by FK
        TIMESTAMP resolved_at
        TIMESTAMP created_at
    }

    categories      ||--o{ products      : "categorises"
    users           ||--o{ products      : "creates"
    users           ||--o{ warehouses    : "creates"
    users           ||--o{ transactions  : "performs"
    users           ||--o{ orders        : "places"
    users           ||--o{ returns       : "processes"
    users           ||--o{ transfers     : "initiates"
    users           ||--o{ alerts        : "resolves"
    warehouses      ||--o{ inventory     : "holds"
    products        ||--o{ inventory     : "stocked_in"
    inventory       ||--o{ transactions  : "has"
    inventory       ||--o{ alerts        : "generates"
    warehouses      ||--o{ orders        : "fulfils"
    orders          ||--o{ order_items   : "contains"
    products        ||--o{ order_items   : "listed_in"
    orders          ||--o{ returns       : "originates"
    warehouses      ||--o{ returns       : "receives"
    products        ||--o{ returns       : "returned"
    warehouses      ||--o{ transfers     : "source"
    products        ||--o{ transfers     : "moved"
```

---

## How to get the image

**Option 1 — Online (easiest)**
1. Go to [mermaid.live](https://mermaid.live)
2. Paste the code block above
3. Click **Export → PNG** or **SVG**

**Option 2 — VS Code**
Install the **Markdown Preview Mermaid Support** extension, then open this file and hit `Ctrl+Shift+V`

**Option 3 — CLI**
```bash
npm install -g @mermaid-js/mermaid-cli
mmdc -i er_diagram.md -o er_diagram.png -w 2400
```

---

## Table Summary

| Table | Purpose |
|---|---|
| `categories` | Product categories |
| `users` | Auth + RBAC (admin/manager/staff/viewer) |
| `warehouses` | Physical storage locations |
| `suppliers` | Vendor/supplier directory |
| `products` | Product catalog with SKU + pricing |
| `inventory` | Stock levels per product per warehouse |
| `transactions` | Every stock movement (in/out/transfer/return) |
| `orders` | Customer/restock orders |
| `order_items` | Line items inside each order |
| `returns` | Customer or supplier returns |
| `transfers` | Stock moved between warehouses |
| `alerts` | AI-generated restock + anomaly alerts |

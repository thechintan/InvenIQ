-- ═══════════════════════════════════════════════════════════
-- InvenIQ — Full PostgreSQL Schema
-- Run this file once on a fresh database to create all tables
-- ═══════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. categories ──────────────────────────────────────────
CREATE TABLE categories (
  category_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(80) NOT NULL UNIQUE,
  description   TEXT,
  created_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ── 2. users ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'manager', 'staff', 'viewer');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE users (
  user_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  role          user_role   NOT NULL DEFAULT 'staff',
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ── 3. warehouses ───────────────────────────────────────────
CREATE TABLE warehouses (
  warehouse_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  city          VARCHAR(80)  NOT NULL,
  address       TEXT,
  pincode       VARCHAR(10),
  capacity_sqft INTEGER,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by    UUID        REFERENCES users(user_id),
  created_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ── 4. suppliers ────────────────────────────────────────────
CREATE TABLE suppliers (
  supplier_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(150) NOT NULL,
  contact_name  VARCHAR(100),
  phone         VARCHAR(20),
  email         VARCHAR(150),
  address       TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ── 5. products ─────────────────────────────────────────────
CREATE TABLE products (
  product_id    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID          REFERENCES categories(category_id),
  sku           VARCHAR(50)   NOT NULL UNIQUE,
  name          VARCHAR(200)  NOT NULL,
  unit          VARCHAR(30)   NOT NULL DEFAULT 'pcs',
  price         DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  description   TEXT,
  expiry_date   DATE,
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  created_by    UUID          REFERENCES users(user_id),
  created_at    TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- ── 6. inventory ────────────────────────────────────────────
CREATE TABLE inventory (
  inventory_id    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id    UUID    NOT NULL REFERENCES warehouses(warehouse_id),
  product_id      UUID    NOT NULL REFERENCES products(product_id),
  quantity        INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reorder_level   INTEGER NOT NULL DEFAULT 10,
  last_updated    TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (warehouse_id, product_id)
);

-- ── 7. transactions ─────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE txn_type AS ENUM ('stock_in','stock_out','adjustment','transfer_out','transfer_in','return_in','return_out');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE transactions (
  txn_id        UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id  UUID      NOT NULL REFERENCES inventory(inventory_id),
  txn_type      txn_type  NOT NULL,
  quantity      INTEGER   NOT NULL CHECK (quantity > 0),
  reference_id  UUID,
  note          TEXT,
  created_by    UUID      REFERENCES users(user_id),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 8. orders ───────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('draft','confirmed','dispatched','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE orders (
  order_id      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id  UUID          NOT NULL REFERENCES warehouses(warehouse_id),
  status        order_status  NOT NULL DEFAULT 'draft',
  customer_name VARCHAR(150),
  customer_ref  VARCHAR(100),
  total_value   DECIMAL(12,2) DEFAULT 0,
  notes         TEXT,
  created_by    UUID          REFERENCES users(user_id),
  created_at    TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- ── 9. order_items ──────────────────────────────────────────
CREATE TABLE order_items (
  item_id       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID          NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  product_id    UUID          NOT NULL REFERENCES products(product_id),
  quantity      INTEGER       NOT NULL CHECK (quantity > 0),
  unit_price    DECIMAL(10,2) NOT NULL,
  UNIQUE (order_id, product_id)
);

-- ── 10. returns ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE return_type AS ENUM ('customer_return','supplier_return');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE returns (
  return_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID        REFERENCES orders(order_id),
  warehouse_id  UUID        NOT NULL REFERENCES warehouses(warehouse_id),
  product_id    UUID        NOT NULL REFERENCES products(product_id),
  return_type   return_type NOT NULL,
  quantity      INTEGER     NOT NULL CHECK (quantity > 0),
  reason        TEXT,
  created_by    UUID        REFERENCES users(user_id),
  created_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ── 11. transfers ───────────────────────────────────────────
CREATE TABLE transfers (
  transfer_id       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  from_warehouse_id UUID    NOT NULL REFERENCES warehouses(warehouse_id),
  to_warehouse_id   UUID    NOT NULL REFERENCES warehouses(warehouse_id),
  product_id        UUID    NOT NULL REFERENCES products(product_id),
  quantity          INTEGER NOT NULL CHECK (quantity > 0),
  note              TEXT,
  created_by        UUID    REFERENCES users(user_id),
  created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 12. alerts ──────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE alert_type AS ENUM ('restock','anomaly');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE alert_severity AS ENUM ('critical','warning','info');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE alerts (
  alert_id      UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id  UUID           NOT NULL REFERENCES inventory(inventory_id),
  alert_type    alert_type     NOT NULL,
  severity      alert_severity NOT NULL,
  message       TEXT           NOT NULL,
  ai_summary    TEXT,
  metadata      JSONB,
  is_resolved   BOOLEAN        NOT NULL DEFAULT FALSE,
  resolved_by   UUID           REFERENCES users(user_id),
  resolved_at   TIMESTAMP,
  created_at    TIMESTAMP      NOT NULL DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX idx_inventory_warehouse   ON inventory(warehouse_id);
CREATE INDEX idx_inventory_product     ON inventory(product_id);
CREATE INDEX idx_transactions_inv      ON transactions(inventory_id);
CREATE INDEX idx_transactions_type     ON transactions(txn_type);
CREATE INDEX idx_transactions_date     ON transactions(created_at);
CREATE INDEX idx_orders_warehouse      ON orders(warehouse_id);
CREATE INDEX idx_orders_status         ON orders(status);
CREATE INDEX idx_alerts_inventory      ON alerts(inventory_id);
CREATE INDEX idx_alerts_resolved       ON alerts(is_resolved);
CREATE INDEX idx_products_category     ON products(category_id);

-- ── Trigger: update inventory.last_updated on transaction ───
CREATE OR REPLACE FUNCTION update_inventory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory SET last_updated = NOW()
  WHERE inventory_id = NEW.inventory_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_txn_update_inventory
AFTER INSERT ON transactions
FOR EACH ROW EXECUTE FUNCTION update_inventory_timestamp();

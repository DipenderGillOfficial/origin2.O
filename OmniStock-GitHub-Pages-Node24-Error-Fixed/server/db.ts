import { DatabaseSync } from 'node:sqlite';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'warehouse.sqlite');
export const db = new DatabaseSync(DB_PATH);

// Enable WAL mode for better concurrency and performance
db.exec(`PRAGMA journal_mode = WAL;`);
db.exec(`PRAGMA foreign_keys = ON;`);

// Create Schema
db.exec(`
CREATE TABLE IF NOT EXISTS warehouse (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  total_rows INTEGER NOT NULL,
  bins_per_row INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  warehouse_code TEXT NOT NULL,
  row_number INTEGER NOT NULL,
  row_code TEXT NOT NULL,
  bin_number INTEGER NOT NULL,
  bin_code TEXT NOT NULL,
  location_code TEXT UNIQUE NOT NULL,
  zone_name TEXT NOT NULL,
  zone_type TEXT NOT NULL,
  max_capacity INTEGER NOT NULL DEFAULT 500,
  current_qty INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit_of_measure TEXT NOT NULL DEFAULT 'EACH',
  unit_price REAL NOT NULL,
  min_safety_stock INTEGER NOT NULL DEFAULT 15,
  current_total_stock INTEGER NOT NULL DEFAULT 0,
  row_number INTEGER NOT NULL,
  bin_code TEXT NOT NULL,
  location_code TEXT NOT NULL,
  barcode TEXT NOT NULL,
  FOREIGN KEY(location_code) REFERENCES locations(location_code)
);

CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  sku TEXT NOT NULL,
  location_code TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  last_updated TEXT NOT NULL,
  FOREIGN KEY(product_id) REFERENCES products(id),
  FOREIGN KEY(location_code) REFERENCES locations(location_code),
  UNIQUE(product_id, location_code)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  destination_channel TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'STANDARD',
  status TEXT NOT NULL DEFAULT 'PENDING',
  total_items INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  dispatched_at TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  requested_qty INTEGER NOT NULL,
  picked_qty INTEGER NOT NULL DEFAULT 0,
  resolved_row INTEGER NOT NULL,
  resolved_bin TEXT NOT NULL,
  resolved_location_code TEXT NOT NULL,
  pick_status TEXT NOT NULL DEFAULT 'PENDING',
  FOREIGN KEY(order_id) REFERENCES orders(id),
  FOREIGN KEY(product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  movement_type TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  from_location TEXT NOT NULL,
  to_location TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  reference_id TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  notes TEXT
);
`);

console.log('Database tables initialized successfully at', DB_PATH);

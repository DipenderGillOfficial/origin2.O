import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db';
import { seedDatabaseIfEmpty } from './server/seed';

async function startServer() {
  // Ensure database has schema and initial 600 SKUs, orders, locations
  seedDatabaseIfEmpty();

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // -------------------------------------------------------------
  // API ROUTES (Always before Vite middleware)
  // -------------------------------------------------------------

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 1. Warehouse Overview
  app.get('/api/warehouse', (req, res) => {
    try {
      const warehouse = db.prepare('SELECT * FROM warehouse WHERE id = 1').get() as any;
      const totalLocations = db.prepare('SELECT COUNT(*) as count FROM locations').get() as { count: number };
      const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
      const totalUnits = db.prepare('SELECT SUM(current_total_stock) as sum, SUM(current_total_stock * unit_price) as valuation FROM products').get() as { sum: number; valuation: number };
      const lowStockCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE current_total_stock <= min_safety_stock').get() as { count: number };

      res.json({
        warehouse,
        stats: {
          totalRows: 4,
          totalBins: totalLocations.count,
          totalSkus: totalProducts.count,
          totalUnits: totalUnits.sum || 0,
          inventoryValuation: (totalUnits.valuation || 0).toFixed(2),
          lowStockAlerts: lowStockCount.count
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Locations Hierarchy & Map
  // Returns all 64 locations (WH1-R01-B01 .. WH1-R04-B16) with live capacity and items count
  app.get('/api/locations', (req, res) => {
    try {
      const rowParam = req.query.row ? Number(req.query.row) : null;
      let query = `
        SELECT l.*, 
               COUNT(p.id) as sku_count,
               SUM(p.current_total_stock) as calculated_units
        FROM locations l
        LEFT JOIN products p ON p.location_code = l.location_code
      `;
      const params: any[] = [];
      if (rowParam) {
        query += ` WHERE l.row_number = ?`;
        params.push(rowParam);
      }
      query += ` GROUP BY l.id ORDER BY l.row_number ASC, l.bin_number ASC`;

      const rows = db.prepare(query).all(...params);
      res.json({ locations: rows });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Single Location Detail (with products list inside this bin)
  app.get('/api/locations/:location_code', (req, res) => {
    try {
      const { location_code } = req.params;
      const location = db.prepare('SELECT * FROM locations WHERE location_code = ?').get(location_code);
      if (!location) {
        res.status(404).json({ error: 'Location not found' });
        return;
      }
      const products = db.prepare(`
        SELECT p.*, i.quantity as bin_quantity, i.last_updated
        FROM products p
        JOIN inventory i ON i.product_id = p.id AND i.location_code = ?
        ORDER BY p.name ASC
      `).all(location_code);

      res.json({ location, products });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Products List (Filter by Row, Category, Low Stock, or Search Bar: type a product name, instantly see its location(s) and quantity)
  app.get('/api/products', (req, res) => {
    try {
      const rowParam = req.query.row ? Number(req.query.row) : null;
      const categoryParam = req.query.category as string;
      const lowStockOnly = req.query.low_stock === 'true';
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const offset = req.query.offset ? Number(req.query.offset) : 0;
      const skuFilter = req.query.sku as string;
      const searchParam = (req.query.q || req.query.search) as string;

      let whereClauses: string[] = [];
      let params: any[] = [];

      if (rowParam) {
        whereClauses.push('p.row_number = ?');
        params.push(rowParam);
      }
      if (categoryParam && categoryParam !== 'ALL') {
        whereClauses.push('p.category = ?');
        params.push(categoryParam);
      }
      if (lowStockOnly) {
        whereClauses.push('p.current_total_stock <= p.min_safety_stock');
      }
      if (skuFilter) {
        whereClauses.push('p.sku = ?');
        params.push(skuFilter);
      }
      if (searchParam && searchParam.trim().length > 0) {
        whereClauses.push('(p.name LIKE ? OR p.sku LIKE ?)');
        const term = `%${searchParam.trim()}%`;
        params.push(term, term);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const countResult = db.prepare(`SELECT COUNT(*) as total FROM products p ${whereSql}`).get(...params) as { total: number };
      const rawProducts = db.prepare(`
        SELECT p.*,
               (SELECT json_group_array(json_object('location_code', i.location_code, 'quantity', i.quantity))
                FROM inventory i WHERE i.product_id = p.id AND i.quantity > 0) as bin_locations_json
        FROM products p 
        ${whereSql}
        ORDER BY p.id ASC
        LIMIT ? OFFSET ?
      `).all(...params, limit, offset) as any[];

      const products = rawProducts.map((p) => {
        let bin_locations: Array<{ location_code: string; quantity: number }> = [];
        try {
          if (p.bin_locations_json) {
            bin_locations = JSON.parse(p.bin_locations_json);
          }
        } catch (e) {
          bin_locations = [];
        }
        if (bin_locations.length === 0 && p.location_code) {
          bin_locations = [{ location_code: p.location_code, quantity: p.current_total_stock }];
        }
        const { bin_locations_json, ...rest } = p;
        return {
          ...rest,
          bin_locations
        };
      });

      res.json({
        total: countResult.total,
        page: Math.floor(offset / limit) + 1,
        limit,
        products
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Orders List (Intake, Picking, Picked, Dispatched)
  app.get('/api/orders', (req, res) => {
    try {
      const orders = db.prepare(`
        SELECT * FROM orders 
        ORDER BY 
          CASE priority 
            WHEN 'URGENT' THEN 1 
            WHEN 'HIGH' THEN 2 
            ELSE 3 
          END ASC, 
          created_at DESC
      `).all() as any[];

      // Fetch items for each order
      const getItems = db.prepare(`
        SELECT oi.*, p.unit_price, p.current_total_stock as current_bin_stock
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ?
        ORDER BY oi.resolved_row ASC, oi.resolved_bin ASC
      `);

      const enrichedOrders = orders.map((o) => {
        const items = getItems.all(o.id);
        return {
          ...o,
          items
        };
      });

      res.json({ orders: enrichedOrders });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Single Order Detail with Instant Resolved Picking Route
  app.get('/api/orders/:id', (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      // Ordered by physical warehouse sequence (Row 1 -> Row 4, Bin 1 -> 16) for optimal travel path!
      const items = db.prepare(`
        SELECT oi.*, p.unit_price, p.category, p.current_total_stock as live_stock
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ?
        ORDER BY oi.resolved_row ASC, oi.resolved_bin ASC
      `).all(orderId);

      const isAllPicked = items.every((item: any) => item.pick_status === 'PICKED');

      res.json({
        order: {
          ...order,
          isAllPicked,
          items
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Order Intake Flow: Ingest new order and INSTANTLY return exact Row & Bin
  app.post('/api/orders/intake', (req, res) => {
    try {
      const { customer_name, destination_channel, priority, selected_sku_ids } = req.body;

      // If no items provided, pick 3 random items across different rows
      let chosenProductIds: number[] = [];
      if (Array.isArray(selected_sku_ids) && selected_sku_ids.length > 0) {
        chosenProductIds = selected_sku_ids;
      } else {
        const randomProducts = db.prepare(`
          SELECT id FROM products 
          WHERE current_total_stock > 5 
          ORDER BY RANDOM() 
          LIMIT 3
        `).all() as Array<{ id: number }>;
        chosenProductIds = randomProducts.map((p) => p.id);
      }

      const orderNumber = `ORD-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const customer = customer_name || 'Global Logistics Client #' + Math.floor(Math.random() * 800 + 100);
      const destination = destination_channel || 'Dock Express Freight Bay 3';
      const prio = priority || 'STANDARD';
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      // Create Order
      const insertOrder = db.prepare(`
        INSERT INTO orders (order_number, customer_name, destination_channel, priority, status, total_items, created_at)
        VALUES (?, ?, ?, ?, 'PENDING', ?, ?)
      `);
      const orderRes = insertOrder.run(orderNumber, customer, destination, prio, chosenProductIds.length, now);
      const orderId = Number(orderRes.lastInsertRowid);

      // Resolve exact Row and Bin for each product and insert order_items
      const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');
      const insertOrderItem = db.prepare(`
        INSERT INTO order_items (order_id, product_id, sku, product_name, requested_qty, picked_qty, resolved_row, resolved_bin, resolved_location_code, pick_status)
        VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, 'PENDING')
      `);

      const resolvedItems: any[] = [];
      for (const pid of chosenProductIds) {
        const prod = getProduct.get(pid) as any;
        if (prod) {
          const qty = Math.floor(Math.random() * 3) + 1;
          insertOrderItem.run(
            orderId,
            prod.id,
            prod.sku,
            prod.name,
            qty,
            prod.row_number,
            prod.bin_code,
            prod.location_code
          );
          resolvedItems.push({
            product_id: prod.id,
            sku: prod.sku,
            name: prod.name,
            requested_qty: qty,
            resolved_row: prod.row_number,
            resolved_bin: prod.bin_code,
            resolved_location_code: prod.location_code,
            live_bin_stock: prod.current_total_stock
          });
        }
      }

      // Log intake movement
      const insertMovement = db.prepare(`
        INSERT INTO stock_movements (movement_type, timestamp, product_id, sku, product_name, from_location, to_location, quantity, reference_id, performed_by, notes)
        VALUES ('ORDER_INTAKE', ?, ?, ?, ?, 'SYSTEM', 'PICKING_QUEUE', ?, ?, 'WMS Dispatch Agent', ?)
      `);
      if (resolvedItems[0]) {
        insertMovement.run(
          now,
          resolvedItems[0].product_id,
          resolvedItems[0].sku,
          resolvedItems[0].name,
          resolvedItems.reduce((acc, i) => acc + i.requested_qty, 0),
          orderNumber,
          `Order intake verified. Auto-routed to Row ${resolvedItems[0].resolved_row} Bin ${resolvedItems[0].resolved_bin}.`
        );
      }

      res.status(201).json({
        message: 'Order received and locations instantly resolved!',
        order: {
          id: orderId,
          order_number: orderNumber,
          customer_name: customer,
          priority: prio,
          destination_channel: destination,
          created_at: now,
          status: 'PENDING',
          items: resolvedItems
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Pick Single Item (Staff picking execution)
  app.post('/api/orders/:id/pick-item', (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const { order_item_id, operator = 'Staff Picker' } = req.body;

      const item = db.prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?').get(order_item_id, orderId) as any;
      if (!item) {
        res.status(404).json({ error: 'Order item not found' });
        return;
      }

      if (item.pick_status === 'PICKED') {
        res.json({ message: 'Item already picked', item });
        return;
      }

      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      // Transaction: Decrement stock from products and inventory, update order_item, log OUTWARD_PICK
      db.exec('BEGIN TRANSACTION;');
      try {
        // Decrement product total stock
        db.prepare(`
          UPDATE products 
          SET current_total_stock = MAX(0, current_total_stock - ?)
          WHERE id = ?
        `).run(item.requested_qty, item.product_id);

        // Decrement inventory at exact location
        db.prepare(`
          UPDATE inventory 
          SET quantity = MAX(0, quantity - ?), last_updated = ?
          WHERE product_id = ? AND location_code = ?
        `).run(item.requested_qty, now, item.product_id, item.resolved_location_code);

        // Decrement location current_qty
        db.prepare(`
          UPDATE locations 
          SET current_qty = MAX(0, current_qty - ?)
          WHERE location_code = ?
        `).run(item.requested_qty, item.resolved_location_code);

        // Update order_item status
        db.prepare(`
          UPDATE order_items 
          SET picked_qty = requested_qty, pick_status = 'PICKED'
          WHERE id = ?
        `).run(order_item_id);

        // Log OUTWARD_PICK in stock_movements
        const order = db.prepare('SELECT order_number FROM orders WHERE id = ?').get(orderId) as any;
        db.prepare(`
          INSERT INTO stock_movements (movement_type, timestamp, product_id, sku, product_name, from_location, to_location, quantity, reference_id, performed_by, notes)
          VALUES ('OUTWARD_PICK', ?, ?, ?, ?, ?, 'PACKING_CONVEYOR', ?, ?, ?, ?)
        `).run(
          now,
          item.product_id,
          item.sku,
          item.product_name,
          item.resolved_location_code,
          item.requested_qty,
          order?.order_number || `ORD-${orderId}`,
          operator,
          `Picked from Row ${item.resolved_row}, Bin ${item.resolved_bin}. Location verified.`
        );

        // Check if all items in order are picked
        const unpickedCount = db.prepare(`
          SELECT COUNT(*) as count FROM order_items WHERE order_id = ? AND pick_status != 'PICKED'
        `).get(orderId) as { count: number };

        if (unpickedCount.count === 0) {
          db.prepare(`UPDATE orders SET status = 'PICKED' WHERE id = ?`).run(orderId);
        } else {
          db.prepare(`UPDATE orders SET status = 'PICKING' WHERE id = ?`).run(orderId);
        }

        db.exec('COMMIT;');

        res.json({
          message: `Successfully picked ${item.requested_qty}x ${item.sku} from ${item.resolved_location_code}`,
          order_id: orderId,
          order_item_id,
          isOrderComplete: unpickedCount.count === 0
        });
      } catch (e) {
        db.exec('ROLLBACK;');
        throw e;
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 9. Complete Entire Order Pick Run in One Step
  app.post('/api/orders/:id/complete-pick', (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const { operator = 'Staff Picker' } = req.body;

      const items = db.prepare(`
        SELECT * FROM order_items WHERE order_id = ? AND pick_status != 'PICKED'
      `).all(orderId) as any[];

      const order = db.prepare('SELECT order_number FROM orders WHERE id = ?').get(orderId) as any;
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      db.exec('BEGIN TRANSACTION;');
      try {
        for (const item of items) {
          // Decrement stock
          db.prepare(`
            UPDATE products 
            SET current_total_stock = MAX(0, current_total_stock - ?)
            WHERE id = ?
          `).run(item.requested_qty, item.product_id);

          db.prepare(`
            UPDATE inventory 
            SET quantity = MAX(0, quantity - ?), last_updated = ?
            WHERE product_id = ? AND location_code = ?
          `).run(item.requested_qty, now, item.product_id, item.resolved_location_code);

          db.prepare(`
            UPDATE locations 
            SET current_qty = MAX(0, current_qty - ?)
            WHERE location_code = ?
          `).run(item.requested_qty, item.resolved_location_code);

          db.prepare(`
            UPDATE order_items 
            SET picked_qty = requested_qty, pick_status = 'PICKED'
            WHERE id = ?
          `).run(item.id);

          db.prepare(`
            INSERT INTO stock_movements (movement_type, timestamp, product_id, sku, product_name, from_location, to_location, quantity, reference_id, performed_by, notes)
            VALUES ('OUTWARD_PICK', ?, ?, ?, ?, ?, 'PACKING_CONVEYOR', ?, ?, ?, ?)
          `).run(
            now,
            item.product_id,
            item.sku,
            item.product_name,
            item.resolved_location_code,
            item.requested_qty,
            order?.order_number || `ORD-${orderId}`,
            operator,
            `Picking route completed for Row ${item.resolved_row} Bin ${item.resolved_bin}.`
          );
        }

        db.prepare(`UPDATE orders SET status = 'PICKED' WHERE id = ?`).run(orderId);
        db.exec('COMMIT;');

        res.json({
          message: `All items for Order ${order?.order_number} verified and picked!`,
          order_id: orderId,
          picked_count: items.length
        });
      } catch (e) {
        db.exec('ROLLBACK;');
        throw e;
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 10. Dispatch Order
  app.post('/api/orders/:id/dispatch', (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      db.prepare(`UPDATE orders SET status = 'DISPATCHED', dispatched_at = ? WHERE id = ?`).run(now, orderId);
      res.json({ message: 'Order marked as DISPATCHED', order_id: orderId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 11. Stock Movement Log (Audit Trail: Inward / Outward / Transfer)
  app.get('/api/movements', (req, res) => {
    try {
      const type = req.query.type as string;
      const limit = req.query.limit ? Number(req.query.limit) : 100;

      let query = 'SELECT * FROM stock_movements';
      const params: any[] = [];
      if (type && type !== 'ALL') {
        query += ' WHERE movement_type = ?';
        params.push(type);
      }
      query += ' ORDER BY id DESC LIMIT ?';
      params.push(limit);

      const movements = db.prepare(query).all(...params);
      res.json({ movements });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 12. Inward Goods Receipt (Stock replenishment into specific Row / Bin)
  app.post('/api/stock/inward', (req, res) => {
    try {
      const { product_id, location_code, quantity, reference_id, operator = 'Inbound Lead' } = req.body;
      const qty = Number(quantity);

      if (!product_id || !location_code || isNaN(qty) || qty <= 0) {
        res.status(400).json({ error: 'product_id, location_code, and positive quantity are required.' });
        return;
      }

      const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id) as any;
      if (!prod) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      const loc = db.prepare('SELECT * FROM locations WHERE location_code = ?').get(location_code) as any;
      if (!loc) {
        res.status(404).json({ error: 'Location not found' });
        return;
      }

      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      db.exec('BEGIN TRANSACTION;');
      try {
        // Update product stock
        db.prepare(`
          UPDATE products 
          SET current_total_stock = current_total_stock + ?,
              location_code = ?,
              row_number = ?,
              bin_code = ?
          WHERE id = ?
        `).run(qty, location_code, loc.row_number, loc.bin_code, prod.id);

        // Update inventory record
        db.prepare(`
          INSERT INTO inventory (product_id, sku, location_code, quantity, reserved_quantity, last_updated)
          VALUES (?, ?, ?, ?, 0, ?)
          ON CONFLICT(product_id, location_code) 
          DO UPDATE SET quantity = quantity + excluded.quantity, last_updated = excluded.last_updated
        `).run(prod.id, prod.sku, location_code, qty, now);

        // Update location occupied quantity
        db.prepare(`
          UPDATE locations 
          SET current_qty = current_qty + ?
          WHERE location_code = ?
        `).run(qty, location_code);

        // Log INWARD_RECEIPT movement
        db.prepare(`
          INSERT INTO stock_movements (movement_type, timestamp, product_id, sku, product_name, from_location, to_location, quantity, reference_id, performed_by, notes)
          VALUES ('INWARD_RECEIPT', ?, ?, ?, ?, 'INBOUND_DOCK_1', ?, ?, ?, ?, ?)
        `).run(
          now,
          prod.id,
          prod.sku,
          prod.name,
          location_code,
          qty,
          reference_id || `PO-REC-${Date.now().toString().slice(-6)}`,
          operator,
          `Received into Row ${loc.row_number}, Bin ${loc.bin_code}.`
        );

        db.exec('COMMIT;');

        res.json({
          message: `Successfully received ${qty} units of ${prod.sku} into ${location_code}`,
          product: prod.sku,
          location: location_code,
          new_stock: prod.current_total_stock + qty
        });
      } catch (e) {
        db.exec('ROLLBACK;');
        throw e;
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 13. Bin-to-Bin Location Transfer
  app.post('/api/stock/transfer', (req, res) => {
    try {
      const { product_id, from_location, to_location, quantity, operator = 'Forklift Operator' } = req.body;
      const qty = Number(quantity);

      if (!product_id || !from_location || !to_location || isNaN(qty) || qty <= 0) {
        res.status(400).json({ error: 'product_id, from_location, to_location, and valid quantity are required.' });
        return;
      }

      if (from_location === to_location) {
        res.status(400).json({ error: 'Origin and destination bin must be different.' });
        return;
      }

      const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id) as any;
      if (!prod) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      const targetLoc = db.prepare('SELECT * FROM locations WHERE location_code = ?').get(to_location) as any;
      if (!targetLoc) {
        res.status(404).json({ error: 'Target location not found' });
        return;
      }

      const sourceInv = db.prepare('SELECT * FROM inventory WHERE product_id = ? AND location_code = ?').get(product_id, from_location) as any;
      if (!sourceInv || sourceInv.quantity < qty) {
        res.status(400).json({ error: `Insufficient quantity in ${from_location}. Available: ${sourceInv?.quantity || 0}` });
        return;
      }

      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      db.exec('BEGIN TRANSACTION;');
      try {
        // Deduct from source inventory
        db.prepare(`
          UPDATE inventory 
          SET quantity = quantity - ?, last_updated = ?
          WHERE product_id = ? AND location_code = ?
        `).run(qty, now, prod.id, from_location);

        // Add to destination inventory
        db.prepare(`
          INSERT INTO inventory (product_id, sku, location_code, quantity, reserved_quantity, last_updated)
          VALUES (?, ?, ?, ?, 0, ?)
          ON CONFLICT(product_id, location_code) 
          DO UPDATE SET quantity = quantity + excluded.quantity, last_updated = excluded.last_updated
        `).run(prod.id, prod.sku, to_location, qty, now);

        // Update locations current_qty
        db.prepare(`UPDATE locations SET current_qty = MAX(0, current_qty - ?) WHERE location_code = ?`).run(qty, from_location);
        db.prepare(`UPDATE locations SET current_qty = current_qty + ? WHERE location_code = ?`).run(qty, to_location);

        // Update product's primary location if all moved or primary was source
        if (prod.location_code === from_location) {
          db.prepare(`
            UPDATE products 
            SET location_code = ?, row_number = ?, bin_code = ?
            WHERE id = ?
          `).run(to_location, targetLoc.row_number, targetLoc.bin_code, prod.id);
        }

        // Log LOCATION_TRANSFER movement
        db.prepare(`
          INSERT INTO stock_movements (movement_type, timestamp, product_id, sku, product_name, from_location, to_location, quantity, reference_id, performed_by, notes)
          VALUES ('LOCATION_TRANSFER', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          now,
          prod.id,
          prod.sku,
          prod.name,
          from_location,
          to_location,
          qty,
          `TR-${Date.now().toString().slice(-6)}`,
          operator,
          `Relocated ${qty} units from Row ${from_location.split('-')[1]} to Row ${targetLoc.row_code} Bin ${targetLoc.bin_code}.`
        );

        db.exec('COMMIT;');

        res.json({
          message: `Relocated ${qty}x ${prod.sku} from ${from_location} to ${to_location}`,
          product: prod.sku,
          from_location,
          to_location,
          quantity: qty
        });
      } catch (e) {
        db.exec('ROLLBACK;');
        throw e;
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 14. Admin Dashboard Stats: Overview by Row & Low Stock Alerts
  app.get('/api/admin/dashboard', (req, res) => {
    try {
      // Row statistics (Rows 1 to 4)
      const rowsStats = [];
      for (let r = 1; r <= 4; r++) {
        const rowCode = `R0${r}`;
        const locStats = db.prepare(`
          SELECT COUNT(*) as bin_count, 
                 SUM(max_capacity) as total_capacity,
                 SUM(current_qty) as occupied_units
          FROM locations
          WHERE row_number = ?
        `).get(r) as any;

        const prodStats = db.prepare(`
          SELECT COUNT(*) as sku_count,
                 SUM(CASE WHEN current_total_stock <= min_safety_stock THEN 1 ELSE 0 END) as low_stock_count
          FROM products
          WHERE row_number = ?
        `).get(r) as any;

        const rowZones: Record<number, { name: string; desc: string }> = {
          1: { name: 'Electronics Fast-Pick', desc: 'High velocity pick zone, 16 vertical bins' },
          2: { name: 'Industrial Hardware', desc: 'Heavy mechanics & precision linear parts' },
          3: { name: 'Consumer & Maintenance', desc: 'Packaged tools, hardware sets & testing' },
          4: { name: 'Precision & Controlled', desc: 'Temperature monitored micro-components' }
        };

        const capacity = locStats.total_capacity || 8000;
        const occupied = locStats.occupied_units || 0;
        const occupancyPct = Math.round((occupied / capacity) * 100);

        rowsStats.push({
          rowNumber: r,
          rowCode,
          zoneName: rowZones[r].name,
          description: rowZones[r].desc,
          binCount: locStats.bin_count || 16,
          skuCount: prodStats.sku_count || 0,
          totalCapacity: capacity,
          occupiedUnits: occupied,
          occupancyPct,
          lowStockCount: prodStats.low_stock_count || 0
        });
      }

      // Low stock alerts list
      const lowStockProducts = db.prepare(`
        SELECT p.*, l.zone_name 
        FROM products p
        JOIN locations l ON l.location_code = p.location_code
        WHERE p.current_total_stock <= p.min_safety_stock
        ORDER BY p.current_total_stock ASC
        LIMIT 25
      `).all();

      // Recent order metrics
      const orderMetrics = db.prepare(`
        SELECT 
          COUNT(*) as total_orders,
          SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_orders,
          SUM(CASE WHEN status = 'PICKING' THEN 1 ELSE 0 END) as active_picking,
          SUM(CASE WHEN status = 'PICKED' THEN 1 ELSE 0 END) as ready_for_dispatch,
          SUM(CASE WHEN status = 'DISPATCHED' THEN 1 ELSE 0 END) as dispatched_today
        FROM orders
      `).get() as any;

      res.json({
        rowsOverview: rowsStats,
        lowStockAlerts: lowStockProducts,
        metrics: orderMetrics
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // VITE MIDDLEWARE SETUP
  // -------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

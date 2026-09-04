import { db } from './db';

export function seedDatabaseIfEmpty() {
  const existingCount = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
  if (existingCount && existingCount.count > 100) {
    console.log(`Database already seeded with ${existingCount.count} products.`);
    return;
  }

  console.log('Seeding warehouse, locations, 600 SKUs, orders, and stock movements...');

  // 1. Insert Warehouse
  db.prepare(`
    INSERT OR REPLACE INTO warehouse (id, code, name, address, total_rows, bins_per_row)
    VALUES (1, 'WH-1', 'Central Logistics Hub Alpha', '4800 Distribution Blvd, Dock Gate 4', 4, 16)
  `).run();

  // 2. Insert 64 Locations (4 Rows x 16 Bins)
  const insertLoc = db.prepare(`
    INSERT OR REPLACE INTO locations (warehouse_code, row_number, row_code, bin_number, bin_code, location_code, zone_name, zone_type, max_capacity, current_qty)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  const rowZones = [
    { name: 'Electronics Fast-Pick', type: 'ACTIVE_PICK' },
    { name: 'Industrial Hardware', type: 'BULK_RACK' },
    { name: 'Consumer & Maintenance', type: 'SHELF_STANDARD' },
    { name: 'Precision & Controlled', type: 'SECURE_VAULT' },
  ];

  const locationsList: string[] = [];
  for (let r = 1; r <= 4; r++) {
    const rowCode = `R0${r}`;
    const zone = rowZones[r - 1];
    for (let b = 1; b <= 16; b++) {
      const binNumStr = b < 10 ? `0${b}` : `${b}`;
      const binCode = `B${binNumStr}`;
      const locationCode = `WH1-${rowCode}-${binCode}`;
      locationsList.push(locationCode);
      insertLoc.run('WH-1', r, rowCode, b, binCode, locationCode, zone.name, zone.type, 500);
    }
  }

  // 3. Generate 600 realistic SKUs across the 4 rows and 64 bins
  const categories = [
    {
      cat: 'Consumer Electronics',
      row: 1,
      prefixes: ['Microcontroller Board', 'Braided USB-C Cable', 'OLED Display Module', 'LiPo Battery Pack', 'Wireless Gateway Sensor', 'Thermal Camera Sensor', 'Step-Down Buck Regulator', 'Precision Logic Probe', 'Bluetooth Audio Transceiver', 'Fast-Charge Gan Adapter'],
      skuPrefix: 'ELEC'
    },
    {
      cat: 'Industrial Hardware',
      row: 2,
      prefixes: ['Pneumatic Solenoid Valve', 'NEMA23 Stepper Motor', 'Linear Motion Rail 400mm', 'Hardened Ball Bearing 608RS', 'M6 Stainless Hex Bolt Kit', 'Hydraulic Pressure Gauge', 'Industrial Relay Module 8-CH', 'High-Torque Planetary Gearbox', 'Optical Rotary Encoder', 'Variable Frequency Drive'],
      skuPrefix: 'IND'
    },
    {
      cat: 'Automotive & Tools',
      row: 3,
      prefixes: ['Digital Torque Wrench', 'Automotive OBD-II Scanner', 'Carbide End Mill Set', 'Laser Tachometer RPM Meter', 'Cordless Brushless Impact Drill', 'Heavy Duty Rivet Gun', 'Wire Stripper Crimper Tool', 'Magnetic Work Light 1200lm', 'Adjustable Flange Puller', 'High-Speed Air Die Grinder'],
      skuPrefix: 'TOOL'
    },
    {
      cat: 'Precision Components',
      row: 4,
      prefixes: ['Semiconductor Optocoupler', 'Ceramic Resonator 16MHz', 'Precision Shunt Resistor 0.01R', 'Silicon Carbide Power MOSFET', 'Ultra-Low Noise Op-Amp', 'MEMS 6-DoF IMU Sensor', 'Shielded Inductor 10uH', 'Surface Mount Zener Diode', 'High-Speed ADC Converter', 'Precision Crystal Oscillator'],
      skuPrefix: 'PREC'
    }
  ];

  const insertProduct = db.prepare(`
    INSERT INTO products (sku, name, category, unit_of_measure, unit_price, min_safety_stock, current_total_stock, row_number, bin_code, location_code, barcode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertInventory = db.prepare(`
    INSERT INTO inventory (product_id, sku, location_code, quantity, reserved_quantity, last_updated)
    VALUES (?, ?, ?, ?, 0, datetime('now'))
  `);

  const insertMovement = db.prepare(`
    INSERT INTO stock_movements (movement_type, timestamp, product_id, sku, product_name, from_location, to_location, quantity, reference_id, performed_by, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const locQtyMap: Record<string, number> = {};

  let skuCounter = 1001;
  const createdProducts: Array<{ id: number; sku: string; name: string; locationCode: string; row: number; bin: string; qty: number; price: number }> = [];

  for (let r = 1; r <= 4; r++) {
    const catData = categories[r - 1];
    // We create 150 SKUs per row (total 600 SKUs)
    for (let i = 0; i < 150; i++) {
      const prefix = catData.prefixes[i % catData.prefixes.length];
      const modelNum = 100 + i;
      const name = `${prefix} Model v${modelNum}`;
      const sku = `SKU-${catData.skuPrefix}-${skuCounter}`;
      
      // Assign to one of the 16 bins in this row
      const binIndex = (i % 16) + 1;
      const binNumStr = binIndex < 10 ? `0${binIndex}` : `${binIndex}`;
      const binCode = `B${binNumStr}`;
      const locationCode = `WH1-R0${r}-${binCode}`;

      // Vary quantity: some low-stock (3-12 units) to trigger alerts, most healthy (35-140 units)
      let initialQty: number;
      if (i % 14 === 0) {
        initialQty = Math.floor(Math.random() * 8) + 2; // 2 to 9 units (Low stock alert!)
      } else if (i % 20 === 0) {
        initialQty = Math.floor(Math.random() * 12) + 5; // 5 to 16 units
      } else {
        initialQty = Math.floor(Math.random() * 80) + 30; // 30 to 110 units
      }

      const minSafety = 15;
      const unitPrice = parseFloat((Math.random() * 180 + 12).toFixed(2));
      const barcode = `8809${skuCounter}${r}${binIndex}`;

      const res = insertProduct.run(
        sku,
        name,
        catData.cat,
        'EACH',
        unitPrice,
        minSafety,
        initialQty,
        r,
        binCode,
        locationCode,
        barcode
      );

      const productId = Number(res.lastInsertRowid);
      insertInventory.run(productId, sku, locationCode, initialQty);

      locQtyMap[locationCode] = (locQtyMap[locationCode] || 0) + initialQty;

      createdProducts.push({
        id: productId,
        sku,
        name,
        locationCode,
        row: r,
        bin: binCode,
        qty: initialQty,
        price: unitPrice
      });

      skuCounter++;
    }
  }

  // Update locations table with current_qty sums
  const updateLocQty = db.prepare(`UPDATE locations SET current_qty = ? WHERE location_code = ?`);
  for (const [locCode, totalUnits] of Object.entries(locQtyMap)) {
    updateLocQty.run(totalUnits, locCode);
  }

  // 4. Seed Initial Stock Movements (Audit Trail)
  const pastDates = [
    '2026-09-02 08:30:15',
    '2026-09-02 11:14:22',
    '2026-09-02 15:40:00',
    '2026-09-03 09:12:30',
    '2026-09-03 14:05:18',
    '2026-09-03 17:45:00',
    '2026-09-04 07:15:00',
    '2026-09-04 08:20:45'
  ];

  for (let m = 0; m < 16; m++) {
    const prod = createdProducts[m * 10];
    const d = pastDates[m % pastDates.length];
    if (m % 3 === 0) {
      insertMovement.run(
        'INWARD_RECEIPT',
        d,
        prod.id,
        prod.sku,
        prod.name,
        'RECEIVING-BAY-01',
        prod.locationCode,
        50,
        `PO-2026-${8400 + m}`,
        'Staff Lead Marcus T.',
        'Initial inbound receipt verified and shelved.'
      );
    } else if (m % 3 === 1) {
      insertMovement.run(
        'OUTWARD_PICK',
        d,
        prod.id,
        prod.sku,
        prod.name,
        prod.locationCode,
        'PACKING-STATION-A',
        prod.qty > 5 ? 4 : 1,
        `ORD-2026-${8900 + m}`,
        'Picker Elena V.',
        'Fulfillment pick completed with 100% location accuracy.'
      );
    } else {
      insertMovement.run(
        'LOCATION_TRANSFER',
        d,
        prod.id,
        prod.sku,
        prod.name,
        `WH1-R0${prod.row}-B01`,
        prod.locationCode,
        15,
        `TR-2026-${5200 + m}`,
        'Supervisor David K.',
        'Aisle rebalance to optimize fast-pick picking route.'
      );
    }
  }

  // 5. Seed Orders and Order Items with exact row/bin resolved locations!
  const insertOrder = db.prepare(`
    INSERT INTO orders (order_number, customer_name, destination_channel, priority, status, total_items, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertOrderItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, sku, product_name, requested_qty, picked_qty, resolved_row, resolved_bin, resolved_location_code, pick_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedOrdersData = [
    {
      order_number: 'ORD-2026-901',
      customer_name: 'Apex Robotics Systems',
      destination: 'Express Freight (Dock 3)',
      priority: 'URGENT',
      status: 'PENDING',
      productIndices: [12, 160, 310, 480],
      quantities: [2, 1, 4, 1]
    },
    {
      order_number: 'ORD-2026-902',
      customer_name: 'NovaTech BioLab Logistics',
      destination: 'Standard Courier (Door 1)',
      priority: 'HIGH',
      status: 'PENDING',
      productIndices: [5, 45, 185],
      quantities: [3, 2, 1]
    },
    {
      order_number: 'ORD-2026-903',
      customer_name: 'Industrial Dynamics Corp',
      destination: 'Pallet Linehaul A',
      priority: 'STANDARD',
      status: 'PICKING',
      productIndices: [170, 195, 340, 490, 520],
      quantities: [5, 2, 3, 2, 1]
    },
    {
      order_number: 'ORD-2026-904',
      customer_name: 'Skyline Aerospace Assembly',
      destination: 'Next-Flight-Out (Gate 2)',
      priority: 'URGENT',
      status: 'PENDING',
      productIndices: [30, 470],
      quantities: [1, 2]
    },
    {
      order_number: 'ORD-2026-905',
      customer_name: 'Greenfield Renewable Power',
      destination: 'Regional Truckload',
      priority: 'STANDARD',
      status: 'PENDING',
      productIndices: [210, 225, 360, 410],
      quantities: [2, 4, 1, 3]
    },
    {
      order_number: 'ORD-2026-906',
      customer_name: 'Vanguard Electronics Ltd',
      destination: 'Direct Dispatch',
      priority: 'HIGH',
      status: 'PICKED',
      productIndices: [8, 22, 155],
      quantities: [2, 1, 1]
    }
  ];

  for (const o of seedOrdersData) {
    const res = insertOrder.run(
      o.order_number,
      o.customer_name,
      o.destination,
      o.priority,
      o.status,
      o.productIndices.length,
      '2026-09-04 08:45:00'
    );
    const orderId = Number(res.lastInsertRowid);

    for (let idx = 0; idx < o.productIndices.length; idx++) {
      const prod = createdProducts[o.productIndices[idx]];
      const requestedQty = o.quantities[idx];
      const isPicked = o.status === 'PICKED';
      insertOrderItem.run(
        orderId,
        prod.id,
        prod.sku,
        prod.name,
        requestedQty,
        isPicked ? requestedQty : 0,
        prod.row,
        prod.bin,
        prod.locationCode,
        isPicked ? 'PICKED' : 'PENDING'
      );
    }
  }

  console.log('Seeding complete! 600 SKUs mapped across 64 bins in Rows 1-4.');
}

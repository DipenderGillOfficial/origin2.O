export type WarehouseTab =
  | 'order-intake'
  | 'location-hierarchy'
  | 'inventory-mapping'
  | 'stock-movements'
  | 'admin-dashboard';

export interface WarehouseMeta {
  id: number;
  code: string;
  name: string;
  address: string;
  total_rows: number;
  bins_per_row: number;
}

export interface WarehouseStats {
  totalRows: number;
  totalBins: number;
  totalSkus: number;
  totalUnits: number;
  inventoryValuation: string;
  lowStockAlerts: number;
}

export interface WarehouseLocation {
  id: number;
  warehouse_code: string;
  row_number: number;
  row_code: string;
  bin_number: number;
  bin_code: string;
  location_code: string;
  zone_name: string;
  zone_type: string;
  max_capacity: number;
  current_qty: number;
  status: string;
  sku_count?: number;
  calculated_units?: number;
}

export interface WarehouseProduct {
  id: number;
  sku: string;
  name: string;
  category: string;
  unit_of_measure: string;
  unit_price: number;
  min_safety_stock: number;
  current_total_stock: number;
  row_number: number;
  bin_code: string;
  location_code: string;
  barcode: string;
  bin_quantity?: number;
  last_updated?: string;
  bin_locations?: Array<{ location_code: string; quantity: number }>;
}

export interface WarehouseOrderItem {
  id: number;
  order_id: number;
  product_id: number;
  sku: string;
  product_name: string;
  requested_qty: number;
  picked_qty: number;
  resolved_row: number;
  resolved_bin: string;
  resolved_location_code: string;
  pick_status: 'PENDING' | 'PICKED';
  unit_price?: number;
  current_bin_stock?: number;
  live_stock?: number;
}

export interface WarehouseOrder {
  id: number;
  order_number: string;
  customer_name: string;
  destination_channel: string;
  priority: 'URGENT' | 'HIGH' | 'STANDARD';
  status: 'PENDING' | 'PICKING' | 'PICKED' | 'DISPATCHED';
  total_items: number;
  created_at: string;
  dispatched_at?: string;
  items: WarehouseOrderItem[];
  isAllPicked?: boolean;
}

export interface StockMovement {
  id: number;
  movement_type: 'INWARD_RECEIPT' | 'OUTWARD_PICK' | 'LOCATION_TRANSFER' | 'ORDER_INTAKE' | string;
  timestamp: string;
  product_id: number;
  sku: string;
  product_name: string;
  from_location: string;
  to_location: string;
  quantity: number;
  reference_id: string;
  performed_by: string;
  notes?: string;
}

export interface RowOverview {
  rowNumber: number;
  rowCode: string;
  zoneName: string;
  description: string;
  binCount: number;
  skuCount: number;
  totalCapacity: number;
  occupiedUnits: number;
  occupancyPct: number;
  lowStockCount: number;
}

export interface AdminDashboardData {
  rowsOverview: RowOverview[];
  lowStockAlerts: WarehouseProduct[];
  metrics: {
    total_orders: number;
    pending_orders: number;
    active_picking: number;
    ready_for_dispatch: number;
    dispatched_today: number;
  };
}

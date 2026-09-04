import seed from './data/seed.json';

type AnyRecord = Record<string, any>;

const state = {
  warehouse: structuredClone(seed.warehouse) as AnyRecord,
  locations: structuredClone(seed.locations) as AnyRecord[],
  products: structuredClone(seed.products) as AnyRecord[],
  inventory: structuredClone(seed.inventory) as AnyRecord[],
  orders: structuredClone(seed.orders) as AnyRecord[],
  order_items: structuredClone(seed.order_items) as AnyRecord[],
  movements: structuredClone(seed.movements) as AnyRecord[],
};

let nextOrderId = Math.max(0, ...state.orders.map(o => Number(o.id))) + 1;
let nextOrderItemId = Math.max(0, ...state.order_items.map(o => Number(o.id))) + 1;
let nextMovementId = Math.max(0, ...state.movements.map(o => Number(o.id))) + 1;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const notFound = () => jsonResponse({ error: 'Not found' }, 404);
const now = () => new Date().toISOString().replace('T', ' ').substring(0, 19);

function warehouseResponse() {
  const totalUnits = state.products.reduce((sum, p) => sum + Number(p.current_total_stock || 0), 0);
  const valuation = state.products.reduce((sum, p) => sum + Number(p.current_total_stock || 0) * Number(p.unit_price || 0), 0);
  const lowStock = state.products.filter(p => Number(p.current_total_stock) <= Number(p.min_safety_stock)).length;
  return {
    warehouse: state.warehouse,
    stats: {
      totalRows: 4,
      totalBins: state.locations.length,
      totalSkus: state.products.length,
      totalUnits,
      inventoryValuation: valuation.toFixed(2),
      lowStockAlerts: lowStock,
    },
  };
}

function productsResponse(url: URL) {
  const row = url.searchParams.get('row');
  const category = url.searchParams.get('category');
  const lowStock = url.searchParams.get('low_stock') === 'true';
  const limit = Number(url.searchParams.get('limit') || 50);
  const offset = Number(url.searchParams.get('offset') || 0);
  const sku = url.searchParams.get('sku');
  const search = (url.searchParams.get('q') || url.searchParams.get('search') || '').trim().toLowerCase();

  let list = state.products.filter(p => {
    if (row && Number(p.row_number) !== Number(row)) return false;
    if (category && category !== 'ALL' && p.category !== category) return false;
    if (lowStock && Number(p.current_total_stock) > Number(p.min_safety_stock)) return false;
    if (sku && p.sku !== sku) return false;
    if (search && !String(p.name).toLowerCase().includes(search) && !String(p.sku).toLowerCase().includes(search)) return false;
    return true;
  });

  const total = list.length;
  list = list.slice(offset, offset + limit).map(p => ({
    ...p,
    bin_locations: state.inventory
      .filter(i => Number(i.product_id) === Number(p.id) && Number(i.quantity) > 0)
      .map(i => ({ location_code: i.location_code, quantity: i.quantity })),
  }));

  return { total, page: Math.floor(offset / limit) + 1, limit, products: list };
}

function ordersResponse() {
  const orders = [...state.orders]
    .sort((a,b) => ({URGENT:1,HIGH:2,STANDARD:3}[a.priority] || 3) - ({URGENT:1,HIGH:2,STANDARD:3}[b.priority] || 3) || String(b.created_at).localeCompare(String(a.created_at)))
    .map(o => ({ ...o, items: state.order_items.filter(i => Number(i.order_id) === Number(o.id)).map(enrichOrderItem) }));
  return { orders };
}

function enrichOrderItem(item: AnyRecord): AnyRecord {
  const p = state.products.find(p => Number(p.id) === Number(item.product_id));
  return { ...item, unit_price: p?.unit_price, current_bin_stock: p?.current_total_stock, live_stock: p?.current_total_stock };
}

function adminResponse() {
  const rowZones: Record<number, { name: string; desc: string }> = {
    1: { name: 'Electronics Fast-Pick', desc: 'High velocity pick zone, 16 vertical bins' },
    2: { name: 'Industrial Hardware', desc: 'Heavy mechanics & precision linear parts' },
    3: { name: 'Consumer & Maintenance', desc: 'Packaged tools, hardware sets & testing' },
    4: { name: 'Precision & Controlled', desc: 'Temperature monitored micro-components' },
  };
  const rowsOverview = [1,2,3,4].map(r => {
    const locs = state.locations.filter(l => Number(l.row_number) === r);
    const prods = state.products.filter(p => Number(p.row_number) === r);
    const totalCapacity = locs.reduce((s,l) => s + Number(l.max_capacity || 0), 0) || 8000;
    const occupiedUnits = locs.reduce((s,l) => s + Number(l.current_qty || 0), 0);
    return {
      rowNumber: r,
      rowCode: `R0${r}`,
      zoneName: rowZones[r].name,
      description: rowZones[r].desc,
      binCount: locs.length || 16,
      skuCount: prods.length,
      totalCapacity,
      occupiedUnits,
      occupancyPct: Math.round((occupiedUnits / totalCapacity) * 100),
      lowStockCount: prods.filter(p => Number(p.current_total_stock) <= Number(p.min_safety_stock)).length,
    };
  });
  const lowStockAlerts = state.products.filter(p => Number(p.current_total_stock) <= Number(p.min_safety_stock)).map(p => ({
    ...p,
    zone_name: state.locations.find(l => l.location_code === p.location_code)?.zone_name,
  }));
  const pending = state.orders.filter(o => o.status === 'PENDING').length;
  const active = state.orders.filter(o => o.status === 'PICKING').length;
  const ready = state.orders.filter(o => o.status === 'PICKED').length;
  const dispatchedToday = state.orders.filter(o => o.status === 'DISPATCHED' && String(o.dispatched_at || '').slice(0,10) === new Date().toISOString().slice(0,10)).length;
  return { rowsOverview, lowStockAlerts, metrics: { total_orders: state.orders.length, pending_orders: pending, active_picking: active, ready_for_dispatch: ready, dispatched_today: dispatchedToday } };
}

function mutateOrderPick(orderId: number, itemId?: number) {
  const order = state.orders.find(o => Number(o.id) === orderId);
  if (!order) return jsonResponse({ error: 'Order not found' }, 404);
  const items = state.order_items.filter(i => Number(i.order_id) === orderId && (itemId == null || Number(i.id) === itemId));
  if (!items.length) return jsonResponse({ error: 'Order item not found' }, 404);
  const picked: AnyRecord[] = [];
  for (const item of items) {
    if (item.pick_status === 'PICKED') continue;
    const qty = Number(item.requested_qty);
    const product = state.products.find(p => Number(p.id) === Number(item.product_id));
    const inv = state.inventory.find(i => Number(i.product_id) === Number(item.product_id) && i.location_code === item.resolved_location_code);
    const loc = state.locations.find(l => l.location_code === item.resolved_location_code);
    if (!product || !inv || Number(inv.quantity) < qty) return jsonResponse({ error: `Insufficient stock for ${item.sku}` }, 400);
    product.current_total_stock = Math.max(0, Number(product.current_total_stock) - qty);
    inv.quantity = Math.max(0, Number(inv.quantity) - qty);
    inv.last_updated = now();
    if (loc) loc.current_qty = Math.max(0, Number(loc.current_qty) - qty);
    item.picked_qty = qty;
    item.pick_status = 'PICKED';
    state.movements.push({ id: nextMovementId++, movement_type:'OUTWARD_PICK', timestamp:now(), product_id:item.product_id, sku:item.sku, product_name:item.product_name, from_location:item.resolved_location_code, to_location:'PACKING_CONVEYOR', quantity:qty, reference_id:order.order_number, performed_by:'Fulfillment Staff', notes:`Picked from Row ${item.resolved_row}, Bin ${item.resolved_bin}. Location verified.` });
    picked.push(item);
  }
  const allPicked = state.order_items.filter(i => Number(i.order_id) === orderId).every(i => i.pick_status === 'PICKED');
  order.status = allPicked ? 'PICKED' : 'PICKING';
  return jsonResponse({ message: picked.length ? `Successfully picked ${picked[0].requested_qty}x ${picked[0].sku} from ${picked[0].resolved_location_code}` : 'Item already picked', order_id: orderId, order_item_id: itemId, isOrderComplete: allPicked });
}

async function handleMockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(requestUrl, window.location.origin);
  const method = (init?.method || (typeof input !== 'string' && !(input instanceof URL) ? input.method : 'GET')).toUpperCase();
  const path = url.pathname;

  if (!path.startsWith('/api/')) return window.__omnistockRealFetch!(input, init);
  if (path === '/api/health') return jsonResponse({ status:'ok', timestamp:new Date().toISOString() });
  if (path === '/api/warehouse' && method === 'GET') return jsonResponse(warehouseResponse());
  if (path === '/api/products' && method === 'GET') return jsonResponse(productsResponse(url));
  if (path === '/api/orders' && method === 'GET') return jsonResponse(ordersResponse());

  const locMatch = path.match(/^\/api\/locations\/([^/]+)$/);
  if (locMatch && method === 'GET') {
    const code = decodeURIComponent(locMatch[1]);
    const location = state.locations.find(l => l.location_code === code);
    if (!location) return notFound();
    const products = state.products
      .filter(p => state.inventory.some(i => Number(i.product_id) === Number(p.id) && i.location_code === code))
      .map(p => {
        const inv = state.inventory.find(i => Number(i.product_id) === Number(p.id) && i.location_code === code);
        return { ...p, bin_quantity: inv?.quantity ?? 0, last_updated: inv?.last_updated };
      });
    return jsonResponse({ location, products });
  }
  if (path === '/api/locations' && method === 'GET') {
    const row = url.searchParams.get('row');
    const locations = state.locations.filter(l => !row || Number(l.row_number) === Number(row)).map(l => ({ ...l, sku_count: state.products.filter(p => p.location_code === l.location_code).length, calculated_units: state.products.filter(p => p.location_code === l.location_code).reduce((s,p)=>s+Number(p.current_total_stock||0),0) }));
    return jsonResponse({ locations });
  }
  const orderMatch = path.match(/^\/api\/orders\/(\d+)$/);
  if (orderMatch && method === 'GET') {
    const id = Number(orderMatch[1]);
    const order = state.orders.find(o => Number(o.id) === id);
    if (!order) return notFound();
    const items = state.order_items.filter(i => Number(i.order_id) === id).sort((a,b)=>Number(a.resolved_row)-Number(b.resolved_row)||String(a.resolved_bin).localeCompare(String(b.resolved_bin))).map(enrichOrderItem);
    return jsonResponse({ order: { ...order, isAllPicked: items.every(i=>i.pick_status==='PICKED'), items } });
  }
  if (path === '/api/orders/intake' && method === 'POST') {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const available = state.products.filter(p => Number(p.current_total_stock) > 5).sort(()=>Math.random()-0.5).slice(0,3);
    const selectedIds = Array.isArray(body.selected_sku_ids) && body.selected_sku_ids.length ? body.selected_sku_ids : available.map(p=>p.id);
    const id = nextOrderId++;
    const orderNumber = `ORD-2026-${Math.floor(1000 + Math.random()*9000)}`;
    const order = { id, order_number:orderNumber, customer_name:body.customer_name || `Global Logistics Client #${Math.floor(100+Math.random()*800)}`, destination_channel:body.destination_channel || 'Dock Express Freight Bay 3', priority:body.priority || 'STANDARD', status:'PENDING', total_items:selectedIds.length, created_at:now(), dispatched_at:null };
    state.orders.push(order);
    const resolved:any[]=[];
    for (const pid of selectedIds) {
      const p=state.products.find(x=>Number(x.id)===Number(pid)); if(!p) continue;
      const qty=Math.floor(Math.random()*3)+1;
      const item={id:nextOrderItemId++,order_id:id,product_id:p.id,sku:p.sku,product_name:p.name,requested_qty:qty,picked_qty:0,resolved_row:p.row_number,resolved_bin:p.bin_code,resolved_location_code:p.location_code,pick_status:'PENDING'};
      state.order_items.push(item);
      resolved.push({product_id:p.id,sku:p.sku,name:p.name,requested_qty:qty,resolved_row:p.row_number,resolved_bin:p.bin_code,resolved_location_code:p.location_code,live_bin_stock:p.current_total_stock});
    }
    if(resolved[0]) state.movements.push({id:nextMovementId++,movement_type:'ORDER_INTAKE',timestamp:now(),product_id:resolved[0].product_id,sku:resolved[0].sku,product_name:resolved[0].name,from_location:'SYSTEM',to_location:'PICKING_QUEUE',quantity:resolved.reduce((a,i)=>a+i.requested_qty,0),reference_id:orderNumber,performed_by:'WMS Dispatch Agent',notes:`Order intake verified. Auto-routed to Row ${resolved[0].resolved_row} Bin ${resolved[0].resolved_bin}.`});
    return jsonResponse({message:'Order received and locations instantly resolved!',order:{...order,items:resolved}},201);
  }
  const pickMatch=path.match(/^\/api\/orders\/(\d+)\/pick-item$/);
  if(pickMatch && method==='POST'){ const body=init?.body?JSON.parse(String(init.body)):{}; return mutateOrderPick(Number(pickMatch[1]),Number(body.order_item_id)); }
  const completeMatch=path.match(/^\/api\/orders\/(\d+)\/complete-pick$/);
  if(completeMatch && method==='POST'){ const id=Number(completeMatch[1]); const result=mutateOrderPick(id); if(result.status>=400)return result; const pending=state.order_items.filter(i=>Number(i.order_id)===id&&i.pick_status!=='PICKED'); if(pending.length) mutateOrderPick(id); const order=state.orders.find(o=>Number(o.id)===id); if(order) order.status='PICKED'; return jsonResponse({message:`All items for Order ${order?.order_number} verified and picked!`,order_id:id,picked_count:state.order_items.filter(i=>Number(i.order_id)===id&&i.pick_status==='PICKED').length}); }
  const dispatchMatch=path.match(/^\/api\/orders\/(\d+)\/dispatch$/);
  if(dispatchMatch && method==='POST'){const order=state.orders.find(o=>Number(o.id)===Number(dispatchMatch[1])); if(!order)return notFound(); order.status='DISPATCHED'; order.dispatched_at=now(); return jsonResponse({message:'Order marked as DISPATCHED',order_id:order.id});}
  if(path==='/api/movements'&&method==='GET'){const type=url.searchParams.get('type'); const limit=Number(url.searchParams.get('limit')||100); let list=[...state.movements].reverse(); if(type&&type!=='ALL')list=list.filter(m=>m.movement_type===type); return jsonResponse({movements:list.slice(0,limit)});}
  if(path==='/api/stock/inward'&&method==='POST'){
    const body=init?.body?JSON.parse(String(init.body)):{}; const pid=Number(body.product_id), qty=Number(body.quantity), code=body.location_code; if(!pid||!code||!Number.isFinite(qty)||qty<=0)return jsonResponse({error:'product_id, location_code, and positive quantity are required.'},400);
    const p=state.products.find(x=>Number(x.id)===pid), l=state.locations.find(x=>x.location_code===code); if(!p)return jsonResponse({error:'Product not found'},404); if(!l)return jsonResponse({error:'Location not found'},404);
    p.current_total_stock=Number(p.current_total_stock)+qty; p.location_code=code; p.row_number=l.row_number; p.bin_code=l.bin_code;
    const inv=state.inventory.find(i=>Number(i.product_id)===pid&&i.location_code===code); if(inv){inv.quantity=Number(inv.quantity)+qty;inv.last_updated=now();}else state.inventory.push({id:Math.max(0,...state.inventory.map(i=>Number(i.id)))+1,product_id:pid,sku:p.sku,location_code:code,quantity:qty,reserved_quantity:0,last_updated:now()});
    l.current_qty=Number(l.current_qty)+qty; state.movements.push({id:nextMovementId++,movement_type:'INWARD_RECEIPT',timestamp:now(),product_id:pid,sku:p.sku,product_name:p.name,from_location:'INBOUND_DOCK_1',to_location:code,quantity:qty,reference_id:body.reference_id||`PO-REC-${Date.now().toString().slice(-6)}`,performed_by:body.operator||'Inbound Lead',notes:`Received into Row ${l.row_number}, Bin ${l.bin_code}.`});
    return jsonResponse({message:`Successfully received ${qty} units of ${p.sku} into ${code}`,product:p.sku,location:code,new_stock:Number(p.current_total_stock)});
  }
  if(path==='/api/stock/transfer'&&method==='POST'){
    const body=init?.body?JSON.parse(String(init.body)):{}; const pid=Number(body.product_id), qty=Number(body.quantity), from=body.from_location, to=body.to_location; if(!pid||!from||!to||!Number.isFinite(qty)||qty<=0)return jsonResponse({error:'product_id, from_location, to_location, and valid quantity are required.'},400); if(from===to)return jsonResponse({error:'Origin and destination bin must be different.'},400);
    const p=state.products.find(x=>Number(x.id)===pid), target=state.locations.find(x=>x.location_code===to), source=state.inventory.find(i=>Number(i.product_id)===pid&&i.location_code===from); if(!p)return jsonResponse({error:'Product not found'},404); if(!target)return jsonResponse({error:'Target location not found'},404); if(!source||Number(source.quantity)<qty)return jsonResponse({error:`Insufficient quantity in ${from}. Available: ${source?.quantity||0}`},400);
    source.quantity=Number(source.quantity)-qty; source.last_updated=now(); let dest=state.inventory.find(i=>Number(i.product_id)===pid&&i.location_code===to); if(dest){dest.quantity=Number(dest.quantity)+qty;dest.last_updated=now();}else state.inventory.push({id:Math.max(0,...state.inventory.map(i=>Number(i.id)))+1,product_id:pid,sku:p.sku,location_code:to,quantity:qty,reserved_quantity:0,last_updated:now()});
    const fromLoc=state.locations.find(l=>l.location_code===from); if(fromLoc)fromLoc.current_qty=Math.max(0,Number(fromLoc.current_qty)-qty); target.current_qty=Number(target.current_qty)+qty; if(p.location_code===from){p.location_code=to;p.row_number=target.row_number;p.bin_code=target.bin_code;}
    state.movements.push({id:nextMovementId++,movement_type:'LOCATION_TRANSFER',timestamp:now(),product_id:pid,sku:p.sku,product_name:p.name,from_location:from,to_location:to,quantity:qty,reference_id:`TR-${Date.now().toString().slice(-6)}`,performed_by:body.operator||'Forklift Operator',notes:`Relocated ${qty} units from Row ${String(from).split('-')[1]} to Row ${target.row_code} Bin ${target.bin_code}.`});
    return jsonResponse({message:`Relocated ${qty}x ${p.sku} from ${from} to ${to}`,product:p.sku,from_location:from,to_location:to,quantity:qty});
  }
  if(path==='/api/admin/dashboard'&&method==='GET')return jsonResponse(adminResponse());
  return notFound();
}

declare global { interface Window { __omnistockRealFetch?: typeof window.fetch; } }

export function installMockApi() {
  if (window.__omnistockRealFetch) return;
  window.__omnistockRealFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => handleMockFetch(input, init)) as typeof window.fetch;
}

import React, { useState, useEffect } from 'react';
import { WarehouseOrder } from '../types';

interface OrderIntakeScreenProps {
  onOpenOrderIntakeModal: () => void;
  onRefreshData: () => void;
}

export const OrderIntakeScreen: React.FC<OrderIntakeScreenProps> = ({
  onOpenOrderIntakeModal,
  onRefreshData
}) => {
  const [orders, setOrders] = useState<WarehouseOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<WarehouseOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PICKING' | 'PICKED' | 'DISPATCHED'>('ALL');
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchOrders = async (selectIdAfter?: number) => {
    try {
      setLoading(true);
      const res = await fetch('/api/orders');
      const data = await res.json();
      const fetchedOrders: WarehouseOrder[] = data.orders || [];
      setOrders(fetchedOrders);

      if (fetchedOrders.length > 0) {
        const idToSelect = selectIdAfter || selectedOrderId || fetchedOrders[0].id;
        setSelectedOrderId(idToSelect);
        await fetchOrderDetail(idToSelect);
      }
    } catch (err) {
      console.error('Failed to load orders', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderDetail = async (orderId: number) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      if (data.order) {
        setSelectedOrder(data.order);
      }
    } catch (err) {
      console.error('Failed to load order detail', err);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleSelectOrder = (orderId: number) => {
    setSelectedOrderId(orderId);
    fetchOrderDetail(orderId);
  };

  const handlePickItem = async (orderItemId: number) => {
    if (!selectedOrder) return;
    try {
      setIsProcessing(true);
      const res = await fetch(`/api/orders/${selectedOrder.id}/pick-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_item_id: orderItemId,
          operator: 'Fulfillment Staff'
        })
      });
      const result = await res.json();
      if (res.ok) {
        setActionMessage(result.message);
        setTimeout(() => setActionMessage(null), 4000);
        await fetchOrderDetail(selectedOrder.id);
        await fetchOrders(selectedOrder.id);
        onRefreshData();
      }
    } catch (err) {
      console.error('Pick failed', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteAllPicks = async () => {
    if (!selectedOrder) return;
    try {
      setIsProcessing(true);
      const res = await fetch(`/api/orders/${selectedOrder.id}/complete-pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator: 'Fulfillment Staff Lead' })
      });
      const result = await res.json();
      if (res.ok) {
        setActionMessage(result.message);
        setTimeout(() => setActionMessage(null), 4000);
        await fetchOrderDetail(selectedOrder.id);
        await fetchOrders(selectedOrder.id);
        onRefreshData();
      }
    } catch (err) {
      console.error('Complete all picks failed', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDispatchOrder = async () => {
    if (!selectedOrder) return;
    try {
      setIsProcessing(true);
      const res = await fetch(`/api/orders/${selectedOrder.id}/dispatch`, {
        method: 'POST'
      });
      if (res.ok) {
        setActionMessage(`Order ${selectedOrder.order_number} marked as DISPATCHED!`);
        setTimeout(() => setActionMessage(null), 4000);
        await fetchOrderDetail(selectedOrder.id);
        await fetchOrders(selectedOrder.id);
        onRefreshData();
      }
    } catch (err) {
      console.error('Dispatch failed', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === 'ALL') return true;
    return o.status === statusFilter;
  });

  return (
    <div id="order-intake-screen" className="space-y-6">
      {/* Problem Solution Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-zinc-900">route</span>
            <h2 className="text-base font-bold text-zinc-900 tracking-tight">
              Order Intake & Instant Location Routing
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-900 text-white">
              Zero Wrong-Picks
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1 max-w-2xl">
            When customer orders arrive, the system instantly resolves the exact warehouse <strong>Row</strong> and <strong>Bin</strong> for every SKU. Staff follow the calculated sequential traversal route (Row 1 → Row 4) to pick items without searching.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            id="btn-trigger-intake-modal"
            type="button"
            onClick={onOpenOrderIntakeModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-semibold shadow-xs transition-colors"
          >
            <span className="material-symbols-outlined text-sm text-emerald-400">add_shopping_cart</span>
            <span>+ Ingest New Order</span>
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div className="bg-emerald-900 text-white px-4 py-3 rounded-xl flex items-center justify-between text-xs font-medium shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-emerald-400">check_circle</span>
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-emerald-300 hover:text-white">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Main Split: Orders Queue (Left) vs. Pick Route & Location Resolver (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Orders Queue */}
        <div className="lg:col-span-5 flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
              Incoming Orders Queue ({filteredOrders.length})
            </h3>
            {/* Status Filter Tabs (No search bar!) */}
            <div className="inline-flex p-0.5 rounded-lg bg-zinc-100 border border-zinc-200 text-[11px]">
              {(['ALL', 'PENDING', 'PICKING', 'PICKED', 'DISPATCHED'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-2 py-1 rounded-md font-medium transition-all ${
                    statusFilter === status
                      ? 'bg-white text-zinc-900 font-bold shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="bg-white p-8 rounded-2xl border border-zinc-200 text-center text-xs text-zinc-400">
              Loading orders...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-zinc-200 text-center">
              <span className="material-symbols-outlined text-3xl text-zinc-300 mb-2">inbox</span>
              <p className="text-xs font-semibold text-zinc-600">No orders in this queue</p>
              <p className="text-[11px] text-zinc-400 mt-1">Click "+ Ingest New Order" to create or simulate a customer order.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
              {filteredOrders.map((order) => {
                const isSelected = selectedOrderId === order.id;
                const unpickedCount = order.items.filter((i) => i.pick_status !== 'PICKED').length;

                return (
                  <div
                    key={order.id}
                    id={`order-card-${order.id}`}
                    onClick={() => handleSelectOrder(order.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-zinc-900 text-white border-zinc-900 shadow-md ring-2 ring-zinc-900/20'
                        : 'bg-white text-zinc-900 border-zinc-200 hover:border-zinc-300 hover:shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-xs font-bold ${isSelected ? 'text-white' : 'text-zinc-900'}`}>
                            {order.order_number}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              order.priority === 'URGENT'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : order.priority === 'HIGH'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : isSelected
                                ? 'bg-zinc-800 text-zinc-300'
                                : 'bg-zinc-100 text-zinc-600'
                            }`}
                          >
                            {order.priority}
                          </span>
                        </div>
                        <p className={`text-xs font-medium mt-1 truncate ${isSelected ? 'text-zinc-200' : 'text-zinc-700'}`}>
                          {order.customer_name}
                        </p>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          order.status === 'PICKED'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : order.status === 'DISPATCHED'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : order.status === 'PICKING'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : isSelected
                            ? 'bg-zinc-800 text-zinc-300'
                            : 'bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>

                    <div className={`mt-3 pt-2.5 flex items-center justify-between text-[11px] border-t ${
                      isSelected ? 'border-zinc-800 text-zinc-400' : 'border-zinc-100 text-zinc-500'
                    }`}>
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">inventory_2</span>
                        <span>{order.items.length} items</span>
                        <span>•</span>
                        <span>
                          {order.status === 'PICKED' || order.status === 'DISPATCHED'
                            ? 'All items picked'
                            : `${unpickedCount} left to pick`}
                        </span>
                      </div>
                      <span className="font-mono text-[10px]">{order.created_at.slice(11, 16)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Instant Location Resolution & Staff Picking Route */}
        <div className="lg:col-span-7">
          {selectedOrder ? (
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
              {/* Pick Sheet Header */}
              <div className="p-5 border-b border-zinc-200 bg-zinc-50/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-extrabold text-zinc-900">
                        {selectedOrder.order_number}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          selectedOrder.status === 'PICKED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : selectedOrder.status === 'DISPATCHED'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {selectedOrder.status}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-200 text-zinc-700">
                        Priority: {selectedOrder.priority}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 mt-1">
                      Customer: <strong>{selectedOrder.customer_name}</strong> • Dispatch: {selectedOrder.destination_channel}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {selectedOrder.status !== 'PICKED' && selectedOrder.status !== 'DISPATCHED' && (
                      <button
                        type="button"
                        onClick={handleCompleteAllPicks}
                        disabled={isProcessing}
                        className="px-3.5 py-1.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        Complete Pick Run
                      </button>
                    )}

                    {selectedOrder.status === 'PICKED' && (
                      <button
                        type="button"
                        onClick={handleDispatchOrder}
                        disabled={isProcessing}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm">local_shipping</span>
                        <span>Dispatch Order</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Routing Traversal Guidance Banner */}
                <div className="mt-4 p-3 rounded-xl bg-zinc-900 text-white flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-400 text-base">directions_walk</span>
                    <span>
                      <strong>Sequenced Pick Path:</strong> Items sorted by physical warehouse aisle order (Row 1 → Row 4) to eliminate walking back and forth.
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400 shrink-0 font-mono">
                    {selectedOrder.items.filter((i) => i.pick_status === 'PICKED').length}/{selectedOrder.items.length} Picked
                  </span>
                </div>
              </div>

              {/* Resolved Items List with exact Row and Bin */}
              <div className="p-5 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Pick List & Resolved Bin Coordinates
                </h4>

                <div className="space-y-3">
                  {selectedOrder.items.map((item, idx) => {
                    const isPicked = item.pick_status === 'PICKED';

                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isPicked
                            ? 'bg-zinc-50/70 border-zinc-200/80 opacity-90'
                            : 'bg-white border-zinc-300 shadow-xs'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Item Identity & Sequence */}
                          <div className="flex items-start gap-3">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                              isPicked ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-900 text-white'
                            }`}>
                              {isPicked ? '✓' : idx + 1}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-zinc-900">
                                  {item.sku}
                                </span>
                                <span className="text-xs text-zinc-700 font-medium">
                                  {item.product_name}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-1">
                                <span>Requested: <strong>{item.requested_qty} units</strong></span>
                                <span>•</span>
                                <span>Live in Bin: <strong className="text-zinc-700">{item.current_bin_stock ?? item.live_stock ?? '—'} units</strong></span>
                              </div>
                            </div>
                          </div>

                          {/* EXACT LOCATION HIGHLIGHT (ROW & BIN) */}
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-zinc-100 px-3 py-1.5 rounded-xl border border-zinc-200">
                              <div className="text-right">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                  Row {item.resolved_row}
                                </div>
                                <div className="font-mono text-xs font-black text-zinc-900">
                                  Bin {item.resolved_bin}
                                </div>
                              </div>
                              <div className="h-6 w-px bg-zinc-300 mx-1"></div>
                              <div className="font-mono text-[11px] font-bold text-zinc-800 bg-white px-2 py-0.5 rounded-lg border border-zinc-200">
                                {item.resolved_location_code}
                              </div>
                            </div>

                            {/* Pick Action Button */}
                            {isPicked ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                                <span className="material-symbols-outlined text-sm">done_all</span>
                                <span>Picked</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handlePickItem(item.id)}
                                disabled={isProcessing}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                              >
                                <span className="material-symbols-outlined text-sm text-emerald-400">check</span>
                                <span>Confirm Pick</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-zinc-200 text-center">
              <p className="text-sm font-semibold text-zinc-700">Select an order from the queue to view its resolved picking route.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { AdminDashboardData, WarehouseStats } from '../types';

interface AdminDashboardScreenProps {
  stats: WarehouseStats | null;
  onSelectProductForInward: (productId: number, locCode: string) => void;
  onNavigateToTab: (tab: any) => void;
}

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({
  stats,
  onSelectProductForInward,
  onNavigateToTab
}) => {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/dashboard');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div id="admin-dashboard-screen" className="space-y-6">
      {/* Top Operational Metrics Bento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Inventory Units */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Total Units In Stock
            </span>
            <span className="material-symbols-outlined text-zinc-400 text-lg">warehouse</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-black text-zinc-900">
              {stats ? stats.totalUnits.toLocaleString() : '—'}
            </span>
            <span className="text-xs font-medium text-emerald-600">Across 64 Bins</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">4 Distinct Operational Rows</p>
        </div>

        {/* Managed SKUs */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Active Catalog SKUs
            </span>
            <span className="material-symbols-outlined text-zinc-400 text-lg">qr_code_2</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-black text-zinc-900">
              {stats ? stats.totalSkus : 600}
            </span>
            <span className="text-xs font-medium text-zinc-600">Unique Products</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">100% Location-Mapped</p>
        </div>

        {/* Low Stock Alerts Count */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Low-Stock Alerts
            </span>
            <span className="material-symbols-outlined text-rose-500 text-lg">warning</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-black text-rose-600">
              {data ? data.lowStockAlerts.length : '—'}
            </span>
            <span className="text-xs font-medium text-rose-600">Needs Restock</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">Below Safety Minimum Buffer</p>
        </div>

        {/* Inventory Valuation */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Gross Valuation
            </span>
            <span className="material-symbols-outlined text-zinc-400 text-lg">attach_money</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-black text-zinc-900">
              ${stats ? Number(stats.inventoryValuation).toLocaleString() : '—'}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">Real-time dynamic ledger valuation</p>
        </div>
      </div>

      {/* Stock Overview by Row (Problem Deliverable: Admin dashboard: stock overview by row) */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-zinc-900">view_column</span>
              <span>Stock Overview by Row</span>
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Live capacity breakdown, stored unit counts, and space utilization per aisle.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToTab('location-hierarchy')}
            className="text-xs font-semibold text-zinc-900 hover:underline flex items-center gap-1"
          >
            <span>Explore 64 Bins on Floor</span>
            <span className="material-symbols-outlined text-xs">arrow_forward</span>
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-zinc-400">Loading row statistics...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data?.rowsOverview.map((row) => (
              <div
                key={row.rowNumber}
                className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/60 hover:bg-white hover:shadow-2xs transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-zinc-900 text-white font-mono text-[11px] font-bold flex items-center justify-center">
                      R0{row.rowNumber}
                    </span>
                    <span className="text-xs font-bold text-zinc-900">Row {row.rowNumber}</span>
                  </div>
                  <span className="text-[10px] font-bold text-zinc-500 font-mono">
                    {row.binCount} Bins
                  </span>
                </div>

                <p className="text-[11px] font-medium text-zinc-700 mt-2 truncate" title={row.zoneName}>
                  {row.zoneName}
                </p>

                {/* Utilization Gauge */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-500">Utilization</span>
                    <span className="font-mono font-bold text-zinc-900">{row.occupancyPct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-200 mt-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        row.occupancyPct > 85
                          ? 'bg-rose-500'
                          : row.occupancyPct > 65
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, row.occupancyPct)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-200/80 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Stored Units</span>
                    <span className="font-mono font-bold text-zinc-800">
                      {row.occupiedUnits.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">SKU Count</span>
                    <span className="font-mono font-bold text-zinc-800">
                      {row.skuCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Capacity</span>
                    <span className="font-mono text-zinc-600">
                      {row.totalCapacity.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Low Stock</span>
                    <span className={`font-mono font-bold ${row.lowStockCount > 0 ? 'text-rose-600' : 'text-zinc-600'}`}>
                      {row.lowStockCount} items
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Low-Stock Alerts Section (Problem Deliverable: Admin dashboard: low-stock alerts) */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-600">warning</span>
              <span>Low-Stock Alerts & Replenishment Requisitions</span>
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Items currently at or below minimum safety stock levels requiring immediate inward PO receipts.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            {data?.lowStockAlerts.length || 0} Critical Items
          </span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-zinc-400">Scanning safety stock balances...</div>
        ) : !data?.lowStockAlerts || data.lowStockAlerts.length === 0 ? (
          <div className="py-8 text-center text-xs text-emerald-600 font-medium">
            All items are currently above safety thresholds.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 text-[11px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-200">
                  <th className="py-2.5 px-4">SKU</th>
                  <th className="py-2.5 px-4">Product Name</th>
                  <th className="py-2.5 px-4">Location</th>
                  <th className="py-2.5 px-4 text-right">Current Units</th>
                  <th className="py-2.5 px-4 text-right">Safety Minimum</th>
                  <th className="py-2.5 px-4 text-right">Deficit</th>
                  <th className="py-2.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {data.lowStockAlerts.map((p) => {
                  const deficit = Math.max(0, p.min_safety_stock - p.current_total_stock);
                  return (
                    <tr key={p.id} className="hover:bg-rose-50/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-zinc-900">
                        {p.sku}
                      </td>
                      <td className="py-3 px-4 font-medium text-zinc-800">
                        {p.name}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span className="bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200 font-bold text-zinc-900">
                          {p.location_code}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-rose-600">
                        {p.current_total_stock} units
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-500">
                        {p.min_safety_stock} units
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">
                        -{deficit} units
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => onSelectProductForInward(p.id, p.location_code)}
                          className="px-3 py-1 text-xs font-semibold rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 shadow-2xs transition-colors"
                        >
                          Replenish / Inward PO
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

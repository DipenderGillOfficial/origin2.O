import React, { useState, useEffect } from 'react';
import { WarehouseLocation, WarehouseProduct } from '../types';

interface LocationHierarchyScreenProps {
  onSelectProductForTransfer?: (productId: number, locCode: string) => void;
  onSelectProductForInward?: (productId: number, locCode: string) => void;
}

export const LocationHierarchyScreen: React.FC<LocationHierarchyScreenProps> = ({
  onSelectProductForTransfer,
  onSelectProductForInward
}) => {
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [selectedRow, setSelectedRow] = useState<number | 'ALL'>('ALL');
  const [activeLocationCode, setActiveLocationCode] = useState<string | null>(null);
  const [activeLocationProducts, setActiveLocationProducts] = useState<WarehouseProduct[]>([]);
  const [activeLocationInfo, setActiveLocationInfo] = useState<WarehouseLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const url = selectedRow === 'ALL' ? '/api/locations' : `/api/locations?row=${selectedRow}`;
      const res = await fetch(url);
      const data = await res.json();
      setLocations(data.locations || []);
    } catch (err) {
      console.error('Failed to load locations', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, [selectedRow]);

  const handleInspectBin = async (loc: WarehouseLocation) => {
    setActiveLocationCode(loc.location_code);
    setActiveLocationInfo(loc);
    try {
      setLoadingProducts(true);
      const res = await fetch(`/api/locations/${loc.location_code}`);
      const data = await res.json();
      setActiveLocationProducts(data.products || []);
    } catch (err) {
      console.error('Failed to inspect bin', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const rows = [
    { num: 1, code: 'R01', name: 'Electronics Fast-Pick', desc: 'Active high-velocity pick aisle' },
    { num: 2, code: 'R02', name: 'Industrial Hardware', desc: 'Heavy bulk rack & mechanical storage' },
    { num: 3, code: 'R03', name: 'Consumer & Maintenance', desc: 'Packaged tools and standard maintenance items' },
    { num: 4, code: 'R04', name: 'Precision & Controlled', desc: 'Secure vault & temperature-monitored components' }
  ];

  const displayedLocations = locations.filter((loc) => {
    if (selectedRow === 'ALL') return true;
    return loc.row_number === selectedRow;
  });

  return (
    <div id="location-hierarchy-screen" className="space-y-6">
      {/* Hierarchy Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-zinc-900">lan</span>
              <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                Warehouse Location Hierarchy
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
                Warehouse 1 → 4 Rows → 64 Bins
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1 max-w-2xl">
              Strict 3-tier hierarchy: <strong>Facility (WH-1)</strong> contains <strong>Rows (R01–R04)</strong>, and each row contains <strong>16 dedicated Bins (B01–B16)</strong> with globally unique location codes (e.g. <code>WH1-R01-B04</code>).
            </p>
          </div>

          {/* Row Selection Buttons (NO search bar!) */}
          <div className="inline-flex p-1 rounded-xl bg-zinc-100 border border-zinc-200 text-xs">
            <button
              type="button"
              onClick={() => setSelectedRow('ALL')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                selectedRow === 'ALL'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              All Rows (64 Bins)
            </button>
            {rows.map((r) => (
              <button
                key={r.num}
                type="button"
                onClick={() => setSelectedRow(r.num)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  selectedRow === r.num
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Row {r.num}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row Sections & Grid of Bins */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-zinc-200 text-center text-xs text-zinc-400">
          Loading warehouse hierarchy...
        </div>
      ) : (
        <div className="space-y-6">
          {rows
            .filter((r) => selectedRow === 'ALL' || selectedRow === r.num)
            .map((r) => {
              const rowBins = displayedLocations.filter((l) => l.row_number === r.num);
              const totalRowUnits = rowBins.reduce((sum, b) => sum + (b.calculated_units || b.current_qty || 0), 0);
              const totalRowCapacity = rowBins.reduce((sum, b) => sum + b.max_capacity, 0);
              const rowOccupancyPct = Math.round((totalRowUnits / (totalRowCapacity || 1)) * 100);

              return (
                <div key={r.num} className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
                  {/* Row Header & Utilization Meter */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white font-mono text-xs font-bold flex items-center justify-center">
                        R0{r.num}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-zinc-900 tracking-tight">
                          Row {r.num}: {r.name}
                        </h3>
                        <p className="text-[11px] text-zinc-500">{r.desc} • 16 Active Bins</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-zinc-500">Stored Units:</span>{' '}
                        <strong className="text-zinc-900 font-mono">{totalRowUnits.toLocaleString()} / {totalRowCapacity.toLocaleString()}</strong>
                      </div>
                      <div className="w-28 h-2.5 rounded-full bg-zinc-100 overflow-hidden border border-zinc-200">
                        <div
                          className={`h-full rounded-full ${
                            rowOccupancyPct > 90
                              ? 'bg-rose-500'
                              : rowOccupancyPct > 70
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, rowOccupancyPct)}%` }}
                        ></div>
                      </div>
                      <span className="font-mono font-bold text-zinc-700">{rowOccupancyPct}%</span>
                    </div>
                  </div>

                  {/* 16 Bins Visual Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3 mt-4">
                    {rowBins.map((bin) => {
                      const units = bin.calculated_units || bin.current_qty || 0;
                      const occupancy = Math.min(100, Math.round((units / bin.max_capacity) * 100));
                      const isSelected = activeLocationCode === bin.location_code;

                      return (
                        <div
                          key={bin.id}
                          id={`bin-cell-${bin.location_code}`}
                          onClick={() => handleInspectBin(bin)}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm ring-2 ring-zinc-900/30'
                              : 'bg-zinc-50/70 hover:bg-white hover:border-zinc-300 hover:shadow-2xs border-zinc-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`font-mono text-xs font-black ${isSelected ? 'text-white' : 'text-zinc-900'}`}>
                              {bin.bin_code}
                            </span>
                            <span className={`text-[10px] font-mono ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                              {bin.sku_count || 0} SKUs
                            </span>
                          </div>

                          <div className="mt-2">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className={isSelected ? 'text-zinc-400' : 'text-zinc-500'}>Load</span>
                              <span className={`font-mono font-bold ${isSelected ? 'text-emerald-300' : 'text-zinc-700'}`}>
                                {units}u
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-zinc-200 rounded-full mt-1 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  occupancy > 85 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${occupancy}%` }}
                              ></div>
                            </div>
                          </div>

                          <div className={`mt-2 pt-1.5 border-t text-[9px] font-mono truncate ${
                            isSelected ? 'border-zinc-800 text-zinc-400' : 'border-zinc-200 text-zinc-400'
                          }`}>
                            {bin.location_code}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Bin Detail Inspector Modal / Bottom Sheet */}
      {activeLocationCode && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl border border-zinc-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 bg-zinc-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-mono font-bold text-sm text-emerald-400">
                  {activeLocationInfo?.bin_code}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Bin Inspector: {activeLocationCode}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Row {activeLocationInfo?.row_number}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Zone: {activeLocationInfo?.zone_name} • Max Capacity: {activeLocationInfo?.max_capacity} units
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveLocationCode(null)}
                className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Modal Body: Products in Bin */}
            <div className="p-5 max-h-[480px] overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Assigned Products in this Bin ({activeLocationProducts.length})
                </h4>
                <span className="text-xs text-zinc-500">
                  Total Units: <strong>{activeLocationProducts.reduce((sum, p) => sum + (p.bin_quantity ?? p.current_total_stock), 0)}</strong>
                </span>
              </div>

              {loadingProducts ? (
                <div className="py-8 text-center text-xs text-zinc-400">Loading products in bin...</div>
              ) : activeLocationProducts.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-400">This bin is currently empty.</div>
              ) : (
                <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl overflow-hidden">
                  {activeLocationProducts.map((p) => (
                    <div key={p.id} className="p-3.5 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-zinc-900">{p.sku}</span>
                          <span className="text-xs font-medium text-zinc-700">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-1">
                          <span>Category: {p.category}</span>
                          <span>•</span>
                          <span>Unit Price: ${p.unit_price.toFixed(2)}</span>
                          <span>•</span>
                          <span>Safety Min: {p.min_safety_stock}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] text-zinc-400 block uppercase font-bold">In-Bin Qty</span>
                          <span className={`font-mono text-sm font-bold ${
                            (p.bin_quantity ?? p.current_total_stock) <= p.min_safety_stock
                              ? 'text-rose-600'
                              : 'text-zinc-900'
                          }`}>
                            {p.bin_quantity ?? p.current_total_stock} units
                          </span>
                        </div>

                        {onSelectProductForTransfer && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectProductForTransfer(p.id, activeLocationCode);
                              setActiveLocationCode(null);
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 transition-colors"
                          >
                            Transfer
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveLocationCode(null)}
                className="px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

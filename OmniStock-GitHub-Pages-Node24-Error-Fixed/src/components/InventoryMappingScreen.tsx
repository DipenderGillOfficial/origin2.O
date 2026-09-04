import React, { useState, useEffect } from 'react';
import { WarehouseProduct } from '../types';

interface InventoryMappingScreenProps {
  onSelectProductForTransfer: (productId: number, locCode: string) => void;
  onSelectProductForInward: (productId: number, locCode: string) => void;
  initialSearch?: string;
}

export const InventoryMappingScreen: React.FC<InventoryMappingScreenProps> = ({
  onSelectProductForTransfer,
  onSelectProductForInward,
  initialSearch = ''
}) => {
  const [products, setProducts] = useState<WarehouseProduct[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedRow, setSelectedRow] = useState<number | 'ALL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedSkuFilter, setSelectedSkuFilter] = useState<string>('');
  const [inspectedProduct, setInspectedProduct] = useState<WarehouseProduct | null>(null);

  const limit = 50;

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedRow !== 'ALL') params.append('row', String(selectedRow));
      if (selectedCategory !== 'ALL') params.append('category', selectedCategory);
      if (lowStockOnly) params.append('low_stock', 'true');
      if (selectedSkuFilter) params.append('sku', selectedSkuFilter);
      if (searchQuery.trim()) params.append('q', searchQuery.trim());
      params.append('limit', String(limit));
      params.append('offset', String((page - 1) * limit));

      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();
      setProducts(data.products || []);
      setTotalCount(data.total || 0);
    } catch (err) {
      console.error('Failed to load products', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce product fetching when search query changes
    const timer = setTimeout(() => {
      fetchProducts();
    }, 200);

    return () => clearTimeout(timer);
  }, [selectedRow, selectedCategory, lowStockOnly, selectedSkuFilter, searchQuery, page]);

  const categories = [
    'ALL',
    'Consumer Electronics',
    'Industrial Hardware',
    'Automotive & Tools',
    'Precision Components'
  ];

  const totalPages = Math.ceil(totalCount / limit) || 1;

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedRow('ALL');
    setSelectedCategory('ALL');
    setLowStockOnly(false);
    setSelectedSkuFilter('');
    setPage(1);
  };

  const hasActiveFilters = searchQuery.trim() !== '' || selectedRow !== 'ALL' || selectedCategory !== 'ALL' || lowStockOnly || selectedSkuFilter !== '';

  return (
    <div id="inventory-mapping-screen" className="space-y-6">
      {/* Top Banner & Search Bar */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-zinc-900">inventory_2</span>
              <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                Product-to-Bin Mapping & Live Ledger
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
                {totalCount} Matching SKUs
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1 max-w-2xl">
              Type any product name or SKU to instantly discover its exact physical warehouse row, bin code, and live unit count.
            </p>
          </div>

          {/* Direct SKU Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500 shrink-0">Direct SKU:</span>
            <select
              value={selectedSkuFilter}
              onChange={(e) => {
                setSelectedSkuFilter(e.target.value);
                setPage(1);
              }}
              className="bg-zinc-50 text-zinc-800 text-xs font-mono font-medium py-1.5 px-3 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 cursor-pointer"
            >
              <option value="">All Catalog SKUs</option>
              {products.slice(0, 30).map((p) => (
                <option key={p.id} value={p.sku}>
                  {p.sku} — {p.name.slice(0, 24)}... (Row {p.row_number})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Primary Instant Product Search Bar */}
        <div className="pt-2">
          <label htmlFor="product-name-search-bar" className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
            Instant Product Search Bar
          </label>
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-3.5 text-zinc-400 text-lg pointer-events-none">
              search
            </span>
            <input
              id="product-name-search-bar"
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Type a product name or SKU (e.g. Microcontroller, Rotary Encoder, Stepper Motor, Cable, SKU-ELEC-1001)..."
              className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-zinc-300 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-zinc-50/50 hover:bg-white focus:bg-white transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setPage(1);
                }}
                className="absolute right-3 px-2 py-1 text-xs font-semibold text-zinc-500 hover:text-zinc-900 bg-zinc-200/60 hover:bg-zinc-200 rounded-lg transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-xs">close</span>
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Structured Secondary Filter Controls */}
        <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3">
          {/* Row Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-zinc-500 mr-1">Warehouse Row:</span>
            {(['ALL', 1, 2, 3, 4] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setSelectedRow(r);
                  setPage(1);
                }}
                className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all ${
                  selectedRow === r
                    ? 'bg-zinc-900 text-white shadow-2xs'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {r === 'ALL' ? 'All Rows' : `Row ${r}`}
              </button>
            ))}
          </div>

          {/* Category Dropdown, Low Stock Toggle & Clear */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-zinc-500">Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(1);
                }}
                className="bg-zinc-100 text-zinc-800 text-xs font-medium py-1 px-2.5 rounded-lg border border-zinc-200 focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === 'ALL' ? 'All Categories' : c}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setLowStockOnly(!lowStockOnly);
                setPage(1);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors border ${
                lowStockOnly
                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                  : 'bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200'
              }`}
            >
              <span className="material-symbols-outlined text-sm">warning</span>
              <span>Low Stock Only</span>
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs text-zinc-500 hover:text-zinc-900 font-semibold px-2 py-1 underline"
              >
                Reset All Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Products Table with Instant Location(s) and Quantity */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-400">Searching warehouse inventory...</div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-500 space-y-2">
            <span className="material-symbols-outlined text-2xl text-zinc-400 block mx-auto">search_off</span>
            <p className="font-semibold text-zinc-800">No products found matching your search</p>
            <p className="text-zinc-400">Try typing a different product keyword or reset your filters.</p>
            <button
              type="button"
              onClick={clearAllFilters}
              className="mt-2 px-3 py-1.5 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 text-[11px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-200">
                  <th className="py-3 px-4">SKU / Code</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Assigned Location(s) & Live Qty</th>
                  <th className="py-3 px-4 text-right">Total Live Units</th>
                  <th className="py-3 px-4 text-right">Safety Threshold</th>
                  <th className="py-3 px-4 text-right">Unit Price</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {products.map((p) => {
                  const isLow = p.current_total_stock <= p.min_safety_stock;
                  const binLocations = p.bin_locations && p.bin_locations.length > 0
                    ? p.bin_locations
                    : [{ location_code: p.location_code, quantity: p.current_total_stock }];

                  return (
                    <tr key={p.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-zinc-900 whitespace-nowrap">
                        <span className="cursor-pointer hover:underline" onClick={() => setInspectedProduct(p)}>
                          {p.sku}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div
                          className="font-medium text-zinc-800 cursor-pointer hover:text-zinc-900 hover:underline"
                          onClick={() => setInspectedProduct(p)}
                        >
                          {p.name}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                          Barcode: {p.barcode}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-500 whitespace-nowrap">
                        {p.category}
                      </td>
                      {/* Location(s) and Quantity column */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {binLocations.map((b) => (
                            <span
                              key={b.location_code}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-zinc-100 text-zinc-900 border border-zinc-200 shadow-2xs"
                              title={`Bin location ${b.location_code}: ${b.quantity} units`}
                            >
                              <span className="text-zinc-500 font-normal">
                                {b.location_code}
                              </span>
                              <span className="text-emerald-700 bg-emerald-50 px-1 rounded">
                                {b.quantity}u
                              </span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                        <span className={isLow ? 'text-rose-600 font-extrabold' : 'text-zinc-900'}>
                          {p.current_total_stock} {p.unit_of_measure}
                        </span>
                        {isLow && (
                          <span className="block text-[9px] font-bold text-rose-500 uppercase">
                            DEFICIT
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-500 whitespace-nowrap">
                        {p.min_safety_stock} units
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-700 whitespace-nowrap">
                        ${p.unit_price.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectProductForInward(p.id, p.location_code)}
                            title="Inward goods replenishment into assigned bin"
                            className="px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors inline-flex items-center gap-1 text-[11px] font-semibold"
                          >
                            <span className="material-symbols-outlined text-xs text-zinc-600">add_box</span>
                            <span>Inward</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelectProductForTransfer(p.id, p.location_code)}
                            title="Transfer inventory to different bin"
                            className="px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors inline-flex items-center gap-1 text-[11px] font-semibold"
                          >
                            <span className="material-symbols-outlined text-xs text-zinc-600">sync_alt</span>
                            <span>Transfer</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Pagination */}
        <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between text-xs text-zinc-600 flex-wrap gap-2">
          <div>
            Showing {totalCount > 0 ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, totalCount)} of {totalCount} SKUs
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="px-3 py-1 rounded-lg border border-zinc-200 bg-white font-medium hover:bg-zinc-50 disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <span className="font-semibold text-zinc-800">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              className="px-3 py-1 rounded-lg border border-zinc-200 bg-white font-medium hover:bg-zinc-50 disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Product Quick-Inspection Modal */}
      {inspectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-zinc-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 bg-zinc-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                  SKU Location & Stock Ledger
                </span>
                <h3 className="text-sm font-bold text-white leading-tight mt-0.5">{inspectedProduct.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectedProduct(null)}
                className="text-zinc-400 hover:text-white"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                <div>
                  <span className="text-zinc-400 block text-[10px] uppercase font-bold">SKU Identifier</span>
                  <span className="font-mono font-bold text-zinc-900">{inspectedProduct.sku}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px] uppercase font-bold">Category</span>
                  <span className="font-medium text-zinc-800">{inspectedProduct.category}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px] uppercase font-bold">Barcode</span>
                  <span className="font-mono font-medium text-zinc-800">{inspectedProduct.barcode}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px] uppercase font-bold">Unit Price</span>
                  <span className="font-mono font-bold text-zinc-900">${inspectedProduct.unit_price.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-zinc-900 mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-zinc-600">warehouse</span>
                  <span>Physical Storage Locations ({inspectedProduct.bin_locations?.length || 1} Bin)</span>
                </h4>
                <div className="space-y-2">
                  {(inspectedProduct.bin_locations || [{ location_code: inspectedProduct.location_code, quantity: inspectedProduct.current_total_stock }]).map((loc) => (
                    <div
                      key={loc.location_code}
                      className="p-3 rounded-xl border border-zinc-200 bg-white flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-zinc-900 text-white font-mono text-xs font-bold flex items-center justify-center">
                          {loc.location_code.split('-')[1]}
                        </span>
                        <div>
                          <span className="font-mono font-bold text-zinc-900">{loc.location_code}</span>
                          <span className="text-[10px] text-zinc-400 block">Bin: {loc.location_code.split('-')[2]}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-sm font-black text-emerald-600">{loc.quantity}</span>
                        <span className="text-[10px] text-zinc-400 block">units in bin</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onSelectProductForInward(inspectedProduct.id, inspectedProduct.location_code);
                    setInspectedProduct(null);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">add_box</span>
                  <span>Inward Stock</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectProductForTransfer(inspectedProduct.id, inspectedProduct.location_code);
                    setInspectedProduct(null);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm text-purple-400">sync_alt</span>
                  <span>Transfer Bin</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

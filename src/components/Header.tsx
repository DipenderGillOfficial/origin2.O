import React, { useState } from 'react';
import { WarehouseStats } from '../types';

interface HeaderProps {
  stats: WarehouseStats | null;
  onOpenOrderIntake: () => void;
  onOpenInwardReceipt: () => void;
  onOpenTransfer: () => void;
  onSearchProduct?: (query: string) => void;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  onOpenOrderIntake,
  onOpenInwardReceipt,
  onOpenTransfer,
  onSearchProduct,
  onToggleMobileMenu
}) => {
  const [headerSearch, setHeaderSearch] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearchProduct && headerSearch.trim()) {
      onSearchProduct(headerSearch.trim());
    }
  };

  return (
    <header
      id="warehouse-app-header"
      className="fixed top-0 md:left-64 left-0 right-0 h-16 bg-white/95 backdrop-blur-md z-40 px-4 md:px-6 flex items-center justify-between border-b border-zinc-200 shadow-xs transition-all"
    >
      {/* Left: Mobile Menu Button & Warehouse Identity */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-100 transition-colors"
          aria-label="Toggle navigation menu"
        >
          <span className="material-symbols-outlined text-lg">menu</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
            <span className="text-xs font-mono tracking-wider">WH-1</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm font-bold text-zinc-900 tracking-tight leading-none truncate max-w-[150px] sm:max-w-none">
                Central Logistics Hub Alpha
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                SQLite Live
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5 hidden sm:block">
              4 Rows • 64 Bins • {stats ? stats.totalSkus : 600} Managed SKUs • Location Hierarchy Active
            </p>
          </div>
        </div>
      </div>

      {/* Middle: Header Quick Product Finder */}
      <form onSubmit={handleSearchSubmit} className="hidden lg:flex items-center relative max-w-xs w-full mx-4">
        <span className="material-symbols-outlined absolute left-3 text-zinc-400 text-sm pointer-events-none">
          search
        </span>
        <input
          type="text"
          value={headerSearch}
          onChange={(e) => setHeaderSearch(e.target.value)}
          placeholder="Quick find product (press enter)..."
          className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-zinc-200 text-xs text-zinc-800 placeholder:text-zinc-400 bg-zinc-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-colors"
        />
      </form>

      {/* Right: Operational Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          id="btn-quick-inward"
          type="button"
          onClick={onOpenInwardReceipt}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 text-xs font-medium transition-colors shadow-2xs"
        >
          <span className="material-symbols-outlined text-sm text-zinc-500">add_box</span>
          <span>Inward Receipt</span>
        </button>

        <button
          id="btn-quick-transfer"
          type="button"
          onClick={onOpenTransfer}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 text-xs font-medium transition-colors shadow-2xs"
        >
          <span className="material-symbols-outlined text-sm text-zinc-500">sync_alt</span>
          <span>Transfer Bin</span>
        </button>

        <button
          id="btn-quick-order-intake"
          type="button"
          onClick={onOpenOrderIntake}
          className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-semibold transition-colors shadow-xs"
        >
          <span className="material-symbols-outlined text-sm text-emerald-400">add_shopping_cart</span>
          <span>+ Ingest Order</span>
        </button>
      </div>
    </header>
  );
};

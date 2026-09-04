import React from 'react';
import { WarehouseTab } from '../types';

interface SidebarProps {
  currentTab: WarehouseTab;
  onSelectTab: (tab: WarehouseTab) => void;
  pendingOrdersCount: number;
  lowStockCount: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingOrdersCount,
  lowStockCount,
  isOpenMobile = false,
  onCloseMobile
}) => {
  const navItems: Array<{
    id: WarehouseTab;
    label: string;
    icon: string;
    badge?: number;
    badgeColor?: string;
  }> = [
    {
      id: 'order-intake',
      label: 'Order Intake & Pick Route',
      icon: 'receipt_long',
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
      badgeColor: 'bg-amber-500 text-white'
    },
    {
      id: 'location-hierarchy',
      label: 'Location Hierarchy (Row/Bin)',
      icon: 'lan'
    },
    {
      id: 'inventory-mapping',
      label: 'Product-to-Bin Mapping',
      icon: 'inventory_2'
    },
    {
      id: 'stock-movements',
      label: 'Stock Movement Log',
      icon: 'history_toggle_off'
    },
    {
      id: 'admin-dashboard',
      label: 'Admin Dashboard',
      icon: 'dashboard_customize',
      badge: lowStockCount > 0 ? lowStockCount : undefined,
      badgeColor: 'bg-rose-500 text-white'
    }
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        id="warehouse-sidebar"
        className={`fixed left-0 top-0 h-full w-64 bg-white z-50 flex flex-col justify-between border-r border-zinc-200 shadow-xs transition-transform duration-200 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center gap-3 bg-white border-b border-zinc-200">
          <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white font-bold shadow-xs shrink-0">
            <span className="material-symbols-outlined text-lg text-emerald-400">shelves</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-zinc-900 tracking-tight leading-none">
              OmniStock WMS
            </span>
            <span className="text-[10px] text-zinc-500 font-semibold tracking-wider mt-1 uppercase">
              Warehouse 1 System
            </span>
          </div>
        </div>

        {/* Operational Scope Banner */}
        <div className="p-3">
          <div className="bg-zinc-900 text-zinc-100 p-3 rounded-2xl border border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Active Facility
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                LIVE DB
              </span>
            </div>
            <div className="mt-1.5">
              <p className="text-xs font-semibold text-white">Central Hub (WH-1)</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Hierarchy: WH-1 → R01-R04 → B01-B16</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Operations & Routing
          </div>
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-left ${
                  isActive
                    ? 'bg-zinc-900 text-white font-semibold shadow-xs'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 font-medium text-xs'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className={`material-symbols-outlined text-[18px] ${isActive ? 'text-emerald-400' : 'text-zinc-400'}`}>
                    {item.icon}
                  </span>
                  <span className="truncate text-xs">{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${item.badgeColor || 'bg-zinc-200 text-zinc-700'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer System Info */}
      <div className="p-3 border-t border-zinc-200 bg-zinc-50/50">
        <div className="px-2 py-1.5 flex items-center justify-between text-[11px] text-zinc-500">
          <span>Storage Engine</span>
          <span className="font-mono text-[10px] font-medium text-zinc-700">node:sqlite</span>
        </div>
        <div className="px-2 py-1 flex items-center justify-between text-[11px] text-zinc-500">
          <span>Fulfillment Accuracy</span>
          <span className="text-[10px] font-semibold text-emerald-600">100% Verified</span>
        </div>
      </div>
    </aside>
    </>
  );
};

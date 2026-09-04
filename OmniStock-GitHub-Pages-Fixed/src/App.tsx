import { useState, useEffect } from 'react';
import { WarehouseTab, WarehouseStats } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OrderIntakeScreen } from './components/OrderIntakeScreen';
import { LocationHierarchyScreen } from './components/LocationHierarchyScreen';
import { InventoryMappingScreen } from './components/InventoryMappingScreen';
import { StockMovementScreen } from './components/StockMovementScreen';
import { AdminDashboardScreen } from './components/AdminDashboardScreen';
import { OrderIntakeModal } from './components/OrderIntakeModal';
import { InwardReceiptModal } from './components/InwardReceiptModal';
import { TransferModal } from './components/TransferModal';

export default function App() {
  const [currentTab, setCurrentTab] = useState<WarehouseTab>('order-intake');
  const [stats, setStats] = useState<WarehouseStats | null>(null);
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);
  const [lowStockCount, setLowStockCount] = useState<number>(0);

  // Modals state
  const [isOrderIntakeOpen, setIsOrderIntakeOpen] = useState(false);
  const [isInwardReceiptOpen, setIsInwardReceiptOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);

  // Pre-selected items for modals
  const [preSelectedProductId, setPreSelectedProductId] = useState<number | null>(null);
  const [preSelectedLocationCode, setPreSelectedLocationCode] = useState<string | null>(null);

  // Global flash notification
  const [globalBanner, setGlobalBanner] = useState<string | null>(null);

  // Mobile menu & global search state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');

  const fetchGlobalStats = async () => {
    try {
      const res = await fetch('/api/warehouse');
      const data = await res.json();
      if (data.stats) {
        setStats(data.stats);
        setLowStockCount(data.stats.lowStockAlerts || 0);
      }

      const ordersRes = await fetch('/api/orders');
      const ordersData = await ordersRes.json();
      if (ordersData.orders) {
        const pending = ordersData.orders.filter(
          (o: any) => o.status === 'PENDING' || o.status === 'PICKING'
        ).length;
        setPendingOrdersCount(pending);
      }
    } catch (err) {
      console.error('Failed to load warehouse stats', err);
    }
  };

  useEffect(() => {
    fetchGlobalStats();
  }, []);

  const showBanner = (message: string) => {
    setGlobalBanner(message);
    setTimeout(() => setGlobalBanner(null), 5000);
  };

  const handleOrderCreated = (order: any) => {
    showBanner(`Order ${order.order_number} ingested! All ${order.items?.length || 0} items instantly resolved to exact Row & Bin coordinates.`);
    setCurrentTab('order-intake');
    fetchGlobalStats();
  };

  const handleSelectProductForInward = (productId: number, locCode: string) => {
    setPreSelectedProductId(productId);
    setPreSelectedLocationCode(locCode);
    setIsInwardReceiptOpen(true);
  };

  const handleSelectProductForTransfer = (productId: number, locCode: string) => {
    setPreSelectedProductId(productId);
    setPreSelectedLocationCode(locCode);
    setIsTransferOpen(true);
  };

  return (
    <div id="omnistock-app-container" className="min-h-screen bg-zinc-100/70 text-zinc-900 antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        pendingOrdersCount={pendingOrdersCount}
        lowStockCount={lowStockCount}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Global Header */}
      <Header
        stats={stats}
        onOpenOrderIntake={() => setIsOrderIntakeOpen(true)}
        onOpenInwardReceipt={() => {
          setPreSelectedProductId(null);
          setPreSelectedLocationCode(null);
          setIsInwardReceiptOpen(true);
        }}
        onOpenTransfer={() => {
          setPreSelectedProductId(null);
          setPreSelectedLocationCode(null);
          setIsTransferOpen(true);
        }}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        onSearchProduct={(query) => {
          setGlobalSearchQuery(query);
          setCurrentTab('inventory-mapping');
        }}
      />

      {/* Main Content Area */}
      <main className="md:pl-64 pl-0 pt-16 min-h-screen">
        <div className="px-4 sm:px-6 py-6 w-full max-w-[1600px] mx-auto">
          {/* Global Notification Banner */}
          {globalBanner && (
            <div className="mb-5 bg-zinc-900 text-white px-5 py-3.5 rounded-2xl shadow-sm flex items-center justify-between border border-zinc-800 animate-in fade-in">
              <div className="flex items-center gap-2.5 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="material-symbols-outlined text-base text-emerald-400">verified</span>
                <span>{globalBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setGlobalBanner(null)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}

          {/* Active Screen Tabs */}
          {currentTab === 'order-intake' && (
            <OrderIntakeScreen
              onOpenOrderIntakeModal={() => setIsOrderIntakeOpen(true)}
              onRefreshData={fetchGlobalStats}
            />
          )}

          {currentTab === 'location-hierarchy' && (
            <LocationHierarchyScreen
              onSelectProductForTransfer={handleSelectProductForTransfer}
              onSelectProductForInward={handleSelectProductForInward}
            />
          )}

          {currentTab === 'inventory-mapping' && (
            <InventoryMappingScreen
              key={globalSearchQuery}
              initialSearch={globalSearchQuery}
              onSelectProductForTransfer={handleSelectProductForTransfer}
              onSelectProductForInward={handleSelectProductForInward}
            />
          )}

          {currentTab === 'stock-movements' && (
            <StockMovementScreen
              onOpenInwardReceipt={() => {
                setPreSelectedProductId(null);
                setPreSelectedLocationCode(null);
                setIsInwardReceiptOpen(true);
              }}
              onOpenTransfer={() => {
                setPreSelectedProductId(null);
                setPreSelectedLocationCode(null);
                setIsTransferOpen(true);
              }}
            />
          )}

          {currentTab === 'admin-dashboard' && (
            <AdminDashboardScreen
              stats={stats}
              onSelectProductForInward={handleSelectProductForInward}
              onNavigateToTab={setCurrentTab}
            />
          )}
        </div>
      </main>

      {/* Operation Modals */}
      <OrderIntakeModal
        isOpen={isOrderIntakeOpen}
        onClose={() => setIsOrderIntakeOpen(false)}
        onOrderCreated={handleOrderCreated}
      />

      <InwardReceiptModal
        isOpen={isInwardReceiptOpen}
        onClose={() => setIsInwardReceiptOpen(false)}
        preSelectedProductId={preSelectedProductId}
        preSelectedLocationCode={preSelectedLocationCode}
        onSuccess={(msg) => {
          showBanner(msg);
          fetchGlobalStats();
        }}
      />

      <TransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        preSelectedProductId={preSelectedProductId}
        preSelectedLocationCode={preSelectedLocationCode}
        onSuccess={(msg) => {
          showBanner(msg);
          fetchGlobalStats();
        }}
      />
    </div>
  );
}

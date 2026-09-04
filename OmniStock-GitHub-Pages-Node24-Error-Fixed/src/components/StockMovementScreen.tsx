import React, { useState, useEffect } from 'react';
import { StockMovement } from '../types';

interface StockMovementScreenProps {
  onOpenInwardReceipt: () => void;
  onOpenTransfer: () => void;
}

export const StockMovementScreen: React.FC<StockMovementScreenProps> = ({
  onOpenInwardReceipt,
  onOpenTransfer
}) => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const url = selectedType === 'ALL' ? '/api/movements' : `/api/movements?type=${selectedType}`;
      const res = await fetch(url);
      const data = await res.json();
      setMovements(data.movements || []);
    } catch (err) {
      console.error('Failed to load movements', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [selectedType]);

  const movementTypes = [
    { key: 'ALL', label: 'All Movements' },
    { key: 'INWARD_RECEIPT', label: 'Inward Receipts' },
    { key: 'OUTWARD_PICK', label: 'Outward Picks' },
    { key: 'LOCATION_TRANSFER', label: 'Bin Transfers' }
  ];

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'INWARD_RECEIPT':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'OUTWARD_PICK':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'LOCATION_TRANSFER':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'ORDER_INTAKE':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-zinc-100 text-zinc-700 border-zinc-200';
    }
  };

  return (
    <div id="stock-movement-screen" className="space-y-6">
      {/* Header & Actions */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-zinc-900">history_toggle_off</span>
            <h2 className="text-base font-bold text-zinc-900 tracking-tight">
              Stock Movement Audit Trail
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-900 text-white">
              Immutable Log
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1 max-w-2xl">
            Complete transaction history for inward dock receipts, outbound order picks, and internal bin-to-bin relocations with timestamps and operator traceability.
          </p>
        </div>

        {/* Operational Movement Triggers */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenInwardReceipt}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 text-xs font-semibold shadow-2xs transition-colors"
          >
            <span className="material-symbols-outlined text-sm text-emerald-600">add_box</span>
            <span>+ Inward Receipt</span>
          </button>

          <button
            type="button"
            onClick={onOpenTransfer}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-semibold shadow-xs transition-colors"
          >
            <span className="material-symbols-outlined text-sm text-purple-300">sync_alt</span>
            <span>+ Bin Transfer</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs (NO SEARCH BAR) */}
      <div className="flex items-center justify-between">
        <div className="inline-flex p-1 rounded-xl bg-zinc-100 border border-zinc-200 text-xs">
          {movementTypes.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setSelectedType(t.key)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                selectedType === t.key
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={fetchMovements}
          className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-600 hover:text-zinc-900"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          <span>Refresh Log</span>
        </button>
      </div>

      {/* Movements Audit Table */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-400">Loading stock movement logs...</div>
        ) : movements.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-500">No movement records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 text-[11px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-200">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">SKU / Item</th>
                  <th className="py-3 px-4">From Location</th>
                  <th className="py-3 px-4">To Location</th>
                  <th className="py-3 px-4 text-right">Quantity</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Operator</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                      {m.timestamp}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${getTypeBadge(m.movement_type)}`}>
                        {m.movement_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-zinc-900">{m.sku}</div>
                      <div className="text-[11px] text-zinc-600 truncate max-w-[180px]">{m.product_name}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-700">
                      <span className="bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200 text-[11px]">
                        {m.from_location}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-900">
                      <span className="bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200 text-[11px] font-bold">
                        {m.to_location}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-zinc-900">
                      {m.quantity} units
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] font-semibold text-zinc-700">
                      {m.reference_id}
                    </td>
                    <td className="py-3 px-4 text-zinc-600">
                      {m.performed_by}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-zinc-500 max-w-[200px] truncate" title={m.notes}>
                      {m.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

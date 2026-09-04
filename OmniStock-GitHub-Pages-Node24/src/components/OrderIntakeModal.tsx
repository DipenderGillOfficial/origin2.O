import React, { useState } from 'react';

interface OrderIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: (orderData: any) => void;
}

export const OrderIntakeModal: React.FC<OrderIntakeModalProps> = ({
  isOpen,
  onClose,
  onOrderCreated
}) => {
  const [customerName, setCustomerName] = useState('Apex Dynamics Robotics');
  const [destinationChannel, setDestinationChannel] = useState('Express Freight Dock Bay 3');
  const [priority, setPriority] = useState<'URGENT' | 'HIGH' | 'STANDARD'>('URGENT');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await fetch('/api/orders/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName,
          destination_channel: destinationChannel,
          priority
        })
      });
      const data = await res.json();
      if (res.ok) {
        onOrderCreated(data.order);
        onClose();
      }
    } catch (err) {
      console.error('Order intake failed', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl border border-zinc-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-5 bg-zinc-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">add_shopping_cart</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-none">Order Intake & Location Resolver</h3>
              <p className="text-[11px] text-zinc-400 mt-1">Instantly maps ordered SKUs to physical Row & Bin coordinates</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
              Customer Account
            </label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
              Destination / Carrier Channel
            </label>
            <select
              value={destinationChannel}
              onChange={(e) => setDestinationChannel(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white"
            >
              <option value="Express Freight Dock Bay 3">Express Freight Dock Bay 3</option>
              <option value="Next-Flight-Out Air Courier (Gate 2)">Next-Flight-Out Air Courier (Gate 2)</option>
              <option value="Regional Pallet Linehaul A">Regional Pallet Linehaul A</option>
              <option value="Standard Ground Door 1">Standard Ground Door 1</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
              Order Priority
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['URGENT', 'HIGH', 'STANDARD'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                    priority === p
                      ? p === 'URGENT'
                        ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-2xs'
                        : p === 'HIGH'
                        ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-2xs'
                        : 'bg-zinc-900 border-zinc-900 text-white shadow-2xs'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-600 space-y-1">
            <div className="font-semibold text-zinc-800 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-emerald-600">bolt</span>
              <span>Instant Routing Engine</span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Upon ingestion, the system scans live inventory balances, queries product-to-bin mappings, and automatically computes the shortest picking path across Rows 1–4.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm text-emerald-400">check</span>
              <span>{isSubmitting ? 'Resolving Route...' : 'Ingest Order & Resolve Bins'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

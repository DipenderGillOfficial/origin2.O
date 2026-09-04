import React, { useState, useEffect } from 'react';
import { WarehouseProduct, WarehouseLocation } from '../types';

interface InwardReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedProductId?: number | null;
  preSelectedLocationCode?: string | null;
  onSuccess: (message: string) => void;
}

export const InwardReceiptModal: React.FC<InwardReceiptModalProps> = ({
  isOpen,
  onClose,
  preSelectedProductId,
  preSelectedLocationCode,
  onSuccess
}) => {
  const [products, setProducts] = useState<WarehouseProduct[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [productId, setProductId] = useState<number | ''>('');
  const [locationCode, setLocationCode] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(50);
  const [referenceId, setReferenceId] = useState<string>('');
  const [operator, setOperator] = useState<string>('Staff Lead Marcus T.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Load products and locations
      fetch('/api/products?limit=100')
        .then((res) => res.json())
        .then((data) => {
          setProducts(data.products || []);
          if (preSelectedProductId) {
            setProductId(preSelectedProductId);
          } else if (data.products && data.products.length > 0) {
            setProductId(data.products[0].id);
          }
        });

      fetch('/api/locations')
        .then((res) => res.json())
        .then((data) => {
          setLocations(data.locations || []);
          if (preSelectedLocationCode) {
            setLocationCode(preSelectedLocationCode);
          } else if (data.locations && data.locations.length > 0) {
            setLocationCode(data.locations[0].location_code);
          }
        });

      setReferenceId(`PO-REC-${Math.floor(10000 + Math.random() * 90000)}`);
    }
  }, [isOpen, preSelectedProductId, preSelectedLocationCode]);

  // When selected product changes, auto-set location to product's current location
  const handleProductChange = (id: number) => {
    setProductId(id);
    const prod = products.find((p) => p.id === id);
    if (prod) {
      setLocationCode(prod.location_code);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !locationCode || quantity <= 0) return;

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/stock/inward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          location_code: locationCode,
          quantity,
          reference_id: referenceId,
          operator
        })
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess(data.message);
        onClose();
      } else {
        alert(data.error || 'Failed to receive stock');
      }
    } catch (err) {
      console.error('Inward receipt error', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === Number(productId));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl border border-zinc-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-5 bg-zinc-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">add_box</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-none">Inward Goods Receipt</h3>
              <p className="text-[11px] text-zinc-400 mt-1">Receive new shipment directly into assigned Row & Bin</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-zinc-700 uppercase tracking-wider mb-1">
              Select Product SKU
            </label>
            <select
              value={productId}
              onChange={(e) => handleProductChange(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-mono font-medium text-zinc-900 bg-white"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name.slice(0, 30)}... (Stock: {p.current_total_stock})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-zinc-700 uppercase tracking-wider mb-1">
              Destination Location (Row & Bin)
            </label>
            <select
              value={locationCode}
              onChange={(e) => setLocationCode(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-mono font-medium text-zinc-900 bg-white"
            >
              {locations.map((l) => (
                <option key={l.location_code} value={l.location_code}>
                  {l.location_code} (Row {l.row_number} - {l.bin_code}, Zone: {l.zone_name})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-zinc-700 uppercase tracking-wider mb-1">
                Receipt Quantity
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-mono font-bold text-zinc-900"
              />
            </div>
            <div>
              <label className="block font-bold text-zinc-700 uppercase tracking-wider mb-1">
                PO / Doc Ref
              </label>
              <input
                type="text"
                required
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-mono text-zinc-900"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-zinc-700 uppercase tracking-wider mb-1">
              Receiving Operator
            </label>
            <input
              type="text"
              required
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-zinc-900"
            />
          </div>

          {selectedProduct && (
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-[11px] text-zinc-600">
              New Total Stock after Receipt: <strong>{selectedProduct.current_total_stock + quantity} units</strong> (Safety Buffer: {selectedProduct.min_safety_stock})
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-zinc-200 font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-zinc-900 text-white font-bold hover:bg-zinc-800 disabled:opacity-50 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm text-emerald-400">check</span>
              <span>{isSubmitting ? 'Receiving...' : 'Record Inward Receipt'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

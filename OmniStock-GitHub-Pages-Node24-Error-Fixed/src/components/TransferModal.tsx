import React, { useState, useEffect } from 'react';
import { WarehouseProduct, WarehouseLocation } from '../types';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedProductId?: number | null;
  preSelectedLocationCode?: string | null;
  onSuccess: (message: string) => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  preSelectedProductId,
  preSelectedLocationCode,
  onSuccess
}) => {
  const [products, setProducts] = useState<WarehouseProduct[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [productId, setProductId] = useState<number | ''>('');
  const [fromLocation, setFromLocation] = useState<string>('');
  const [toLocation, setToLocation] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(10);
  const [operator, setOperator] = useState<string>('Forklift Operator David K.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
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
            setFromLocation(preSelectedLocationCode);
          } else if (data.locations && data.locations.length > 0) {
            setFromLocation(data.locations[0].location_code);
          }
          if (data.locations && data.locations.length > 1) {
            setToLocation(data.locations[1].location_code);
          }
        });
    }
  }, [isOpen, preSelectedProductId, preSelectedLocationCode]);

  // When selected product changes, set origin to its location
  const handleProductChange = (id: number) => {
    setProductId(id);
    const prod = products.find((p) => p.id === id);
    if (prod) {
      setFromLocation(prod.location_code);
      if (toLocation === prod.location_code && locations.length > 1) {
        const alt = locations.find((l) => l.location_code !== prod.location_code);
        if (alt) setToLocation(alt.location_code);
      }
    }
  };

  if (!isOpen) return null;

  const selectedProduct = products.find((p) => p.id === Number(productId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!productId || !fromLocation || !toLocation || quantity <= 0) return;
    if (fromLocation === toLocation) {
      setErrorMessage('Source and destination bins must be different.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/stock/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          from_location: fromLocation,
          to_location: toLocation,
          quantity,
          operator
        })
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess(data.message);
        onClose();
      } else {
        setErrorMessage(data.error || 'Transfer failed');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Transfer failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl border border-zinc-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-5 bg-zinc-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">sync_alt</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-none">Internal Bin Transfer</h3>
              <p className="text-[11px] text-zinc-400 mt-1">Move inventory units between physical warehouse bins</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-zinc-700 uppercase tracking-wider mb-1">
              Select SKU to Relocate
            </label>
            <select
              value={productId}
              onChange={(e) => handleProductChange(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-mono font-medium text-zinc-900 bg-white"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name.slice(0, 28)}... (Stock: {p.current_total_stock})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-zinc-700 uppercase tracking-wider mb-1">
                From Location (Origin)
              </label>
              <select
                value={fromLocation}
                onChange={(e) => setFromLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-mono text-zinc-900 bg-white"
              >
                {locations.map((l) => (
                  <option key={`from-${l.location_code}`} value={l.location_code}>
                    {l.location_code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-zinc-700 uppercase tracking-wider mb-1">
                To Location (Target)
              </label>
              <select
                value={toLocation}
                onChange={(e) => setToLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-mono text-zinc-900 bg-white"
              >
                {locations.map((l) => (
                  <option key={`to-${l.location_code}`} value={l.location_code}>
                    {l.location_code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-zinc-700 uppercase tracking-wider mb-1">
              Transfer Quantity
            </label>
            <input
              type="number"
              min="1"
              max={selectedProduct?.current_total_stock || 1000}
              required
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-mono font-bold text-zinc-900"
            />
            {selectedProduct && (
              <span className="text-[10px] text-zinc-400 mt-1 block">
                Total item stock: {selectedProduct.current_total_stock} units
              </span>
            )}
          </div>

          <div>
            <label className="block font-bold text-zinc-700 uppercase tracking-wider mb-1">
              Operator
            </label>
            <input
              type="text"
              required
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-zinc-900"
            />
          </div>

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
              <span className="material-symbols-outlined text-sm text-purple-400">check</span>
              <span>{isSubmitting ? 'Relocating...' : 'Execute Bin Transfer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

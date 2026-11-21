import { AlertTriangle, Check, History, Package } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatBdt, getEffectivePrice, Product } from '../data/catalog';
import { LOW_STOCK_THRESHOLD, StockHistoryEntry } from '../utils/orders';
import { ImageWithFallback } from './ImageWithFallback';

interface AdminInventoryTabProps {
  products: Product[];
  stockHistory: StockHistoryEntry[];
  onUpdateProductStock: (
    productId: string,
    stockQuantity: number | null,
    note?: string,
  ) => Promise<void>;
}

type InventoryFilter = 'all' | 'low' | 'out' | 'tracked';

export function AdminInventoryTab({
  products,
  stockHistory,
  onUpdateProductStock,
}: AdminInventoryTabProps) {
  const [filter, setFilter] = useState<InventoryFilter>('all');
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const [savingProdId, setSavingProdId] = useState<string | null>(null);
  const [savedProdId, setSavedProdId] = useState<string | null>(null);

  const lowStockCount = useMemo(
    () =>
      products.filter(
        (p) =>
          typeof p.stockQuantity === 'number' &&
          p.stockQuantity > 0 &&
          p.stockQuantity <= LOW_STOCK_THRESHOLD,
      ).length,
    [products],
  );

  const outOfStockCount = useMemo(
    () =>
      products.filter(
        (p) => typeof p.stockQuantity === 'number' && p.stockQuantity <= 0,
      ).length,
    [products],
  );

  const filteredProducts = useMemo(() => {
    if (filter === 'low') {
      return products.filter(
        (p) =>
          typeof p.stockQuantity === 'number' &&
          p.stockQuantity > 0 &&
          p.stockQuantity <= LOW_STOCK_THRESHOLD,
      );
    }
    if (filter === 'out') {
      return products.filter(
        (p) => typeof p.stockQuantity === 'number' && p.stockQuantity <= 0,
      );
    }
    if (filter === 'tracked') {
      return products.filter((p) => typeof p.stockQuantity === 'number');
    }
    return products;
  }, [products, filter]);

  const handleSaveStock = async (product: Product, clearToUnlimited = false) => {
    setSavingProdId(product.id);
    try {
      let nextVal: number | null = null;
      if (!clearToUnlimited) {
        const raw =
          stockDrafts[product.id] ??
          (product.stockQuantity !== null ? String(product.stockQuantity) : '0');
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed < 0) return;
        nextVal = Math.floor(parsed);
      }
      await onUpdateProductStock(
        product.id,
        nextVal,
        clearToUnlimited
          ? 'Switched to untracked stock'
          : 'Adjusted in Inventory Management',
      );
      setSavedProdId(product.id);
      window.setTimeout(() => setSavedProdId(null), 2000);
    } finally {
      setSavingProdId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Low & Out-of-Stock Warnings */}
      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-[#9B2C2C]/30 bg-[#FFF5F5] p-4 text-xs">
          <div className="flex items-center gap-2.5 text-[#9B2C2C]">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <strong>Inventory Alert:</strong>{' '}
              {outOfStockCount > 0 && (
                <span>{outOfStockCount} product(s) out of stock</span>
              )}
              {outOfStockCount > 0 && lowStockCount > 0 && ' · '}
              {lowStockCount > 0 && (
                <span>
                  {lowStockCount} product(s) low on stock (≤ {LOW_STOCK_THRESHOLD}
                  )
                </span>
              )}
            </span>
          </div>
          <div className="flex gap-2">
            {outOfStockCount > 0 && (
              <button
                type="button"
                onClick={() => setFilter('out')}
                className="border border-[#9B2C2C] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#9B2C2C]"
              >
                View Out of Stock
              </button>
            )}
            {lowStockCount > 0 && (
              <button
                type="button"
                onClick={() => setFilter('low')}
                className="border border-[#B89352] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#8E6D35]"
              >
                View Low Stock
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stock Management Grid */}
      <div className="border border-[#E3DBD0] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFE9DF] pb-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-[#8E6D35]" aria-hidden="true" />
            <h3 className="font-display text-xl font-semibold text-[#141414]">
              Product Stock Levels
            </h3>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['all', `All (${products.length})`],
                ['low', `Low Stock (${lowStockCount})`],
                ['out', `Out of Stock (${outOfStockCount})`],
                [
                  'tracked',
                  `Tracked (${products.filter((p) => p.stockQuantity !== null).length})`,
                ],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`min-h-[34px] border px-3 text-xs font-medium ${
                  filter === key
                    ? 'border-[#141414] bg-[#141414] text-[#FAF8F4]'
                    : 'border-[#E3DBD0] bg-[#FAF8F4] text-[#5C574F] hover:border-[#141414]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#5C574F]">
            No products match this inventory filter.
          </p>
        ) : (
          <ul className="divide-y divide-[#EFE9DF]">
            {filteredProducts.map((product) => {
              const isOut =
                typeof product.stockQuantity === 'number' &&
                product.stockQuantity <= 0;
              const isLow =
                typeof product.stockQuantity === 'number' &&
                product.stockQuantity > 0 &&
                product.stockQuantity <= LOW_STOCK_THRESHOLD;
              const draftVal =
                stockDrafts[product.id] ??
                (product.stockQuantity !== null
                  ? String(product.stockQuantity)
                  : '');

              return (
                <li
                  key={product.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3.5 sm:gap-4"
                >
                  <div className="flex min-w-0 w-full items-center gap-3 sm:w-auto sm:flex-1">
                    <div className="h-14 w-12 shrink-0 overflow-hidden border border-[#E3DBD0] bg-[#EFE9DF]">
                      <ImageWithFallback
                        src={product.images[0] ?? ''}
                        alt={product.name}
                        label={product.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#141414]">
                        {product.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="tabular-nums text-[#5C574F]">
                          {formatBdt(getEffectivePrice(product))}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            isOut
                              ? 'bg-[#FFF5F5] text-[#9B2C2C]'
                              : isLow
                                ? 'bg-[#FEF9EC] text-[#8E6D35]'
                                : 'bg-[#F0FDF4] text-[#15803D]'
                          }`}
                        >
                          {product.stockQuantity === null
                            ? 'Untracked (In Stock)'
                            : isOut
                              ? 'Out of Stock (0)'
                              : isLow
                                ? `Low Stock: ${product.stockQuantity}`
                                : `${product.stockQuantity} Available`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      aria-label={`Stock quantity for ${product.name}`}
                      value={draftVal}
                      placeholder="Set qty"
                      onChange={(e) =>
                        setStockDrafts((prev) => ({
                          ...prev,
                          [product.id]: e.target.value,
                        }))
                      }
                      className="min-h-[36px] w-24 border border-[#E3DBD0] bg-[#FAF8F4] px-2.5 text-xs tabular-nums text-[#141414] focus:border-[#141414] focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={savingProdId === product.id}
                      onClick={() => void handleSaveStock(product, false)}
                      className="inline-flex min-h-[36px] items-center gap-1 bg-[#141414] px-3 text-xs font-medium text-[#FAF8F4] hover:bg-[#2A2825] disabled:opacity-50"
                    >
                      {savedProdId === product.id ? (
                        <>
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Saved</span>
                        </>
                      ) : (
                        <span>Update Stock</span>
                      )}
                    </button>
                    {product.stockQuantity !== null && (
                      <button
                        type="button"
                        disabled={savingProdId === product.id}
                        onClick={() => void handleSaveStock(product, true)}
                        className="min-h-[36px] border border-[#E3DBD0] px-2.5 text-[11px] text-[#5C574F] hover:border-[#141414] hover:text-[#141414]"
                      >
                        Untrack
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Stock History Ledger */}
      <div className="border border-[#E3DBD0] bg-white p-4 sm:p-5">
        <div className="flex items-center gap-2 border-b border-[#EFE9DF] pb-3">
          <History className="h-4 w-4 text-[#8E6D35]" aria-hidden="true" />
          <h3 className="font-display text-xl font-semibold text-[#141414]">
            Stock History Ledger ({stockHistory.length})
          </h3>
        </div>

        {stockHistory.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#5C574F]">
            No stock changes recorded yet. Order deductions, cancellation
            restorations, and manual stock edits appear here automatically.
          </p>
        ) : (
          <>
            {/* Mobile Stock Ledger Cards */}
            <ul className="mt-3 divide-y divide-[#EFE9DF] sm:hidden">
              {stockHistory.slice(0, 50).map((entry) => (
                <li key={entry.id} className="space-y-1.5 py-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 break-words font-semibold text-[#141414]">
                      {entry.productName}
                    </p>
                    <span
                      className={`shrink-0 font-bold tabular-nums ${
                        entry.delta < 0 ? 'text-[#9B2C2C]' : 'text-[#15803D]'
                      }`}
                    >
                      {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        entry.type === 'order_deduct'
                          ? 'bg-[#FFF5F5] text-[#9B2C2C]'
                          : entry.type === 'order_restore'
                            ? 'bg-[#F0FDF4] text-[#15803D]'
                            : 'bg-[#FEF9EC] text-[#8E6D35]'
                      }`}
                    >
                      {entry.type === 'order_deduct'
                        ? 'Order Deducted'
                        : entry.type === 'order_restore'
                          ? 'Cancelled Restored'
                          : 'Manual Edit'}
                    </span>
                    <span className="tabular-nums text-[#5C574F]">
                      {entry.previousStock ?? '∞'} → {entry.newStock ?? '∞'}
                    </span>
                  </div>
                  <p className="break-words text-[11px] text-[#5C574F]">
                    {entry.orderId && (
                      <span className="mr-1.5 font-mono font-semibold text-[#141414]">
                        {entry.orderId}
                      </span>
                    )}
                    {entry.note}
                  </p>
                  <p className="text-[10px] text-[#7A746B]">
                    {new Date(entry.timestamp).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>

            {/* Tablet & Desktop Table */}
            <div className="mt-3 hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E3DBD0] text-[11px] uppercase tracking-wider text-[#5C574F]">
                    <th className="py-2.5 pr-3">Date &amp; Time</th>
                    <th className="px-3 py-2.5">Product</th>
                    <th className="px-3 py-2.5">Event</th>
                    <th className="px-3 py-2.5 text-right">Change</th>
                    <th className="px-3 py-2.5 text-right">Stock</th>
                    <th className="py-2.5 pl-3">Note / Order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE9DF]">
                  {stockHistory.slice(0, 50).map((entry) => (
                    <tr key={entry.id}>
                      <td className="py-2.5 pr-3 whitespace-nowrap text-[#5C574F]">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-[#141414]">
                        {entry.productName}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            entry.type === 'order_deduct'
                              ? 'bg-[#FFF5F5] text-[#9B2C2C]'
                              : entry.type === 'order_restore'
                                ? 'bg-[#F0FDF4] text-[#15803D]'
                                : 'bg-[#FEF9EC] text-[#8E6D35]'
                          }`}
                        >
                          {entry.type === 'order_deduct'
                            ? 'Order Deducted'
                            : entry.type === 'order_restore'
                              ? 'Cancelled Restored'
                              : 'Manual Edit'}
                        </span>
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-semibold tabular-nums ${
                          entry.delta < 0 ? 'text-[#9B2C2C]' : 'text-[#15803D]'
                        }`}
                      >
                        {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#5C574F]">
                        {entry.previousStock ?? '∞'} → {entry.newStock ?? '∞'}
                      </td>
                      <td className="py-2.5 pl-3 text-[#5C574F]">
                        {entry.orderId && (
                          <span className="mr-1.5 font-mono font-semibold text-[#141414]">
                            {entry.orderId}
                          </span>
                        )}
                        {entry.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

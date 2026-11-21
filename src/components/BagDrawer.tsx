import {
  CheckCircle2,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  FLAT_DELIVERY_CHARGE_BDT,
  formatBdt,
  getEffectivePrice,
  Product,
} from '../data/catalog';
import { StoredOrder } from '../utils/orders';
import { CustomerOrderForm } from './CustomerOrderForm';
import { ImageWithFallback } from './ImageWithFallback';

export interface BagItem {
  product: Product;
  size: string;
  color: string;
  quantity: number;
}

interface BagDrawerProps {
  isOpen: boolean;
  items: BagItem[];
  deliveryChargeBdt?: number;
  onClose: () => void;
  onUpdateQuantity: (
    productId: string,
    size: string,
    color: string,
    delta: number,
  ) => void;
  onRemoveItem: (productId: string, size: string, color: string) => void;
  onOrderPlaced?: (order: StoredOrder) => void;
}

export function BagDrawer({
  isOpen,
  items,
  deliveryChargeBdt = FLAT_DELIVERY_CHARGE_BDT,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onOrderPlaced,
}: BagDrawerProps) {
  const [completedOrder, setCompletedOrder] = useState<StoredOrder | null>(
    null,
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCompletedOrder(null);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalCount = items.reduce((acc, item) => acc + item.quantity, 0);

  const handleCloseDrawer = () => {
    setCompletedOrder(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/45"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping Bag & Checkout"
      onClick={handleCloseDrawer}
    >
      <aside
        className="flex h-full w-full max-w-lg flex-col bg-[#FAF8F4] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#E3DBD0] bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2">
            <ShoppingBag className="h-4 w-4 shrink-0 text-[#141414]" aria-hidden="true" />
            <h2 className="font-display truncate text-lg font-semibold text-[#141414] sm:text-xl">
              Shopping Bag &amp; Checkout
            </h2>
            {!completedOrder && (
              <span className="shrink-0 text-xs tabular-nums text-[#5C574F]">
                ({totalCount})
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleCloseDrawer}
            aria-label="Close order drawer"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-[#E3DBD0] text-[#141414] transition-colors hover:border-[#141414] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {completedOrder ? (
            <div className="space-y-5 border border-[#E3DBD0] bg-white p-4 sm:p-6">
              <div className="inline-flex items-center gap-2 border border-[#15803D]/25 bg-[#F0FDF4] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#15803D]">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>Order Confirmed</span>
              </div>

              <div>
                <h3 className="font-display text-2xl font-semibold text-[#141414]">
                  YOUR ORDER HAS BEEN PLACED!
                </h3>
                <p className="mt-1.5 text-xs text-[#5C574F]">
                  Thank you for shopping with STYLEON.
                </p>
              </div>

              <div className="space-y-2 border border-[#E3DBD0] bg-[#FAF8F4] p-3.5 text-xs sm:p-4">
                <div className="flex justify-between gap-2">
                  <span className="shrink-0 text-[#5C574F]">Order ID:</span>
                  <span className="min-w-0 break-all text-right font-mono font-semibold text-[#141414]">
                    {completedOrder.id}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="shrink-0 text-[#5C574F]">Customer:</span>
                  <span className="min-w-0 break-words text-right font-medium text-[#141414]">
                    {completedOrder.customerName} ({completedOrder.mobileNumber})
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="shrink-0 text-[#5C574F]">Delivery Address:</span>
                  <span className="min-w-0 break-words text-right text-[#141414]">
                    {completedOrder.fullAddress}, {completedOrder.upazila},{' '}
                    {completedOrder.district}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="shrink-0 text-[#5C574F]">Payment Method:</span>
                  <span className="text-right font-medium text-[#141414]">
                    Cash on Delivery
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="shrink-0 text-[#5C574F]">Order Status:</span>
                  <span className="text-right font-semibold text-[#8E6D35]">
                    {completedOrder.status}
                  </span>
                </div>
              </div>

              <ul className="divide-y divide-[#EFE9DF] border border-[#E3DBD0] px-4 text-xs">
                {completedOrder.items.map((item, idx) => (
                  <li
                    key={`${item.productId}-${idx}`}
                    className="flex items-center justify-between gap-2 py-2.5"
                  >
                    <div>
                      <p className="font-semibold text-[#141414]">
                        {item.productName}
                      </p>
                      <p className="text-[#5C574F]">
                        Size: {item.size} · Color: {item.color} · Qty:{' '}
                        {item.quantity}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums text-[#141414]">
                      {formatBdt(item.unitPriceBdt * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="space-y-1.5 border-t border-[#E3DBD0] pt-3 text-xs">
                <div className="flex justify-between text-[#5C574F]">
                  <span>Delivery Charge</span>
                  <span className="tabular-nums text-[#141414]">
                    {formatBdt(completedOrder.deliveryCharge)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-[#141414]">
                  <span>Total Amount</span>
                  <span className="tabular-nums">
                    {formatBdt(completedOrder.grandTotal)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseDrawer}
                className="min-h-[46px] w-full bg-[#141414] px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#FAF8F4] transition-colors hover:bg-[#2A2825]"
              >
                CONTINUE SHOPPING
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-12 text-center">
              <ShoppingBag
                className="h-8 w-8 text-[#B89352]"
                strokeWidth={1.25}
                aria-hidden="true"
              />
              <h3 className="font-display mt-4 text-2xl font-medium text-[#141414]">
                No items selected
              </h3>
              <p className="mt-2 max-w-xs text-sm text-[#5C574F]">
                Select any product from Shop and click Order Now or Add to Bag
                to place your order directly on our website.
              </p>
              <button
                type="button"
                onClick={handleCloseDrawer}
                className="mt-6 min-h-[44px] border border-[#141414] px-6 py-2.5 text-xs font-medium tracking-wide text-[#141414] transition-colors hover:bg-[#141414] hover:text-[#FAF8F4]"
              >
                CONTINUE SHOPPING
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <ul className="divide-y divide-[#E3DBD0] border border-[#E3DBD0] bg-white px-4">
                {items.map((item) => {
                  const unitPrice = getEffectivePrice(item.product);
                  const maxStock =
                    typeof item.product.stockQuantity === 'number'
                      ? Math.max(1, item.product.stockQuantity)
                      : 50;
                  return (
                    <li
                      key={`${item.product.id}-${item.size}-${item.color}`}
                      className="flex gap-4 py-4"
                    >
                      <div className="h-20 w-16 shrink-0 overflow-hidden bg-[#EFE9DF]">
                        <ImageWithFallback
                          src={item.product.images[0] ?? ''}
                          alt={item.product.name}
                          label={item.product.name}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col justify-between">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="break-words text-sm font-semibold text-[#141414]">
                              {item.product.name}
                            </h3>
                            <p className="mt-0.5 break-words text-xs text-[#5C574F]">
                              Size: {item.size} · Color: {item.color}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              onRemoveItem(
                                item.product.id,
                                item.size,
                                item.color,
                              )
                            }
                            aria-label={`Remove ${item.product.name}`}
                            className="inline-flex h-8 w-8 items-center justify-center text-[#5C574F] transition-colors hover:text-[#141414]"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>

                        <div className="mt-2.5 flex items-center justify-between">
                          <div className="inline-flex items-center border border-[#E3DBD0] bg-[#FAF8F4]">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateQuantity(
                                  item.product.id,
                                  item.size,
                                  item.color,
                                  -1,
                                )
                              }
                              aria-label="Decrease quantity"
                              className="inline-flex h-8 w-8 items-center justify-center text-[#141414] hover:bg-[#EFE9DF]"
                            >
                              <Minus className="h-3 w-3" aria-hidden="true" />
                            </button>
                            <span className="min-w-[28px] text-center text-xs font-medium tabular-nums text-[#141414]">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              disabled={item.quantity >= maxStock}
                              onClick={() =>
                                onUpdateQuantity(
                                  item.product.id,
                                  item.size,
                                  item.color,
                                  1,
                                )
                              }
                              aria-label="Increase quantity"
                              className="inline-flex h-8 w-8 items-center justify-center text-[#141414] hover:bg-[#EFE9DF] disabled:opacity-40"
                            >
                              <Plus className="h-3 w-3" aria-hidden="true" />
                            </button>
                          </div>

                          <span className="text-xs font-semibold tabular-nums text-[#141414]">
                            {formatBdt(unitPrice * item.quantity)}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="border border-[#E3DBD0] bg-white p-4 sm:p-5">
                <CustomerOrderForm
                  deliveryChargeBdt={deliveryChargeBdt}
                  items={items.map((item) => ({
                    productId: item.product.id,
                    productName: item.product.name,
                    productImage: item.product.images[0] ?? '',
                    size: item.size,
                    color: item.color,
                    quantity: item.quantity,
                    regularPriceBdt: item.product.priceBdt,
                    unitPriceBdt: getEffectivePrice(item.product),
                  }))}
                  onOrderPlaced={(order) => {
                    setCompletedOrder(order);
                    onOrderPlaced?.(order);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

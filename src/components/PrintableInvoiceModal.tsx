import { Printer, X } from 'lucide-react';
import { useEffect } from 'react';
import { formatBdt, STORE_CONFIG } from '../data/catalog';
import { StoredOrder } from '../utils/orders';
import { ImageWithFallback } from './ImageWithFallback';

interface PrintableInvoiceModalProps {
  order: StoredOrder | null;
  onClose: () => void;
}

export function PrintableInvoiceModal({
  order,
  onClose,
}: PrintableInvoiceModalProps) {
  useEffect(() => {
    if (!order) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [order, onClose]);

  if (!order) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Printable Invoice for ${order.id}`}
      onClick={onClose}
    >
      <div
        className="flex h-[100dvh] w-full max-w-3xl flex-col border-[#D8CFC2] bg-[#FAF8F4] shadow-2xl sm:h-auto sm:max-h-[94vh] sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar (Hidden in Print) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-[#E3DBD0] bg-white px-4 py-3 sm:gap-3 sm:px-5 sm:py-3.5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8E6D35]">
              A4 Customer Invoice Preview
            </p>
            <h3 className="font-display truncate text-lg font-semibold text-[#141414] sm:text-xl">
              Invoice {order.id}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-[38px] items-center gap-2 bg-[#141414] px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#FAF8F4] transition-colors hover:bg-[#2A2825] sm:min-h-[40px] sm:px-5"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              <span>Print Invoice (A4)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close invoice preview"
              className="inline-flex h-[38px] w-[38px] items-center justify-center border border-[#E3DBD0] bg-white text-[#141414] hover:border-[#141414] sm:h-10 sm:w-10"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Printable A4 Sheet */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-7">
          <article
            id="styleon-printable-invoice"
            className="mx-auto border border-[#E3DBD0] bg-white p-4 text-[#141414] sm:p-9"
          >
            {/* Invoice Brand Header */}
            <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-[#141414] pb-6">
              <div>
                <p className="font-display text-3xl font-semibold tracking-[0.22em] text-[#141414]">
                  STYLEON
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#8E6D35]">
                  Premium International Men&apos;s Fashion
                </p>
                <p className="mt-2 text-xs text-[#5C574F]">
                  Hotline / WhatsApp: {STORE_CONFIG.whatsappDisplay}
                </p>
                <p className="text-xs text-[#5C574F]">
                  Email: {STORE_CONFIG.email}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5C574F]">
                  Cash on Delivery Invoice
                </p>
                <p className="mt-1 font-mono text-xl font-bold text-[#141414]">
                  {order.id}
                </p>
                <p className="mt-1 text-xs text-[#5C574F]">
                  Order Date:{' '}
                  <strong className="text-[#141414]">
                    {new Date(order.createdAt).toLocaleString()}
                  </strong>
                </p>
                <p className="mt-0.5 text-xs text-[#5C574F]">
                  Order Status:{' '}
                  <strong className="uppercase text-[#141414]">
                    {order.status}
                  </strong>
                </p>
              </div>
            </div>

            {/* Customer & Payment Details */}
            <div className="mt-6 grid gap-6 border-b border-[#E3DBD0] pb-6 sm:grid-cols-2">
              <div className="space-y-1 text-xs">
                <p className="font-semibold uppercase tracking-[0.14em] text-[#8E6D35]">
                  Bill &amp; Ship To
                </p>
                <p className="pt-1 text-sm font-semibold text-[#141414]">
                  {order.customerName}
                </p>
                <p className="tabular-nums text-[#141414]">
                  Mobile: <strong>{order.mobileNumber}</strong>
                </p>
                <p className="leading-relaxed text-[#5C574F]">
                  {order.fullAddress}
                </p>
                <p className="text-[#141414]">
                  {order.upazila}, {order.district}
                </p>
                {order.nearbyLandmark && (
                  <p className="text-[#5C574F]">
                    Landmark: {order.nearbyLandmark}
                  </p>
                )}
                {order.deliveryInstructions && (
                  <p className="text-[#5C574F]">
                    Delivery Note: {order.deliveryInstructions}
                  </p>
                )}
              </div>

              <div className="space-y-1 text-xs sm:text-right">
                <p className="font-semibold uppercase tracking-[0.14em] text-[#8E6D35]">
                  Payment &amp; Shipping
                </p>
                <p className="pt-1 text-sm font-semibold text-[#141414]">
                  Payment Method: Cash on Delivery (COD)
                </p>
                <p className="text-[#5C574F]">
                  Nationwide Courier Delivery (Bangladesh)
                </p>
                <p className="text-[#5C574F]">
                  Delivery Charge: {formatBdt(order.deliveryCharge)}
                </p>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#141414] text-[11px] uppercase tracking-wider text-[#5C574F]">
                    <th className="py-2.5 pr-3">Product</th>
                    <th className="px-3 py-2.5">Variant</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5 text-right">Unit Price</th>
                    <th className="py-2.5 pl-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE9DF]">
                  {order.items.map((item, idx) => (
                    <tr key={`${item.productId}-${idx}`}>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          {item.productImage && (
                            <div className="h-12 w-10 shrink-0 overflow-hidden border border-[#E3DBD0] bg-[#EFE9DF]">
                              <ImageWithFallback
                                src={item.productImage}
                                alt={item.productName}
                                label={item.productName}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-[#141414]">
                              {item.productName}
                            </p>
                            <p className="text-[11px] text-[#7A746B]">
                              ID: {item.productId}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[#5C574F]">
                        Size: <strong className="text-[#141414]">{item.size}</strong>
                        <br />
                        Color: <strong className="text-[#141414]">{item.color}</strong>
                      </td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatBdt(item.unitPriceBdt)}
                      </td>
                      <td className="py-3 pl-3 text-right font-semibold tabular-nums">
                        {formatBdt(item.unitPriceBdt * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="mt-6 flex justify-end border-t border-[#E3DBD0] pt-5">
              <div className="w-full max-w-xs space-y-2 text-xs">
                <div className="flex justify-between text-[#5C574F]">
                  <span>Product Subtotal</span>
                  <span className="font-medium tabular-nums text-[#141414]">
                    {formatBdt(order.productSubtotal)}
                  </span>
                </div>
                {typeof order.discountAmount === 'number' &&
                  order.discountAmount > 0 && (
                    <div className="flex justify-between text-[#15803D]">
                      <span>Discount</span>
                      <span className="font-medium tabular-nums">
                        -{formatBdt(order.discountAmount)}
                      </span>
                    </div>
                  )}
                <div className="flex justify-between text-[#5C574F]">
                  <span>Delivery Charge</span>
                  <span className="font-medium tabular-nums text-[#141414]">
                    {formatBdt(order.deliveryCharge)}
                  </span>
                </div>
                <div className="flex justify-between border-t-2 border-[#141414] pt-2.5 text-sm font-bold text-[#141414]">
                  <span>Total Payable (COD)</span>
                  <span className="tabular-nums">
                    {formatBdt(order.grandTotal)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-[#EFE9DF] pt-4 text-center text-[11px] text-[#5C574F]">
              Thank you for shopping with STYLEON. Please inspect your parcel
              carefully upon delivery.
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

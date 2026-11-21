import { Eye, MapPin, Phone, Search, ShoppingBag, User, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatBdt } from '../data/catalog';
import {
  buildCustomerDirectory,
  CustomerRecord,
  ORDER_STATUS_BADGE_STYLES,
} from '../utils/adminAnalytics';
import { StoredOrder } from '../utils/orders';

interface AdminCustomersTabProps {
  orders: StoredOrder[];
  onInspectOrder: (orderId: string) => void;
}

export function AdminCustomersTab({
  orders,
  onInspectOrder,
}: AdminCustomersTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMobile, setSelectedMobile] = useState<string | null>(null);

  const customers = useMemo(() => buildCustomerDirectory(orders), [orders]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.customerName.toLowerCase().includes(q) ||
        c.mobileNumber.toLowerCase().includes(q) ||
        c.district.toLowerCase().includes(q) ||
        c.upazila.toLowerCase().includes(q),
    );
  }, [customers, searchQuery]);

  const selectedCustomer: CustomerRecord | null = useMemo(
    () => customers.find((c) => c.mobileNumber === selectedMobile) ?? null,
    [customers, selectedMobile],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border border-[#E3DBD0] bg-white p-4">
        <div>
          <h3 className="font-display text-xl font-semibold text-[#141414]">
            Customer Directory ({customers.length})
          </h3>
          <p className="text-xs text-[#5C574F]">
            Automatically deduplicated by normalized Bangladesh mobile numbers
            from verified customer orders.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#5C574F]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer name or phone..."
            aria-label="Search customers"
            className="min-h-[40px] w-full border border-[#E3DBD0] bg-[#FAF8F4] pr-3 pl-9 text-xs text-[#141414] placeholder:text-[#9A9389] focus:border-[#141414] focus:outline-none"
          />
        </div>
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="border border-[#E3DBD0] bg-white p-10 text-center text-sm text-[#5C574F]">
          No customer records found yet. Customers appear automatically when
          orders are placed.
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden overflow-x-auto border border-[#E3DBD0] bg-white md:block">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#E3DBD0] bg-[#FAF8F4] text-[11px] font-semibold uppercase tracking-wider text-[#5C574F]">
                  <th className="px-4 py-3">Customer Name</th>
                  <th className="px-4 py-3">Phone Number</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3 text-right">Total Orders</th>
                  <th className="px-4 py-3 text-right">Total Purchase</th>
                  <th className="px-4 py-3">Last Order Date</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE9DF]">
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.mobileNumber}
                    className="transition-colors hover:bg-[#FAF8F4]/70"
                  >
                    <td className="px-4 py-3.5 font-semibold text-[#141414]">
                      {customer.customerName}
                      {customer.totalOrders > 1 && (
                        <span className="ml-2 bg-[#FEF9EC] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#8E6D35]">
                          Repeat
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 tabular-nums font-medium text-[#141414]">
                      {customer.mobileNumber}
                    </td>
                    <td className="px-4 py-3.5 text-[#5C574F]">
                      {customer.upazila}, {customer.district}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-[#141414]">
                      {customer.totalOrders}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-[#141414]">
                      {formatBdt(customer.totalPurchaseAmount)}
                    </td>
                    <td className="px-4 py-3.5 text-[#5C574F]">
                      {new Date(customer.lastOrderDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedMobile(customer.mobileNumber)}
                        className="inline-flex min-h-[32px] items-center gap-1 border border-[#141414] bg-white px-3 text-[11px] font-medium text-[#141414] hover:bg-[#141414] hover:text-[#FAF8F4]"
                      >
                        <Eye className="h-3 w-3" aria-hidden="true" />
                        <span>View History</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <ul className="space-y-3 md:hidden">
            {filteredCustomers.map((customer) => (
              <li
                key={customer.mobileNumber}
                className="min-w-0 border border-[#E3DBD0] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold text-[#141414]">
                      {customer.customerName}
                    </p>
                    <p className="mt-0.5 text-xs tabular-nums text-[#5C574F]">
                      {customer.mobileNumber}
                    </p>
                    <p className="mt-0.5 break-words text-xs text-[#5C574F]">
                      {customer.upazila}, {customer.district}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs tabular-nums">
                    <p className="font-bold text-[#141414]">
                      {formatBdt(customer.totalPurchaseAmount)}
                    </p>
                    <p className="text-[#5C574F]">
                      {customer.totalOrders}{' '}
                      {customer.totalOrders === 1 ? 'order' : 'orders'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMobile(customer.mobileNumber)}
                  className="mt-3 inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 border border-[#141414] bg-[#FAF8F4] text-xs font-medium text-[#141414]"
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>View Customer &amp; Order History</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Customer Detail & Order History Modal */}
      {selectedCustomer && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-0 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Customer profile for ${selectedCustomer.customerName}`}
          onClick={() => setSelectedMobile(null)}
        >
          <div
            className="flex h-[100dvh] w-full max-w-3xl flex-col border-[#D8CFC2] bg-[#FAF8F4] shadow-2xl sm:h-auto sm:max-h-[90vh] sm:border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#E3DBD0] bg-white px-4 py-3.5 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8E6D35]">
                  Customer Profile
                </p>
                <h4 className="font-display truncate text-xl font-semibold text-[#141414] sm:text-2xl">
                  {selectedCustomer.customerName}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMobile(null)}
                aria-label="Close customer profile"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-[#E3DBD0] bg-white text-[#141414] hover:border-[#141414]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
              <div className="grid gap-4 border border-[#E3DBD0] bg-white p-4 sm:grid-cols-2 sm:p-5">
                <div className="min-w-0 space-y-2 text-xs">
                  <p className="flex items-center gap-2 font-semibold text-[#141414]">
                    <User className="h-3.5 w-3.5 shrink-0 text-[#8E6D35]" aria-hidden="true" />
                    <span className="min-w-0 break-words">{selectedCustomer.customerName}</span>
                  </p>
                  <p className="flex items-center gap-2 tabular-nums text-[#141414]">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-[#8E6D35]" aria-hidden="true" />
                    <span>{selectedCustomer.mobileNumber}</span>
                  </p>
                  <p className="flex items-start gap-2 text-[#5C574F]">
                    <MapPin
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8E6D35]"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 break-words">
                      {selectedCustomer.fullAddress}, {selectedCustomer.upazila},{' '}
                      {selectedCustomer.district}
                    </span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="min-w-0 border border-[#EFE9DF] bg-[#FAF8F4] p-3">
                    <p className="text-[11px] text-[#5C574F]">Total Orders</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-[#141414] sm:text-xl">
                      {selectedCustomer.totalOrders}
                    </p>
                  </div>
                  <div className="min-w-0 border border-[#EFE9DF] bg-[#FAF8F4] p-3">
                    <p className="text-[11px] text-[#5C574F]">Purchase Total</p>
                    <p className="mt-1 break-words text-lg font-bold tabular-nums text-[#141414] sm:text-xl">
                      {formatBdt(selectedCustomer.totalPurchaseAmount)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border border-[#E3DBD0] bg-white p-4 sm:p-5">
                <h5 className="flex items-center gap-2 border-b border-[#EFE9DF] pb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#8E6D35]">
                  <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Order History ({selectedCustomer.orders.length})</span>
                </h5>

                <ul className="divide-y divide-[#EFE9DF]">
                  {selectedCustomer.orders.map((ord) => (
                    <li
                      key={ord.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-[#141414]">
                            {ord.id}
                          </span>
                          <span
                            className={`border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              ORDER_STATUS_BADGE_STYLES[ord.status]?.badge ?? ''
                            }`}
                          >
                            {ord.status}
                          </span>
                        </div>
                        <p className="mt-1 text-[#5C574F]">
                          {new Date(ord.createdAt).toLocaleString()} ·{' '}
                          {ord.items.map((i) => `${i.productName} ×${i.quantity}`).join(', ')}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-semibold tabular-nums text-[#141414]">
                          {formatBdt(ord.grandTotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMobile(null);
                            onInspectOrder(ord.id);
                          }}
                          className="border border-[#141414] px-2.5 py-1 text-[11px] font-medium text-[#141414] hover:bg-[#141414] hover:text-[#FAF8F4]"
                        >
                          View Order
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

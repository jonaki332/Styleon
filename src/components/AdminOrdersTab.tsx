import {
  Check,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  MapPin,
  Pencil,
  Phone,
  Printer,
  Search,
  Trash2,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BANGLADESH_DISTRICTS } from '../data/bangladeshLocations';
import { formatBdt } from '../data/catalog';
import {
  exportOrdersToCsv,
  ORDER_STATUS_BADGE_STYLES,
} from '../utils/adminAnalytics';
import {
  AdminApiError,
  UpdateOrderCustomerPayload,
} from '../utils/adminApi';
import { ORDER_STATUSES, OrderStatus, StoredOrder } from '../utils/orders';
import { ImageWithFallback } from './ImageWithFallback';
import {
  LocationOption,
  SearchableLocationSelect,
} from './SearchableLocationSelect';

interface AdminOrdersTabProps {
  orders: StoredOrder[];
  inspectOrderId: string | null;
  onClearInspectOrder: () => void;
  onUpdateOrderStatus: (
    orderId: string,
    status: OrderStatus,
    note?: string,
  ) => Promise<void>;
  onUpdateOrderCustomer: (
    orderId: string,
    payload: UpdateOrderCustomerPayload,
  ) => Promise<void>;
  onDeleteOrder: (orderId: string) => Promise<void>;
  onPrintInvoice: (order: StoredOrder) => void;
}

type DatePreset = 'all' | 'today' | '7d' | '30d' | 'custom';

export function AdminOrdersTab({
  orders,
  inspectOrderId,
  onClearInspectOrder,
  onUpdateOrderStatus,
  onUpdateOrderCustomer,
  onDeleteOrder,
  onPrintInvoice,
}: AdminOrdersTabProps) {
  const [statusFilter, setStatusFilter] = useState<'All' | OrderStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Order Details Modal: status change + note
  const [pendingStatusValue, setPendingStatusValue] =
    useState<OrderStatus>('Pending');
  const [statusNote, setStatusNote] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [savingAction, setSavingAction] = useState(false);

  // Edit Customer Info state inside Order Details Modal
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [editUpazila, setEditUpazila] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editLandmark, setEditLandmark] = useState('');
  const [editInstructions, setEditInstructions] = useState('');

  useEffect(() => {
    if (inspectOrderId) {
      setSelectedOrderId(inspectOrderId);
      onClearInspectOrder();
    }
  }, [inspectOrderId, onClearInspectOrder]);

  const sortedOrdersNewestFirst = useMemo(
    () => [...orders].sort((a, b) => b.createdAt - a.createdAt),
    [orders],
  );

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  useEffect(() => {
    if (!selectedOrder) return;
    setPendingStatusValue(selectedOrder.status);
    setStatusNote('');
    setActionError('');
    setActionSuccess('');
    setEditingCustomer(false);
    setEditName(selectedOrder.customerName);
    setEditMobile(selectedOrder.mobileNumber);
    setEditDistrict(selectedOrder.district);
    setEditUpazila(selectedOrder.upazila);
    setEditAddress(selectedOrder.fullAddress);
    setEditLandmark(selectedOrder.nearbyLandmark ?? '');
    setEditInstructions(selectedOrder.deliveryInstructions ?? '');
  }, [selectedOrder]);

  const districtOptions = useMemo<LocationOption[]>(
    () =>
      BANGLADESH_DISTRICTS.map((d) => ({
        value: d.district,
        labelEn: d.district,
        labelBn: d.districtBn,
        meta: `${d.division} Division`,
      })),
    [],
  );

  const editUpazilaOptions = useMemo<LocationOption[]>(() => {
    const entry = BANGLADESH_DISTRICTS.find((d) => d.district === editDistrict);
    return (entry?.upazilas ?? []).map((u) => ({
      value: u.name,
      labelEn: u.name,
      labelBn: u.nameBn,
    }));
  }, [editDistrict]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();

    let minTs = 0;
    let maxTs = Number.MAX_SAFE_INTEGER;
    if (datePreset === 'today') {
      minTs = startOfToday;
    } else if (datePreset === '7d') {
      minTs = startOfToday - 6 * 24 * 60 * 60 * 1000;
    } else if (datePreset === '30d') {
      minTs = startOfToday - 29 * 24 * 60 * 60 * 1000;
    } else if (datePreset === 'custom') {
      if (dateFrom) {
        const parsedFrom = new Date(`${dateFrom}T00:00:00`).getTime();
        if (!Number.isNaN(parsedFrom)) minTs = parsedFrom;
      }
      if (dateTo) {
        const parsedTo = new Date(`${dateTo}T23:59:59.999`).getTime();
        if (!Number.isNaN(parsedTo)) maxTs = parsedTo;
      }
    }

    return sortedOrdersNewestFirst.filter((order) => {
      if (statusFilter !== 'All' && order.status !== statusFilter) {
        return false;
      }
      if (order.createdAt < minTs || order.createdAt > maxTs) {
        return false;
      }
      if (!q) return true;
      const itemMatch = order.items.some((i) =>
        i.productName.toLowerCase().includes(q),
      );
      return (
        order.id.toLowerCase().includes(q) ||
        order.customerName.toLowerCase().includes(q) ||
        order.mobileNumber.toLowerCase().includes(q) ||
        order.district.toLowerCase().includes(q) ||
        order.upazila.toLowerCase().includes(q) ||
        itemMatch
      );
    });
  }, [
    sortedOrdersNewestFirst,
    statusFilter,
    searchQuery,
    datePreset,
    dateFrom,
    dateTo,
  ]);

  const runOrderAction = async (fn: () => Promise<void>, successMsg: string) => {
    setActionError('');
    setActionSuccess('');
    setSavingAction(true);
    try {
      await fn();
      setActionSuccess(successMsg);
      window.setTimeout(() => setActionSuccess(''), 2500);
    } catch (err) {
      setActionError(
        err instanceof AdminApiError
          ? err.message
          : 'Action failed. Please try again.',
      );
    } finally {
      setSavingAction(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search, Status Filter, Date Filter & CSV Export */}
      <div className="space-y-3 border border-[#E3DBD0] bg-white p-3.5 sm:p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          <div className="relative min-w-0 w-full sm:flex-1 sm:max-w-sm">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#5C574F]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Order ID, Phone (01...), Customer..."
              aria-label="Search orders"
              className="min-h-[40px] w-full border border-[#E3DBD0] bg-[#FAF8F4] pr-3 pl-9 text-xs text-[#141414] placeholder:text-[#9A9389] focus:border-[#141414] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter orders by date range"
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DatePreset)}
              className="min-h-[40px] flex-1 border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-xs font-medium text-[#141414] focus:border-[#141414] focus:outline-none sm:flex-none"
            >
              <option value="all">Date: All Time</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>

            {datePreset === 'custom' && (
              <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
                <input
                  type="date"
                  aria-label="Filter from date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="min-h-[40px] min-w-0 flex-1 border border-[#E3DBD0] bg-[#FAF8F4] px-2.5 text-xs text-[#141414] sm:flex-none"
                />
                <span className="text-xs text-[#5C574F]">to</span>
                <input
                  type="date"
                  aria-label="Filter to date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="min-h-[40px] min-w-0 flex-1 border border-[#E3DBD0] bg-[#FAF8F4] px-2.5 text-xs text-[#141414] sm:flex-none"
                />
              </div>
            )}

            <button
              type="button"
              disabled={filteredOrders.length === 0}
              onClick={() => exportOrdersToCsv(filteredOrders)}
              className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 border border-[#141414] bg-white px-3.5 text-xs font-semibold uppercase tracking-wider text-[#141414] transition-colors hover:bg-[#141414] hover:text-[#FAF8F4] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export Orders CSV</span>
            </button>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex flex-wrap gap-1.5 border-t border-[#EFE9DF] pt-3">
          {(['All', ...ORDER_STATUSES] as const).map((status) => {
            const count =
              status === 'All'
                ? orders.length
                : orders.filter((o) => o.status === status).length;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`min-h-[34px] border px-3 text-xs font-medium transition-colors ${
                  statusFilter === status
                    ? 'border-[#141414] bg-[#141414] text-[#FAF8F4]'
                    : 'border-[#E3DBD0] bg-[#FAF8F4] text-[#5C574F] hover:border-[#141414]'
                }`}
              >
                {status} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {actionError && !selectedOrder && (
        <div
          role="alert"
          className="border border-[#9B2C2C]/30 bg-[#FFF5F5] p-3 text-xs text-[#9B2C2C]"
        >
          {actionError}
        </div>
      )}

      {/* Orders List / Responsive Table */}
      {filteredOrders.length === 0 ? (
        <div className="border border-[#E3DBD0] bg-white p-10 text-center text-sm text-[#5C574F]">
          No customer orders match the selected filters yet. New orders placed on
          STYLEON appear here automatically.
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden overflow-x-auto border border-[#E3DBD0] bg-white lg:block">
            <table className="w-full min-w-[980px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#E3DBD0] bg-[#FAF8F4] text-[11px] font-semibold uppercase tracking-wider text-[#5C574F]">
                  <th className="px-3.5 py-3">Order &amp; Date</th>
                  <th className="px-3.5 py-3">Customer &amp; Address</th>
                  <th className="px-3.5 py-3">Product</th>
                  <th className="px-3.5 py-3 text-right">Amounts</th>
                  <th className="px-3.5 py-3">Status</th>
                  <th className="px-3.5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE9DF]">
                {filteredOrders.map((order) => {
                  const primaryItem = order.items[0];
                  const extraCount = order.items.length - 1;
                  const totalQty = order.items.reduce(
                    (s, i) => s + i.quantity,
                    0,
                  );
                  const badgeStyle =
                    ORDER_STATUS_BADGE_STYLES[order.status]?.badge ??
                    ORDER_STATUS_BADGE_STYLES.Pending.badge;
                  return (
                    <tr
                      key={order.id}
                      className="align-top transition-colors hover:bg-[#FAF8F4]/70"
                    >
                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        <p className="font-mono text-xs font-bold text-[#141414]">
                          {order.id}
                        </p>
                        <p className="mt-1 text-[11px] text-[#5C574F]">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-[11px] text-[#7A746B]">
                          {new Date(order.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </td>

                      <td className="max-w-[230px] px-3.5 py-3.5">
                        <p className="font-semibold text-[#141414]">
                          {order.customerName}
                        </p>
                        <p className="mt-0.5 tabular-nums font-medium text-[#141414]">
                          {order.mobileNumber}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#5C574F]">
                          {order.upazila}, {order.district}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-[#7A746B]">
                          {order.fullAddress}
                        </p>
                      </td>

                      <td className="max-w-[240px] px-3.5 py-3.5">
                        {primaryItem && (
                          <div className="flex items-start gap-2.5">
                            <div className="h-12 w-10 shrink-0 overflow-hidden border border-[#E3DBD0] bg-[#EFE9DF]">
                              <ImageWithFallback
                                src={primaryItem.productImage ?? ''}
                                alt={primaryItem.productName}
                                label={primaryItem.productName}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="line-clamp-2 font-medium text-[#141414]">
                                {primaryItem.productName}
                                {extraCount > 0 && ` (+${extraCount} more)`}
                              </p>
                              <p className="mt-0.5 text-[11px] text-[#5C574F]">
                                {primaryItem.size} · {primaryItem.color} · Qty:{' '}
                                <strong className="tabular-nums text-[#141414]">
                                  {totalQty}
                                </strong>
                              </p>
                              <p className="mt-0.5 text-[11px] tabular-nums text-[#5C574F]">
                                Unit: {formatBdt(primaryItem.unitPriceBdt)}
                              </p>
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="px-3.5 py-3.5 text-right whitespace-nowrap tabular-nums">
                        <p className="text-sm font-bold text-[#141414]">
                          {formatBdt(order.grandTotal)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#5C574F]">
                          Sub: {formatBdt(order.productSubtotal)}
                        </p>
                        <p className="text-[11px] text-[#5C574F]">
                          Del: {formatBdt(order.deliveryCharge)}
                        </p>
                        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#8E6D35]">
                          COD
                        </p>
                      </td>

                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-block border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badgeStyle}`}
                        >
                          {order.status}
                        </span>
                        <div className="mt-2">
                          <select
                            aria-label={`Change status for ${order.id}`}
                            value={order.status}
                            disabled={savingAction}
                            onChange={(e) => {
                              const next = e.target.value as OrderStatus;
                              if (next === 'Cancelled') {
                                setConfirmCancelId(order.id);
                                return;
                              }
                              void runOrderAction(
                                () => onUpdateOrderStatus(order.id, next),
                                `Updated ${order.id} to ${next}`,
                              );
                            }}
                            className="min-h-[30px] border border-[#E3DBD0] bg-white px-2 text-[11px] font-medium text-[#141414] focus:border-[#141414] focus:outline-none"
                          >
                            {ORDER_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      <td className="px-3.5 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex flex-wrap justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedOrderId(order.id)}
                            className="inline-flex min-h-[32px] items-center gap-1 border border-[#141414] bg-[#141414] px-2.5 text-[11px] font-medium text-[#FAF8F4] hover:bg-[#2A2825]"
                          >
                            <Eye className="h-3 w-3" aria-hidden="true" />
                            <span>View</span>
                          </button>

                          {order.status === 'Pending' && (
                            <button
                              type="button"
                              disabled={savingAction}
                              onClick={() =>
                                void runOrderAction(
                                  () => onUpdateOrderStatus(order.id, 'Confirmed'),
                                  `Confirmed ${order.id}`,
                                )
                              }
                              className="inline-flex min-h-[32px] items-center gap-1 border border-[#1D4ED8]/40 bg-[#EFF6FF] px-2.5 text-[11px] font-semibold text-[#1D4ED8] hover:border-[#1D4ED8]"
                            >
                              <Check className="h-3 w-3" aria-hidden="true" />
                              <span>Confirm</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onPrintInvoice(order)}
                            title="Print Invoice"
                            aria-label={`Print invoice for ${order.id}`}
                            className="inline-flex min-h-[32px] items-center justify-center border border-[#E3DBD0] bg-white px-2 text-[#141414] hover:border-[#141414]"
                          >
                            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>

                          {order.status !== 'Cancelled' &&
                            (confirmCancelId === order.id ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={savingAction}
                                  onClick={() => {
                                    void runOrderAction(
                                      () =>
                                        onUpdateOrderStatus(
                                          order.id,
                                          'Cancelled',
                                          'Cancelled by admin',
                                        ),
                                      `Cancelled ${order.id}`,
                                    );
                                    setConfirmCancelId(null);
                                  }}
                                  className="min-h-[32px] bg-[#9B2C2C] px-2 text-[11px] text-white"
                                >
                                  Confirm Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmCancelId(null)}
                                  className="min-h-[32px] border border-[#E3DBD0] px-2 text-[11px] text-[#5C574F]"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmCancelId(order.id)}
                                title="Cancel Order"
                                aria-label={`Cancel order ${order.id}`}
                                className="inline-flex min-h-[32px] items-center justify-center border border-[#E3DBD0] bg-white px-2 text-[#9B2C2C] hover:border-[#9B2C2C]"
                              >
                                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            ))}

                          {confirmDeleteId === order.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                disabled={savingAction}
                                onClick={() => {
                                  void runOrderAction(
                                    () => onDeleteOrder(order.id),
                                    `Deleted ${order.id}`,
                                  );
                                  setConfirmDeleteId(null);
                                }}
                                className="min-h-[32px] bg-[#9B2C2C] px-2 text-[11px] text-white"
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="min-h-[32px] border border-[#E3DBD0] px-2 text-[11px] text-[#5C574F]"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(order.id)}
                              title="Delete Order"
                              aria-label={`Delete order ${order.id}`}
                              className="inline-flex min-h-[32px] items-center justify-center border border-[#E3DBD0] bg-white px-2 text-[#9B2C2C] hover:border-[#9B2C2C]"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile & Tablet Order Detail Cards */}
          <ul className="space-y-3 lg:hidden">
            {filteredOrders.map((order) => {
              const primaryItem = order.items[0];
              const extraCount = order.items.length - 1;
              const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
              const badgeStyle =
                ORDER_STATUS_BADGE_STYLES[order.status]?.badge ??
                ORDER_STATUS_BADGE_STYLES.Pending.badge;
              return (
                <li
                  key={order.id}
                  className="min-w-0 border border-[#E3DBD0] bg-white p-3.5 sm:p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#EFE9DF] pb-3">
                    <div className="min-w-0">
                      <span className="break-all font-mono text-sm font-bold text-[#141414]">
                        {order.id}
                      </span>
                      <p className="mt-0.5 text-[11px] text-[#5C574F]">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badgeStyle}`}
                    >
                      {order.status}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1 text-xs">
                    <p className="break-words font-semibold text-[#141414]">
                      {order.customerName} ·{' '}
                      <span className="tabular-nums text-[#5C574F]">
                        {order.mobileNumber}
                      </span>
                    </p>
                    <p className="break-words text-[#5C574F]">
                      {order.fullAddress}, {order.upazila}, {order.district}
                    </p>
                  </div>

                  {primaryItem && (
                    <div className="mt-3 flex items-center gap-3 border border-[#EFE9DF] bg-[#FAF8F4] p-2.5">
                      <div className="h-12 w-10 shrink-0 overflow-hidden bg-[#EFE9DF]">
                        <ImageWithFallback
                          src={primaryItem.productImage ?? ''}
                          alt={primaryItem.productName}
                          label={primaryItem.productName}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1 text-xs">
                        <p className="truncate font-semibold text-[#141414]">
                          {primaryItem.productName}
                          {extraCount > 0 && ` (+${extraCount})`}
                        </p>
                        <p className="break-words text-[11px] text-[#5C574F]">
                          {primaryItem.size} · {primaryItem.color} · Qty:{' '}
                          {totalQty}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-xs tabular-nums">
                        <p className="font-bold text-[#141414]">
                          {formatBdt(order.grandTotal)}
                        </p>
                        <p className="text-[10px] text-[#8E6D35]">COD</p>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 space-y-2 border-t border-[#EFE9DF] pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label={`Change status for ${order.id}`}
                        value={order.status}
                        disabled={savingAction}
                        onChange={(e) => {
                          const next = e.target.value as OrderStatus;
                          if (next === 'Cancelled') {
                            setConfirmCancelId(order.id);
                            return;
                          }
                          void runOrderAction(
                            () => onUpdateOrderStatus(order.id, next),
                            `Updated ${order.id} to ${next}`,
                          );
                        }}
                        className="min-h-[38px] min-w-0 flex-1 border border-[#E3DBD0] bg-[#FAF8F4] px-2.5 text-xs font-medium text-[#141414] focus:border-[#141414] focus:outline-none"
                      >
                        {ORDER_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            Status: {st}
                          </option>
                        ))}
                      </select>

                      {order.status === 'Pending' && (
                        <button
                          type="button"
                          disabled={savingAction}
                          onClick={() =>
                            void runOrderAction(
                              () => onUpdateOrderStatus(order.id, 'Confirmed'),
                              `Confirmed ${order.id}`,
                            )
                          }
                          className="inline-flex min-h-[38px] items-center justify-center gap-1 border border-[#1D4ED8]/40 bg-[#EFF6FF] px-3 text-xs font-semibold text-[#1D4ED8]"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Confirm</span>
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedOrderId(order.id)}
                        className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 bg-[#141414] px-3 text-xs font-medium text-[#FAF8F4]"
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>View Order</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onPrintInvoice(order)}
                        className="inline-flex min-h-[38px] items-center justify-center gap-1 border border-[#E3DBD0] px-3 text-xs font-medium text-[#141414]"
                      >
                        <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Invoice</span>
                      </button>

                      {order.status !== 'Cancelled' &&
                        (confirmCancelId === order.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              disabled={savingAction}
                              onClick={() => {
                                void runOrderAction(
                                  () =>
                                    onUpdateOrderStatus(
                                      order.id,
                                      'Cancelled',
                                      'Cancelled by admin',
                                    ),
                                  `Cancelled ${order.id}`,
                                );
                                setConfirmCancelId(null);
                              }}
                              className="min-h-[38px] bg-[#9B2C2C] px-2.5 text-[11px] font-medium text-white"
                            >
                              Confirm Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmCancelId(null)}
                              className="min-h-[38px] border border-[#E3DBD0] px-2 text-[11px] text-[#5C574F]"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmCancelId(order.id)}
                            aria-label={`Cancel order ${order.id}`}
                            className="inline-flex min-h-[38px] items-center justify-center border border-[#E3DBD0] bg-white px-2.5 text-[#9B2C2C]"
                          >
                            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        ))}

                      {confirmDeleteId === order.id ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            disabled={savingAction}
                            onClick={() => {
                              void runOrderAction(
                                () => onDeleteOrder(order.id),
                                `Deleted ${order.id}`,
                              );
                              setConfirmDeleteId(null);
                            }}
                            className="min-h-[38px] bg-[#9B2C2C] px-2.5 text-[11px] font-medium text-white"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[38px] border border-[#E3DBD0] px-2 text-[11px] text-[#5C574F]"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(order.id)}
                          aria-label={`Delete order ${order.id}`}
                          className="inline-flex min-h-[38px] items-center justify-center border border-[#E3DBD0] bg-white px-2.5 text-[#9B2C2C]"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Full Order Details & Management Modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-0 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Order Details ${selectedOrder.id}`}
          onClick={() => setSelectedOrderId(null)}
        >
          <div
            className="flex h-[100dvh] w-full max-w-4xl flex-col border-[#D8CFC2] bg-[#FAF8F4] shadow-2xl sm:h-auto sm:max-h-[92vh] sm:border"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E3DBD0] bg-white px-4 py-3.5 sm:gap-3 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="break-all font-mono text-base font-bold text-[#141414] sm:text-lg">
                    {selectedOrder.id}
                  </span>
                  <span
                    className={`border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      ORDER_STATUS_BADGE_STYLES[selectedOrder.status]?.badge ??
                      ''
                    }`}
                  >
                    {selectedOrder.status}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[#5C574F]">
                  Placed on {new Date(selectedOrder.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPrintInvoice(selectedOrder)}
                  className="inline-flex min-h-[38px] items-center gap-1.5 border border-[#141414] bg-white px-3 text-xs font-semibold uppercase tracking-wider text-[#141414] hover:bg-[#141414] hover:text-[#FAF8F4] sm:px-3.5"
                >
                  <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Print Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrderId(null)}
                  aria-label="Close order details"
                  className="inline-flex h-9 w-9 items-center justify-center border border-[#E3DBD0] bg-white text-[#141414] hover:border-[#141414]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
              {actionError && (
                <div
                  role="alert"
                  className="border border-[#9B2C2C]/30 bg-[#FFF5F5] p-3 text-xs text-[#9B2C2C]"
                >
                  {actionError}
                </div>
              )}
              {actionSuccess && (
                <div
                  role="status"
                  className="flex items-center gap-2 border border-[#15803D]/30 bg-[#F0FDF4] p-3 text-xs text-[#15803D]"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              <div className="grid gap-5 md:grid-cols-2">
                {/* Customer Information + Edit Customer Info */}
                <div className="min-w-0 border border-[#E3DBD0] bg-white p-4 sm:p-5">
                  <div className="flex items-center justify-between border-b border-[#EFE9DF] pb-3">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8E6D35]">
                      Customer Information
                    </h4>
                    <button
                      type="button"
                      onClick={() => setEditingCustomer((prev) => !prev)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#141414] hover:text-[#8E6D35]"
                    >
                      <Pencil className="h-3 w-3" aria-hidden="true" />
                      <span>
                        {editingCustomer ? 'Cancel Edit' : 'Edit Customer Info'}
                      </span>
                    </button>
                  </div>

                  {editingCustomer ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void runOrderAction(
                          async () => {
                            await onUpdateOrderCustomer(selectedOrder.id, {
                              customerName: editName,
                              mobileNumber: editMobile,
                              district: editDistrict,
                              upazila: editUpazila,
                              fullAddress: editAddress,
                              nearbyLandmark: editLandmark || undefined,
                              deliveryInstructions:
                                editInstructions || undefined,
                            });
                            setEditingCustomer(false);
                          },
                          'Customer information updated.',
                        );
                      }}
                      className="mt-4 space-y-3 text-xs"
                    >
                      <div>
                        <label className="block font-medium text-[#141414]">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="mt-1 min-h-[38px] w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-xs text-[#141414] focus:border-[#141414] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-[#141414]">
                          Mobile Number *
                        </label>
                        <input
                          type="tel"
                          value={editMobile}
                          onChange={(e) => setEditMobile(e.target.value)}
                          className="mt-1 min-h-[38px] w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-xs tabular-nums text-[#141414] focus:border-[#141414] focus:outline-none"
                        />
                      </div>
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block font-medium text-[#141414]">
                            District *
                          </label>
                          <SearchableLocationSelect
                            id="edit-order-district"
                            value={editDistrict}
                            options={districtOptions}
                            placeholder="Select District"
                            searchPlaceholder="Search district..."
                            onChange={(d) => {
                              setEditDistrict(d);
                              setEditUpazila('');
                            }}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block font-medium text-[#141414]">
                            Upazila *
                          </label>
                          <SearchableLocationSelect
                            id="edit-order-upazila"
                            value={editUpazila}
                            options={editUpazilaOptions}
                            disabled={!editDistrict}
                            placeholder="Select Upazila"
                            searchPlaceholder="Search upazila..."
                            onChange={setEditUpazila}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block font-medium text-[#141414]">
                          Full Delivery Address *
                        </label>
                        <textarea
                          rows={2}
                          value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)}
                          className="mt-1 w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 py-2 text-xs text-[#141414] focus:border-[#141414] focus:outline-none"
                        />
                      </div>
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <div>
                          <label className="block font-medium text-[#5C574F]">
                            Nearby Landmark
                          </label>
                          <input
                            type="text"
                            value={editLandmark}
                            onChange={(e) => setEditLandmark(e.target.value)}
                            className="mt-1 min-h-[36px] w-full border border-[#E3DBD0] bg-[#FAF8F4] px-2.5 text-xs text-[#141414]"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-[#5C574F]">
                            Additional Instructions
                          </label>
                          <input
                            type="text"
                            value={editInstructions}
                            onChange={(e) =>
                              setEditInstructions(e.target.value)
                            }
                            className="mt-1 min-h-[36px] w-full border border-[#E3DBD0] bg-[#FAF8F4] px-2.5 text-xs text-[#141414]"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={savingAction}
                        className="min-h-[38px] w-full bg-[#141414] px-4 text-xs font-semibold uppercase tracking-wider text-[#FAF8F4] hover:bg-[#2A2825] disabled:opacity-50"
                      >
                        {savingAction ? 'Saving...' : 'Save Customer Info'}
                      </button>
                    </form>
                  ) : (
                    <dl className="mt-4 space-y-2.5 text-xs">
                      <div className="flex items-start gap-2">
                        <User
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8E6D35]"
                          aria-hidden="true"
                        />
                        <div>
                          <dt className="text-[11px] text-[#5C574F]">
                            Full Name
                          </dt>
                          <dd className="text-sm font-semibold text-[#141414]">
                            {selectedOrder.customerName}
                          </dd>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Phone
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8E6D35]"
                          aria-hidden="true"
                        />
                        <div>
                          <dt className="text-[11px] text-[#5C574F]">
                            Mobile Number
                          </dt>
                          <dd className="tabular-nums font-semibold text-[#141414]">
                            {selectedOrder.mobileNumber}
                          </dd>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8E6D35]"
                          aria-hidden="true"
                        />
                        <div className="min-w-0 space-y-1">
                          <dt className="text-[11px] text-[#5C574F]">
                            Delivery Location
                          </dt>
                          <dd className="break-words font-medium text-[#141414]">
                            District: {selectedOrder.district} · Upazila:{' '}
                            {selectedOrder.upazila}
                          </dd>
                          <dd className="break-words leading-relaxed text-[#5C574F]">
                            {selectedOrder.fullAddress}
                          </dd>
                          {selectedOrder.nearbyLandmark && (
                            <dd className="break-words text-[#5C574F]">
                              Nearby Landmark:{' '}
                              <span className="text-[#141414]">
                                {selectedOrder.nearbyLandmark}
                              </span>
                            </dd>
                          )}
                          {selectedOrder.deliveryInstructions && (
                            <dd className="break-words text-[#5C574F]">
                              Instructions:{' '}
                              <span className="text-[#141414]">
                                {selectedOrder.deliveryInstructions}
                              </span>
                            </dd>
                          )}
                        </div>
                      </div>
                    </dl>
                  )}
                </div>

                {/* Payment, Delivery & Order Status Controls */}
                <div className="min-w-0 space-y-4 border border-[#E3DBD0] bg-white p-4 sm:p-5">
                  <h4 className="border-b border-[#EFE9DF] pb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#8E6D35]">
                    Payment &amp; Status Controls
                  </h4>

                  <dl className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-[#5C574F]">
                      <dt>Subtotal</dt>
                      <dd className="font-medium tabular-nums text-[#141414]">
                        {formatBdt(selectedOrder.productSubtotal)}
                      </dd>
                    </div>
                    {typeof selectedOrder.discountAmount === 'number' &&
                      selectedOrder.discountAmount > 0 && (
                        <div className="flex justify-between text-[#15803D]">
                          <dt>Discount Applied</dt>
                          <dd className="font-medium tabular-nums">
                            -{formatBdt(selectedOrder.discountAmount)}
                          </dd>
                        </div>
                      )}
                    <div className="flex justify-between text-[#5C574F]">
                      <dt>Delivery Charge</dt>
                      <dd className="font-medium tabular-nums text-[#141414]">
                        {formatBdt(selectedOrder.deliveryCharge)}
                      </dd>
                    </div>
                    <div className="flex justify-between border-t border-[#EFE9DF] pt-2 text-sm font-bold text-[#141414]">
                      <dt>Total Amount</dt>
                      <dd className="tabular-nums">
                        {formatBdt(selectedOrder.grandTotal)}
                      </dd>
                    </div>
                    <div className="flex justify-between pt-1 text-[#5C574F]">
                      <dt>Payment Method</dt>
                      <dd className="font-semibold text-[#141414]">
                        Cash on Delivery
                      </dd>
                    </div>
                    <div className="flex justify-between text-[#5C574F]">
                      <dt>Order Date &amp; Time</dt>
                      <dd className="text-[#141414]">
                        {new Date(selectedOrder.createdAt).toLocaleString()}
                      </dd>
                    </div>
                  </dl>

                  {/* Update Status Form */}
                  <div className="space-y-2.5 border-t border-[#EFE9DF] pt-3 text-xs">
                    <label
                      htmlFor="detail-order-status"
                      className="block font-semibold uppercase tracking-wider text-[#141414]"
                    >
                      Update Order Status
                    </label>
                    <select
                      id="detail-order-status"
                      value={pendingStatusValue}
                      onChange={(e) =>
                        setPendingStatusValue(e.target.value as OrderStatus)
                      }
                      className="min-h-[40px] w-full border border-[#141414] bg-[#FAF8F4] px-3 text-xs font-semibold text-[#141414] focus:outline-none"
                    >
                      {ORDER_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      placeholder="Optional status note (e.g. Courier tracking #)..."
                      className="min-h-[38px] w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-xs text-[#141414] focus:border-[#141414] focus:outline-none"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={savingAction}
                        onClick={() => {
                          void runOrderAction(
                            () =>
                              onUpdateOrderStatus(
                                selectedOrder.id,
                                pendingStatusValue,
                                statusNote.trim() || undefined,
                              ),
                            `Order status updated to ${pendingStatusValue}.`,
                          );
                        }}
                        className="min-h-[38px] flex-1 bg-[#141414] px-4 text-xs font-semibold uppercase tracking-wider text-[#FAF8F4] hover:bg-[#2A2825] disabled:opacity-50"
                      >
                        Update Status
                      </button>

                      {selectedOrder.status === 'Pending' && (
                        <button
                          type="button"
                          disabled={savingAction}
                          onClick={() =>
                            void runOrderAction(
                              () =>
                                onUpdateOrderStatus(
                                  selectedOrder.id,
                                  'Confirmed',
                                  'Order confirmed by admin',
                                ),
                              `Order ${selectedOrder.id} confirmed.`,
                            )
                          }
                          className="min-h-[38px] border border-[#1D4ED8] bg-[#EFF6FF] px-3.5 text-xs font-semibold text-[#1D4ED8]"
                        >
                          Confirm Order
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ordered Products */}
              <div className="border border-[#E3DBD0] bg-white p-5">
                <h4 className="border-b border-[#EFE9DF] pb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#8E6D35]">
                  Product Information
                </h4>
                <ul className="divide-y divide-[#EFE9DF]">
                  {selectedOrder.items.map((item, idx) => (
                    <li
                      key={`${item.productId}-${idx}`}
                      className="flex flex-wrap items-center gap-4 py-3.5 text-xs"
                    >
                      <div className="h-16 w-14 shrink-0 overflow-hidden border border-[#E3DBD0] bg-[#EFE9DF]">
                        <ImageWithFallback
                          src={item.productImage ?? ''}
                          alt={item.productName}
                          label={item.productName}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#141414]">
                          {item.productName}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-[#7A746B]">
                          Product ID: {item.productId}
                        </p>
                        <p className="mt-1 text-[#5C574F]">
                          Size:{' '}
                          <strong className="text-[#141414]">{item.size}</strong>{' '}
                          · Color:{' '}
                          <strong className="text-[#141414]">
                            {item.color}
                          </strong>{' '}
                          · Qty:{' '}
                          <strong className="tabular-nums text-[#141414]">
                            {item.quantity}
                          </strong>
                        </p>
                      </div>
                      <div className="text-right tabular-nums">
                        <p className="text-sm font-bold text-[#141414]">
                          {formatBdt(item.unitPriceBdt * item.quantity)}
                        </p>
                        <p className="text-[11px] text-[#5C574F]">
                          {formatBdt(item.unitPriceBdt)} × {item.quantity}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Status Change History Timeline */}
              <div className="border border-[#E3DBD0] bg-white p-4 sm:p-5">
                <h4 className="border-b border-[#EFE9DF] pb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#8E6D35]">
                  Order Status History
                </h4>
                <ul className="mt-3 space-y-2.5 text-xs">
                  {(
                    selectedOrder.statusHistory &&
                    selectedOrder.statusHistory.length > 0
                      ? selectedOrder.statusHistory
                      : [
                          {
                            status: selectedOrder.status,
                            changedAt: selectedOrder.createdAt,
                            note: 'Order created',
                          },
                        ]
                  )
                    .slice()
                    .reverse()
                    .map((entry, idx) => (
                      <li
                        key={`${entry.changedAt}-${idx}`}
                        className="flex flex-col gap-1.5 border-l-2 border-[#B89352] py-0.5 pl-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2"
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span
                            className={`border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                              ORDER_STATUS_BADGE_STYLES[entry.status]?.badge ??
                              ''
                            }`}
                          >
                            {entry.status}
                          </span>
                          {entry.note && (
                            <span className="break-words text-[#5C574F]">{entry.note}</span>
                          )}
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-[#7A746B]">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          <span>
                            {new Date(entry.changedAt).toLocaleString()}
                          </span>
                        </span>
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

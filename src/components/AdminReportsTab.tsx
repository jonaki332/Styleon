import { BarChart3, Download, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatBdt } from '../data/catalog';
import {
  BusinessMetrics,
  exportSalesReportToCsv,
  ORDER_STATUS_BADGE_STYLES,
} from '../utils/adminAnalytics';

interface AdminReportsTabProps {
  metrics: BusinessMetrics;
  deliveryChargeBdt: number;
  onUpdateDeliveryCharge: (charge: number) => Promise<void>;
}

export function AdminReportsTab({
  metrics,
  deliveryChargeBdt,
  onUpdateDeliveryCharge,
}: AdminReportsTabProps) {
  const [deliveryChargeInput, setDeliveryChargeInput] = useState(
    String(deliveryChargeBdt),
  );
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [deliveryMsg, setDeliveryMsg] = useState('');

  useEffect(() => {
    setDeliveryChargeInput(String(deliveryChargeBdt));
  }, [deliveryChargeBdt]);

  const maxDailyOrders = Math.max(
    1,
    ...metrics.dailyOrdersSeries.map((d) => d.ordersCount),
  );
  const maxMonthlyVal = Math.max(
    1,
    ...metrics.monthlySalesSeries.map((m) =>
      Math.max(m.orderValue, m.deliveredRevenue),
    ),
  );
  const maxBestSellerUnits = Math.max(
    1,
    ...metrics.bestSellingProducts.slice(0, 6).map((b) => b.unitsSold),
  );
  const totalStatusOrders = Math.max(1, metrics.totalOrders);

  return (
    <div className="space-y-6">
      {/* Delivery Settings Section (Section 10) */}
      <div className="border border-[#E3DBD0] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Truck
              className="mt-1 h-5 w-5 shrink-0 text-[#8E6D35]"
              aria-hidden="true"
            />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8E6D35]">
                Delivery Settings
              </p>
              <h3 className="font-display mt-0.5 text-xl font-semibold text-[#141414]">
                Nationwide Delivery Charge (All 64 Districts &amp; Upazilas)
              </h3>
              <p className="mt-1 text-xs text-[#5C574F]">
                Current fixed delivery rate:{' '}
                <strong className="text-[#141414]">
                  {formatBdt(deliveryChargeBdt)}
                </strong>{' '}
                throughout Bangladesh. Updating this rate applies immediately to
                all new orders while preserving the original delivery charge on
                previously submitted orders.
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = Number(deliveryChargeInput);
              if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10000) {
                setDeliveryMsg('Enter a valid amount between 0 and 10000.');
                return;
              }
              void (async () => {
                setSavingDelivery(true);
                setDeliveryMsg('');
                try {
                  await onUpdateDeliveryCharge(Math.round(parsed));
                  setDeliveryMsg('Delivery charge updated!');
                  window.setTimeout(() => setDeliveryMsg(''), 2500);
                } finally {
                  setSavingDelivery(false);
                }
              })();
            }}
            className="flex w-full flex-wrap items-center gap-2 sm:w-auto"
          >
            <label htmlFor="reports-delivery-charge" className="sr-only">
              Delivery Charge (BDT)
            </label>
            <input
              id="reports-delivery-charge"
              type="number"
              min={0}
              max={10000}
              value={deliveryChargeInput}
              onChange={(e) => setDeliveryChargeInput(e.target.value)}
              className="min-h-[40px] w-28 border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-xs tabular-nums text-[#141414] focus:border-[#141414] focus:outline-none"
            />
            <button
              type="submit"
              disabled={savingDelivery}
              className="min-h-[40px] flex-1 bg-[#141414] px-4 text-xs font-semibold uppercase tracking-wider text-[#FAF8F4] hover:bg-[#2A2825] disabled:opacity-50 sm:flex-none"
            >
              {savingDelivery ? 'Saving...' : 'Update Charge'}
            </button>
            {deliveryMsg && (
              <span className="text-xs font-medium text-[#15803D]">
                {deliveryMsg}
              </span>
            )}
          </form>
        </div>
      </div>

      {/* Sales & Reports Header + CSV Export */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-[#E3DBD0] bg-white p-5">
        <div className="flex items-center gap-2.5">
          <BarChart3 className="h-5 w-5 text-[#8E6D35]" aria-hidden="true" />
          <div>
            <h3 className="font-display text-xl font-semibold text-[#141414]">
              Sales &amp; Business Reports
            </h3>
            <p className="text-xs text-[#5C574F]">
              Real database analytics distinguishing{' '}
              <strong className="text-[#141414]">Total Order Value</strong>{' '}
              (active non-cancelled orders) from{' '}
              <strong className="text-[#15803D]">Delivered Revenue</strong>.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => exportSalesReportToCsv(metrics)}
          className="inline-flex min-h-[40px] items-center gap-2 border border-[#141414] bg-white px-4 text-xs font-semibold uppercase tracking-wider text-[#141414] hover:bg-[#141414] hover:text-[#FAF8F4]"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Export Report CSV</span>
        </button>
      </div>

      {/* Sales KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="min-w-0 border border-[#E3DBD0] bg-white p-3.5 sm:p-4">
          <p className="text-[11px] uppercase tracking-wider text-[#5C574F]">
            Today&apos;s Orders
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-[#141414] sm:text-2xl">
            {metrics.todayOrders}
          </p>
          <p className="mt-1 break-words text-[11px] tabular-nums text-[#5C574F]">
            Order Value: {formatBdt(metrics.todaySales)}
          </p>
        </div>

        <div className="min-w-0 border border-[#E3DBD0] bg-white p-3.5 sm:p-4">
          <p className="text-[11px] uppercase tracking-wider text-[#5C574F]">
            Weekly Sales
          </p>
          <p className="mt-1 break-words text-lg font-bold tabular-nums text-[#141414] sm:text-2xl">
            {formatBdt(metrics.weeklySales)}
          </p>
          <p className="mt-1 break-words text-[11px] tabular-nums text-[#15803D]">
            Delivered: {formatBdt(metrics.weeklyDeliveredRevenue)}
          </p>
        </div>

        <div className="min-w-0 border border-[#E3DBD0] bg-white p-3.5 sm:p-4">
          <p className="text-[11px] uppercase tracking-wider text-[#5C574F]">
            Monthly Sales
          </p>
          <p className="mt-1 break-words text-lg font-bold tabular-nums text-[#141414] sm:text-2xl">
            {formatBdt(metrics.monthlySales)}
          </p>
          <p className="mt-1 break-words text-[11px] tabular-nums text-[#15803D]">
            Delivered: {formatBdt(metrics.monthlyDeliveredRevenue)}
          </p>
        </div>

        <div className="min-w-0 border border-[#E3DBD0] bg-white p-3.5 sm:p-4">
          <p className="text-[11px] uppercase tracking-wider text-[#15803D]">
            All-Time Delivered Revenue
          </p>
          <p className="mt-1 break-words text-lg font-bold tabular-nums text-[#15803D] sm:text-2xl">
            {formatBdt(metrics.deliveredRevenue)}
          </p>
          <p className="mt-1 break-words text-[11px] tabular-nums text-[#5C574F]">
            Total Order Value: {formatBdt(metrics.totalOrderValue)}
          </p>
        </div>
      </div>

      {/* 4 Real-Data Charts */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Chart 1: Daily Orders (Last 14 Days) */}
        <div className="min-w-0 border border-[#E3DBD0] bg-white p-4 sm:p-5">
          <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#141414]">
            Daily Orders (Last 14 Days)
          </h4>
          <p className="mt-0.5 text-[11px] text-[#5C574F]">
            Order volume per day from live database records
          </p>

          <div className="mt-4 flex h-44 items-end gap-1 border-b border-[#E3DBD0] pt-4 sm:gap-1.5">
            {metrics.dailyOrdersSeries.map((day) => {
              const heightPct = Math.round(
                (day.ordersCount / maxDailyOrders) * 100,
              );
              return (
                <div
                  key={day.dateKey}
                  className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                  title={`${day.label}: ${day.ordersCount} order(s) (${formatBdt(day.orderValue)})`}
                >
                  <span className="text-[9px] font-semibold tabular-nums text-[#5C574F] sm:text-[10px]">
                    {day.ordersCount > 0 ? day.ordersCount : ''}
                  </span>
                  <div
                    className="min-h-[3px] w-full bg-[#141414] transition-opacity group-hover:opacity-80"
                    style={{
                      height: `${day.ordersCount > 0 ? Math.max(10, heightPct) : 3}%`,
                      opacity: day.ordersCount > 0 ? 1 : 0.15,
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-[#7A746B]">
            <span>{metrics.dailyOrdersSeries[0]?.label}</span>
            <span>{metrics.dailyOrdersSeries[6]?.label}</span>
            <span>
              {
                metrics.dailyOrdersSeries[metrics.dailyOrdersSeries.length - 1]
                  ?.label
              }
            </span>
          </div>
        </div>

        {/* Chart 2: Monthly Sales (Order Value vs Delivered Revenue) */}
        <div className="min-w-0 border border-[#E3DBD0] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#141414]">
                Monthly Sales (Last 6 Months)
              </h4>
              <p className="mt-0.5 text-[11px] text-[#5C574F]">
                Active Order Value vs Delivered Revenue
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 bg-[#8E6D35]" />
                Order Value
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 bg-[#15803D]" />
                Delivered
              </span>
            </div>
          </div>

          <div className="mt-4 flex h-44 items-end gap-1.5 border-b border-[#E3DBD0] pt-4 sm:gap-3">
            {metrics.monthlySalesSeries.map((month) => {
              const orderPct = Math.round(
                (month.orderValue / maxMonthlyVal) * 100,
              );
              const delivPct = Math.round(
                (month.deliveredRevenue / maxMonthlyVal) * 100,
              );
              return (
                <div
                  key={month.monthKey}
                  className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                  title={`${month.label}: Order Value ${formatBdt(month.orderValue)} | Delivered ${formatBdt(month.deliveredRevenue)}`}
                >
                  <div className="flex h-36 w-full items-end justify-center gap-0.5 sm:gap-1">
                    <div
                      className="w-1/2 max-w-[18px] bg-[#8E6D35]"
                      style={{
                        height: `${month.orderValue > 0 ? Math.max(8, orderPct) : 2}%`,
                        opacity: month.orderValue > 0 ? 1 : 0.15,
                      }}
                    />
                    <div
                      className="w-1/2 max-w-[18px] bg-[#15803D]"
                      style={{
                        height: `${month.deliveredRevenue > 0 ? Math.max(8, delivPct) : 2}%`,
                        opacity: month.deliveredRevenue > 0 ? 1 : 0.15,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex justify-between gap-1 text-[9px] text-[#5C574F] sm:text-[10px]">
            {metrics.monthlySalesSeries.map((m) => (
              <span key={m.monthKey} className="min-w-0 flex-1 truncate text-center">
                {m.label}
              </span>
            ))}
          </div>
        </div>

        {/* Chart 3: Order Status Distribution */}
        <div className="min-w-0 border border-[#E3DBD0] bg-white p-4 sm:p-5">
          <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#141414]">
            Order Status Distribution ({metrics.totalOrders})
          </h4>
          <p className="mt-0.5 text-[11px] text-[#5C574F]">
            Breakdown across all 7 order lifecycle statuses
          </p>

          <div className="mt-4 space-y-2.5">
            {metrics.statusDistribution.map((entry) => {
              const pct =
                metrics.totalOrders > 0
                  ? Math.round((entry.count / totalStatusOrders) * 100)
                  : 0;
              const style = ORDER_STATUS_BADGE_STYLES[entry.status];
              return (
                <div key={entry.status} className="text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#141414]">
                      {entry.status}
                    </span>
                    <span className="tabular-nums text-[#5C574F]">
                      {entry.count} ({pct}%)
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 w-full bg-[#EFE9DF]">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: style.bar,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 4: Best Selling Products */}
        <div className="min-w-0 border border-[#E3DBD0] bg-white p-4 sm:p-5">
          <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#141414]">
            Best Selling Products
          </h4>
          <p className="mt-0.5 text-[11px] text-[#5C574F]">
            Ranked by real customer units ordered (excluding cancelled/returned)
          </p>

          {metrics.bestSellingProducts.length === 0 ? (
            <div className="mt-6 border border-[#EFE9DF] bg-[#FAF8F4] p-6 text-center text-xs text-[#5C574F]">
              No active customer orders recorded yet. Best selling products will
              chart automatically as orders arrive.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {metrics.bestSellingProducts.slice(0, 6).map((item) => {
                const pct = Math.round(
                  (item.unitsSold / maxBestSellerUnits) * 100,
                );
                return (
                  <div key={item.productId || item.productName} className="text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-[#141414]">
                        {item.productName}
                      </span>
                      <span className="shrink-0 tabular-nums text-[#5C574F]">
                        <strong className="text-[#141414]">
                          {item.unitsSold}
                        </strong>{' '}
                        units · {formatBdt(item.orderValue)}
                      </span>
                    </div>
                    <div className="mt-1 h-2.5 w-full bg-[#EFE9DF]">
                      <div
                        className="h-full bg-[#141414]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

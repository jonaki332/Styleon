import { CategoryDefinition, Product } from '../data/catalog';
import { normalizeBangladeshMobile } from './checkout';
import {
  LOW_STOCK_THRESHOLD,
  ORDER_STATUSES,
  OrderStatus,
  StoredOrder,
} from './orders';

export const ORDER_STATUS_BADGE_STYLES: Record<
  OrderStatus,
  { badge: string; bar: string }
> = {
  Pending: {
    badge: 'border-[#B89352]/40 bg-[#FEF9EC] text-[#8E6D35]',
    bar: '#B89352',
  },
  Confirmed: {
    badge: 'border-[#1D4ED8]/30 bg-[#EFF6FF] text-[#1D4ED8]',
    bar: '#1D4ED8',
  },
  Processing: {
    badge: 'border-[#7C3AED]/30 bg-[#F5F3FF] text-[#6D28D9]',
    bar: '#7C3AED',
  },
  Shipped: {
    badge: 'border-[#0369A1]/30 bg-[#F0F9FF] text-[#0369A1]',
    bar: '#0369A1',
  },
  Delivered: {
    badge: 'border-[#15803D]/30 bg-[#F0FDF4] text-[#15803D]',
    bar: '#15803D',
  },
  Cancelled: {
    badge: 'border-[#9B2C2C]/30 bg-[#FFF5F5] text-[#9B2C2C]',
    bar: '#9B2C2C',
  },
  Returned: {
    badge: 'border-[#5C574F]/35 bg-[#EFE9DF] text-[#5C574F]',
    bar: '#5C574F',
  },
};

export interface CustomerRecord {
  mobileNumber: string;
  customerName: string;
  district: string;
  upazila: string;
  fullAddress: string;
  totalOrders: number;
  activeOrdersCount: number;
  totalPurchaseAmount: number;
  deliveredPurchaseAmount: number;
  lastOrderDate: number;
  orders: StoredOrder[];
}

export function buildCustomerDirectory(orders: StoredOrder[]): CustomerRecord[] {
  const byMobile = new Map<string, CustomerRecord>();

  // Sort newest first so latest customer details take precedence
  const sortedOrders = [...orders].sort((a, b) => b.createdAt - a.createdAt);

  for (const order of sortedOrders) {
    const mobile = normalizeBangladeshMobile(order.mobileNumber) || order.mobileNumber;
    const isActiveSale =
      order.status !== 'Cancelled' && order.status !== 'Returned';
    const isDelivered = order.status === 'Delivered';

    const existing = byMobile.get(mobile);
    if (!existing) {
      byMobile.set(mobile, {
        mobileNumber: mobile,
        customerName: order.customerName,
        district: order.district,
        upazila: order.upazila,
        fullAddress: order.fullAddress,
        totalOrders: 1,
        activeOrdersCount: isActiveSale ? 1 : 0,
        totalPurchaseAmount: isActiveSale ? order.grandTotal : 0,
        deliveredPurchaseAmount: isDelivered ? order.grandTotal : 0,
        lastOrderDate: order.createdAt,
        orders: [order],
      });
    } else {
      existing.totalOrders += 1;
      if (isActiveSale) {
        existing.activeOrdersCount += 1;
        existing.totalPurchaseAmount += order.grandTotal;
      }
      if (isDelivered) {
        existing.deliveredPurchaseAmount += order.grandTotal;
      }
      if (order.createdAt > existing.lastOrderDate) {
        existing.lastOrderDate = order.createdAt;
        existing.customerName = order.customerName;
        existing.district = order.district;
        existing.upazila = order.upazila;
        existing.fullAddress = order.fullAddress;
      }
      existing.orders.push(order);
    }
  }

  return Array.from(byMobile.values()).sort(
    (a, b) => b.lastOrderDate - a.lastOrderDate,
  );
}

export interface DailySeriesPoint {
  dateKey: string;
  label: string;
  ordersCount: number;
  orderValue: number;
  deliveredRevenue: number;
}

export interface MonthlySeriesPoint {
  monthKey: string;
  label: string;
  ordersCount: number;
  orderValue: number;
  deliveredRevenue: number;
}

export interface BestSellerStat {
  productId: string;
  productName: string;
  unitsSold: number;
  orderValue: number;
  deliveredRevenue: number;
}

export interface BusinessMetrics {
  totalProducts: number;
  totalCategories: number;
  totalOrders: number;
  pendingOrders: number;
  confirmedOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  totalCustomers: number;
  lowStockProducts: Product[];
  outOfStockProducts: Product[];
  totalOrderValue: number;
  deliveredRevenue: number;
  todayOrders: number;
  todaySales: number;
  todayDeliveredRevenue: number;
  weeklySales: number;
  weeklyDeliveredRevenue: number;
  monthlySales: number;
  monthlyDeliveredRevenue: number;
  dailyOrdersSeries: DailySeriesPoint[];
  monthlySalesSeries: MonthlySeriesPoint[];
  statusDistribution: Array<{ status: OrderStatus; count: number }>;
  bestSellingProducts: BestSellerStat[];
}

function formatDayKey(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatMonthKey(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export function computeBusinessMetrics(
  orders: StoredOrder[],
  products: Product[],
  categories: CategoryDefinition[],
  nowTs: number = Date.now(),
): BusinessMetrics {
  const customers = buildCustomerDirectory(orders);

  const lowStockProducts = products.filter(
    (p) =>
      typeof p.stockQuantity === 'number' &&
      p.stockQuantity > 0 &&
      p.stockQuantity <= LOW_STOCK_THRESHOLD,
  );
  const outOfStockProducts = products.filter(
    (p) => typeof p.stockQuantity === 'number' && p.stockQuantity <= 0,
  );

  const startOfToday = new Date(nowTs);
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const weekMs = todayMs - 6 * 24 * 60 * 60 * 1000;
  const startOfMonth = new Date(nowTs);
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const monthMs = startOfMonth.getTime();

  const statusCounts: Record<OrderStatus, number> = {
    Pending: 0,
    Confirmed: 0,
    Processing: 0,
    Shipped: 0,
    Delivered: 0,
    Cancelled: 0,
    Returned: 0,
  };

  let totalOrderValue = 0;
  let deliveredRevenue = 0;
  let todayOrders = 0;
  let todaySales = 0;
  let todayDeliveredRevenue = 0;
  let weeklySales = 0;
  let weeklyDeliveredRevenue = 0;
  let monthlySales = 0;
  let monthlyDeliveredRevenue = 0;

  const bestMap = new Map<string, BestSellerStat>();

  for (const order of orders) {
    statusCounts[order.status] = (statusCounts[order.status] ?? 0) + 1;

    const isCancelledOrReturned =
      order.status === 'Cancelled' || order.status === 'Returned';
    const isDelivered = order.status === 'Delivered';

    if (!isCancelledOrReturned) {
      totalOrderValue += order.grandTotal;
      for (const item of order.items) {
        const key = item.productId || item.productName;
        const lineTotal = item.unitPriceBdt * item.quantity;
        const prev = bestMap.get(key);
        if (!prev) {
          bestMap.set(key, {
            productId: item.productId,
            productName: item.productName,
            unitsSold: item.quantity,
            orderValue: lineTotal,
            deliveredRevenue: isDelivered ? lineTotal : 0,
          });
        } else {
          prev.unitsSold += item.quantity;
          prev.orderValue += lineTotal;
          if (isDelivered) prev.deliveredRevenue += lineTotal;
        }
      }
    }

    if (isDelivered) {
      deliveredRevenue += order.grandTotal;
    }

    if (order.createdAt >= todayMs) {
      todayOrders += 1;
      if (!isCancelledOrReturned) todaySales += order.grandTotal;
      if (isDelivered) todayDeliveredRevenue += order.grandTotal;
    }

    if (order.createdAt >= weekMs) {
      if (!isCancelledOrReturned) weeklySales += order.grandTotal;
      if (isDelivered) weeklyDeliveredRevenue += order.grandTotal;
    }

    if (order.createdAt >= monthMs) {
      if (!isCancelledOrReturned) monthlySales += order.grandTotal;
      if (isDelivered) monthlyDeliveredRevenue += order.grandTotal;
    }
  }

  // Last 14 days Daily Orders series
  const dailyMap = new Map<string, DailySeriesPoint>();
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(todayMs - i * 24 * 60 * 60 * 1000);
    const key = formatDayKey(d.getTime());
    dailyMap.set(key, {
      dateKey: key,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      ordersCount: 0,
      orderValue: 0,
      deliveredRevenue: 0,
    });
  }

  for (const order of orders) {
    const key = formatDayKey(order.createdAt);
    const point = dailyMap.get(key);
    if (!point) continue;
    point.ordersCount += 1;
    if (order.status !== 'Cancelled' && order.status !== 'Returned') {
      point.orderValue += order.grandTotal;
    }
    if (order.status === 'Delivered') {
      point.deliveredRevenue += order.grandTotal;
    }
  }

  // Last 6 months Monthly Sales series
  const monthlyMap = new Map<string, MonthlySeriesPoint>();
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(nowTs);
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = formatMonthKey(d.getTime());
    monthlyMap.set(key, {
      monthKey: key,
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      ordersCount: 0,
      orderValue: 0,
      deliveredRevenue: 0,
    });
  }

  for (const order of orders) {
    const key = formatMonthKey(order.createdAt);
    const point = monthlyMap.get(key);
    if (!point) continue;
    point.ordersCount += 1;
    if (order.status !== 'Cancelled' && order.status !== 'Returned') {
      point.orderValue += order.grandTotal;
    }
    if (order.status === 'Delivered') {
      point.deliveredRevenue += order.grandTotal;
    }
  }

  const bestSellingProducts = Array.from(bestMap.values()).sort(
    (a, b) => b.unitsSold - a.unitsSold,
  );

  return {
    totalProducts: products.length,
    totalCategories: categories.length,
    totalOrders: orders.length,
    pendingOrders: statusCounts.Pending,
    confirmedOrders: statusCounts.Confirmed,
    processingOrders: statusCounts.Processing,
    shippedOrders: statusCounts.Shipped,
    deliveredOrders: statusCounts.Delivered,
    cancelledOrders: statusCounts.Cancelled,
    returnedOrders: statusCounts.Returned,
    totalCustomers: customers.length,
    lowStockProducts,
    outOfStockProducts,
    totalOrderValue,
    deliveredRevenue,
    todayOrders,
    todaySales,
    todayDeliveredRevenue,
    weeklySales,
    weeklyDeliveredRevenue,
    monthlySales,
    monthlyDeliveredRevenue,
    dailyOrdersSeries: Array.from(dailyMap.values()),
    monthlySalesSeries: Array.from(monthlyMap.values()),
    statusDistribution: ORDER_STATUSES.map((status) => ({
      status,
      count: statusCounts[status],
    })),
    bestSellingProducts,
  };
}

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function triggerCsvDownload(filename: string, rows: unknown[][]): void {
  const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportOrdersToCsv(orders: StoredOrder[]): void {
  const header = [
    'Order ID',
    'Order Date',
    'Status',
    'Customer Name',
    'Phone Number',
    'District',
    'Upazila',
    'Full Delivery Address',
    'Nearby Landmark',
    'Instructions',
    'Products',
    'Total Quantity',
    'Product Subtotal (BDT)',
    'Discount (BDT)',
    'Delivery Charge (BDT)',
    'Total Amount (BDT)',
    'Payment Method',
  ];

  const rows = orders.map((order) => {
    const productSummary = order.items
      .map(
        (i) =>
          `${i.productName} (${i.size}/${i.color}) x${i.quantity} @ ${i.unitPriceBdt}`,
      )
      .join(' | ');
    const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
    return [
      order.id,
      new Date(order.createdAt).toISOString(),
      order.status,
      order.customerName,
      order.mobileNumber,
      order.district,
      order.upazila,
      order.fullAddress,
      order.nearbyLandmark ?? '',
      order.deliveryInstructions ?? '',
      productSummary,
      totalQty,
      order.productSubtotal,
      order.discountAmount ?? 0,
      order.deliveryCharge,
      order.grandTotal,
      order.paymentMethod || 'Cash on Delivery (COD)',
    ];
  });

  triggerCsvDownload(
    `styleon-orders-${new Date().toISOString().slice(0, 10)}.csv`,
    [header, ...rows],
  );
}

export function exportSalesReportToCsv(metrics: BusinessMetrics): void {
  const rows: unknown[][] = [
    ['STYLEON Sales & Business Report', new Date().toISOString()],
    [],
    ['Metric', 'Value'],
    ["Today's Orders", metrics.todayOrders],
    ["Today's Sales (Total Order Value BDT)", metrics.todaySales],
    ["Today's Delivered Revenue (BDT)", metrics.todayDeliveredRevenue],
    ['Weekly Sales (Total Order Value BDT)', metrics.weeklySales],
    ['Weekly Delivered Revenue (BDT)', metrics.weeklyDeliveredRevenue],
    ['Monthly Sales (Total Order Value BDT)', metrics.monthlySales],
    ['Monthly Delivered Revenue (BDT)', metrics.monthlyDeliveredRevenue],
    ['All-Time Total Orders', metrics.totalOrders],
    ['Delivered Orders', metrics.deliveredOrders],
    ['Pending Orders', metrics.pendingOrders],
    ['Cancelled Orders', metrics.cancelledOrders],
    ['All-Time Total Order Value (BDT)', metrics.totalOrderValue],
    ['All-Time Delivered Revenue (BDT)', metrics.deliveredRevenue],
    ['Unique Customers', metrics.totalCustomers],
    [],
    ['Monthly Breakdown', 'Orders', 'Order Value (BDT)', 'Delivered Revenue (BDT)'],
    ...metrics.monthlySalesSeries.map((m) => [
      m.label,
      m.ordersCount,
      m.orderValue,
      m.deliveredRevenue,
    ]),
    [],
    ['Best Selling Products', 'Units Sold', 'Order Value (BDT)', 'Delivered Revenue (BDT)'],
    ...metrics.bestSellingProducts.map((p) => [
      p.productName,
      p.unitsSold,
      p.orderValue,
      p.deliveredRevenue,
    ]),
  ];

  triggerCsvDownload(
    `styleon-sales-report-${new Date().toISOString().slice(0, 10)}.csv`,
    rows,
  );
}

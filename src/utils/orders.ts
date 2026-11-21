export const ORDERS_STORAGE_KEY = 'styleon_orders_v1';

export const ORDER_STATUSES = [
  'Pending',
  'Confirmed',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
  'Returned',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const LOW_STOCK_THRESHOLD = 5;

export interface OrderStatusHistoryEntry {
  status: OrderStatus;
  changedAt: number;
  note?: string;
}

export interface StoredOrderItem {
  productId: string;
  productName: string;
  productImage?: string;
  size: string;
  color: string;
  quantity: number;
  regularPriceBdt?: number;
  unitPriceBdt: number;
}

export interface StoredOrder {
  id: string;
  createdAt: number;
  updatedAt?: number;
  customerName: string;
  mobileNumber: string;
  district: string;
  upazila: string;
  fullAddress: string;
  nearbyLandmark?: string;
  deliveryInstructions?: string;
  paymentMethod: 'Cash on Delivery (COD)';
  items: StoredOrderItem[];
  productSubtotal: number;
  discountAmount?: number;
  deliveryCharge: number;
  grandTotal: number;
  status: OrderStatus;
  statusHistory?: OrderStatusHistoryEntry[];
  stockDeductedByProduct?: Record<string, number>;
  stockRestored?: boolean;
  clientRequestId?: string;
}

export interface StockHistoryEntry {
  id: string;
  timestamp: number;
  productId: string;
  productName: string;
  type: 'order_deduct' | 'order_restore' | 'manual_adjustment';
  delta: number;
  previousStock: number | null;
  newStock: number | null;
  orderId?: string;
  note?: string;
}

export type AdminNotificationType =
  | 'new_order'
  | 'order_cancelled'
  | 'low_stock'
  | 'out_of_stock';

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
  orderId?: string;
  productId?: string;
}

export function loadStoredOrders(): StoredOrder[] {
  try {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredOrder[]) : [];
  } catch {
    return [];
  }
}

export function saveStoredOrders(orders: StoredOrder[]): void {
  try {
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

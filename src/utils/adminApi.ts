import { CategoryDefinition, Product } from '../data/catalog';
import {
  AdminNotification,
  OrderStatus,
  StockHistoryEntry,
  StoredOrder,
} from './orders';

const ADMIN_SESSION_TOKEN_KEY = 'styleon_admin_session_token_v1';

export interface AdminSessionStatus {
  authenticated: boolean;
  expiresAt?: number;
  configured?: boolean;
  token?: string;
}

export interface StorefrontResponse {
  products: Product[];
  categories: CategoryDefinition[];
  bestSellerProductIds: string[];
  deliveryChargeBdt: number;
}

export interface AdminCatalogResponse {
  products: Product[];
  categories: CategoryDefinition[];
  orders: StoredOrder[];
  deliveryChargeBdt: number;
  stockHistory: StockHistoryEntry[];
  notifications: AdminNotification[];
}

export interface UpdateOrderCustomerPayload {
  customerName: string;
  mobileNumber: string;
  district: string;
  upazila: string;
  fullAddress: string;
  nearbyLandmark?: string;
  deliveryInstructions?: string;
}

export interface CreateOrderPayload {
  customerName: string;
  mobileNumber: string;
  district: string;
  upazila: string;
  fullAddress: string;
  nearbyLandmark?: string;
  deliveryInstructions?: string;
  clientRequestId: string;
  items: Array<{
    productId: string;
    productImage?: string;
    size: string;
    color: string;
    quantity: number;
  }>;
}

export class AdminApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getStoredSessionToken(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

function setStoredSessionToken(token: string | null): void {
  try {
    if (token) {
      sessionStorage.setItem(ADMIN_SESSION_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(ADMIN_SESSION_TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

function buildAdminHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const token = getStoredSessionToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function parseResponse<T>(
  res: Response,
  options: { clearAuthOn401?: boolean } = {},
): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    if (options.clearAuthOn401 && res.status === 401) {
      setStoredSessionToken(null);
    }
    throw new AdminApiError(
      data.error || `Request failed (${res.status})`,
      res.status,
    );
  }
  return data as T;
}

export async function fetchPublicStorefront(): Promise<StorefrontResponse> {
  const res = await fetch('/api/storefront', { credentials: 'include' });
  return parseResponse<StorefrontResponse>(res);
}

export async function submitPublicOrder(
  payload: CreateOrderPayload,
): Promise<StoredOrder> {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const data = await parseResponse<{ order: StoredOrder }>(res);
  return data.order;
}

export async function saveAdminDeliveryCharge(
  deliveryChargeBdt: number,
): Promise<{ deliveryChargeBdt: number }> {
  const res = await fetch('/api/admin/settings', {
    method: 'PUT',
    headers: buildAdminHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify({ deliveryChargeBdt }),
  });
  return parseResponse<{ deliveryChargeBdt: number }>(res, {
    clearAuthOn401: true,
  });
}

export async function checkAdminSession(): Promise<AdminSessionStatus> {
  const res = await fetch('/api/admin/session', {
    headers: buildAdminHeaders(),
    credentials: 'include',
    cache: 'no-store',
  });
  const data = await parseResponse<AdminSessionStatus>(res);
  if (!data.authenticated) {
    setStoredSessionToken(null);
  }
  return data;
}

export async function loginAdmin(password: string): Promise<AdminSessionStatus> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ password }),
  });
  const data = await parseResponse<AdminSessionStatus>(res);
  if (data.authenticated && data.token) {
    setStoredSessionToken(data.token);
  }
  return data;
}

export async function logoutAdmin(): Promise<void> {
  try {
    const res = await fetch('/api/admin/logout', {
      method: 'POST',
      headers: buildAdminHeaders(),
      credentials: 'include',
    });
    await parseResponse<{ authenticated: boolean }>(res);
  } finally {
    setStoredSessionToken(null);
  }
}

export async function fetchAdminCatalog(): Promise<AdminCatalogResponse> {
  const res = await fetch('/api/admin/catalog', {
    headers: buildAdminHeaders(),
    credentials: 'include',
    cache: 'no-store',
  });
  return parseResponse<AdminCatalogResponse>(res, { clearAuthOn401: true });
}

export interface AdminProductMutationResponse {
  product: Product;
  products: Product[];
  stockHistory?: StockHistoryEntry[];
  notifications?: AdminNotification[];
}

export async function createAdminProduct(
  product: Product,
): Promise<AdminProductMutationResponse> {
  const res = await fetch('/api/admin/products', {
    method: 'POST',
    headers: buildAdminHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(product),
  });
  return parseResponse<AdminProductMutationResponse>(res, {
    clearAuthOn401: true,
  });
}

export async function updateAdminProduct(
  product: Product,
): Promise<AdminProductMutationResponse> {
  const res = await fetch(
    `/api/admin/products/${encodeURIComponent(product.id)}`,
    {
      method: 'PUT',
      headers: buildAdminHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(product),
    },
  );
  return parseResponse<AdminProductMutationResponse>(res, {
    clearAuthOn401: true,
  });
}

export async function updateAdminProductStock(
  productId: string,
  stockQuantity: number | null,
  note?: string,
): Promise<AdminProductMutationResponse> {
  const res = await fetch(
    `/api/admin/products/${encodeURIComponent(productId)}/stock`,
    {
      method: 'PATCH',
      headers: buildAdminHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ stockQuantity, note }),
    },
  );
  return parseResponse<AdminProductMutationResponse>(res, {
    clearAuthOn401: true,
  });
}

export async function deleteAdminProduct(
  productId: string,
): Promise<{ products: Product[] }> {
  const res = await fetch(
    `/api/admin/products/${encodeURIComponent(productId)}`,
    {
      method: 'DELETE',
      headers: buildAdminHeaders(),
      credentials: 'include',
    },
  );
  return parseResponse<{ products: Product[] }>(res, { clearAuthOn401: true });
}

export async function importAdminProducts(
  products: Product[],
): Promise<{ products: Product[] }> {
  const res = await fetch('/api/admin/products/import', {
    method: 'POST',
    headers: buildAdminHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify({ products }),
  });
  return parseResponse<{ products: Product[] }>(res, { clearAuthOn401: true });
}

export async function resetAdminProducts(): Promise<{ products: Product[] }> {
  const res = await fetch('/api/admin/products/reset', {
    method: 'POST',
    headers: buildAdminHeaders(),
    credentials: 'include',
  });
  return parseResponse<{ products: Product[] }>(res, { clearAuthOn401: true });
}

export async function saveAdminCategories(
  categories: CategoryDefinition[],
): Promise<{ categories: CategoryDefinition[] }> {
  const res = await fetch('/api/admin/categories', {
    method: 'PUT',
    headers: buildAdminHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify({ categories }),
  });
  return parseResponse<{ categories: CategoryDefinition[] }>(res, {
    clearAuthOn401: true,
  });
}

export async function resetAdminCategories(): Promise<{
  categories: CategoryDefinition[];
}> {
  const res = await fetch('/api/admin/categories/reset', {
    method: 'POST',
    headers: buildAdminHeaders(),
    credentials: 'include',
  });
  return parseResponse<{ categories: CategoryDefinition[] }>(res, {
    clearAuthOn401: true,
  });
}

export interface AdminOrderMutationResponse {
  order?: StoredOrder;
  orders: StoredOrder[];
  products?: Product[];
  stockHistory?: StockHistoryEntry[];
  notifications?: AdminNotification[];
}

export async function updateAdminOrderStatus(
  orderId: string,
  status: OrderStatus,
  note?: string,
): Promise<AdminOrderMutationResponse> {
  const res = await fetch(
    `/api/admin/orders/${encodeURIComponent(orderId)}`,
    {
      method: 'PATCH',
      headers: buildAdminHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ status, note }),
    },
  );
  return parseResponse<AdminOrderMutationResponse>(res, {
    clearAuthOn401: true,
  });
}

export async function updateAdminOrderCustomer(
  orderId: string,
  payload: UpdateOrderCustomerPayload,
): Promise<{ order: StoredOrder; orders: StoredOrder[] }> {
  const res = await fetch(
    `/api/admin/orders/${encodeURIComponent(orderId)}/customer`,
    {
      method: 'PUT',
      headers: buildAdminHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(payload),
    },
  );
  return parseResponse<{ order: StoredOrder; orders: StoredOrder[] }>(res, {
    clearAuthOn401: true,
  });
}

export async function deleteAdminOrder(
  orderId: string,
): Promise<AdminOrderMutationResponse> {
  const res = await fetch(
    `/api/admin/orders/${encodeURIComponent(orderId)}`,
    {
      method: 'DELETE',
      headers: buildAdminHeaders(),
      credentials: 'include',
    },
  );
  return parseResponse<AdminOrderMutationResponse>(res, {
    clearAuthOn401: true,
  });
}

export async function markAdminNotificationsRead(
  opts: { id?: string; all?: boolean },
): Promise<{ notifications: AdminNotification[] }> {
  const res = await fetch('/api/admin/notifications/read', {
    method: 'POST',
    headers: buildAdminHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(opts),
  });
  return parseResponse<{ notifications: AdminNotification[] }>(res, {
    clearAuthOn401: true,
  });
}

import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  findDistrictEntry,
  isValidDistrictUpazila,
} from './src/data/bangladeshLocations.ts';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_PRODUCTS,
  FLAT_DELIVERY_CHARGE_BDT,
  getEffectivePrice,
  normalizeProduct,
  type CategoryDefinition,
  type Product,
} from './src/data/catalog.ts';
import {
  LOW_STOCK_THRESHOLD,
  ORDER_STATUSES,
  type AdminNotification,
  type OrderStatus,
  type StockHistoryEntry,
  type StoredOrder,
} from './src/utils/orders.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const SESSION_COOKIE_NAME = 'styleon_admin_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const LOGIN_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_LOGIN_FAILURES = 8;
const ORDER_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ORDERS_PER_WINDOW = 25;

const BUNDLED_DATA_DIR = path.join(__dirname, 'data');
const DATA_DIR = process.env.DATA_DIR?.trim()
  ? path.resolve(process.env.DATA_DIR.trim())
  : BUNDLED_DATA_DIR;
const BUNDLED_STORE_FILE = path.join(BUNDLED_DATA_DIR, 'store.json');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const SECRET_FILE = path.join(DATA_DIR, '.session_secret');

interface StoreData {
  products: Product[];
  categories: CategoryDefinition[];
  orders: StoredOrder[];
  deliveryChargeBdt: number;
  stockHistory: StockHistoryEntry[];
  notifications: AdminNotification[];
}

interface SessionPayload {
  jti: string;
  iat: number;
  exp: number;
  pwv: string;
}

const revokedTokenIds = new Map<string, number>();
const failedLoginAttempts = new Map<string, { count: number; resetAt: number }>();
const orderSubmissionsByIp = new Map<string, { count: number; resetAt: number }>();

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getSessionSecret(): string {
  const fromEnv = process.env.SESSION_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 16) {
    return fromEnv;
  }

  ensureDataDir();
  if (fs.existsSync(SECRET_FILE)) {
    try {
      const existing = fs.readFileSync(SECRET_FILE, 'utf8').trim();
      if (existing.length >= 32) return existing;
    } catch {
      // Regenerate below if unreadable
    }
  }

  const generated = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
  } catch {
    // Continue with in-memory secret if filesystem is read-only
  }
  return generated;
}

const SESSION_SECRET = getSessionSecret();

function getConfiguredAdminPassword(): string | null {
  const raw = process.env.ADMIN_PASSWORD;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sha256Buffer(input: string): Buffer {
  return crypto.createHash('sha256').update(input, 'utf8').digest();
}

function getPasswordFingerprint(password: string): string {
  return crypto
    .createHash('sha256')
    .update(password, 'utf8')
    .digest('hex')
    .slice(0, 16);
}

function verifyPasswordConstantTime(submitted: string, configured: string): boolean {
  const a = sha256Buffer(submitted);
  const b = sha256Buffer(configured);
  return crypto.timingSafeEqual(a, b);
}

function signToken(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [body, sig] = parts;
  if (!body || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(body)
    .digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as SessionPayload;
    if (
      !parsed ||
      typeof parsed.jti !== 'string' ||
      typeof parsed.exp !== 'number' ||
      typeof parsed.pwv !== 'string'
    ) {
      return null;
    }

    const now = Date.now();
    if (parsed.exp <= now) return null;
    if (revokedTokenIds.has(parsed.jti)) return null;

    const configured = getConfiguredAdminPassword();
    if (!configured) return null;
    if (parsed.pwv !== getPasswordFingerprint(configured)) return null;

    return parsed;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const rawVal = pair.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(rawVal);
    } catch {
      result[key] = rawVal;
    }
  }
  return result;
}

function isHttpsRequest(req: Request): boolean {
  if (req.secure) return true;
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (typeof forwardedProto === 'string') {
    if (forwardedProto.split(',')[0].trim().toLowerCase() === 'https') {
      return true;
    }
  }
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.startsWith('https://')) {
    return true;
  }
  const referer = req.headers.referer;
  if (typeof referer === 'string' && referer.startsWith('https://')) {
    return true;
  }
  return false;
}

function buildCookieOptions(req: Request): express.CookieOptions {
  const secure = isHttpsRequest(req);
  const options: express.CookieOptions & { partitioned?: boolean } = {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
  };
  if (secure) {
    options.partitioned = true;
  }
  return options;
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, buildCookieOptions(req));
}

function clearSessionCookie(req: Request, res: Response): void {
  const opts = buildCookieOptions(req);
  delete opts.maxAge;
  res.clearCookie(SESSION_COOKIE_NAME, opts);
}

function extractSessionToken(req: Request): string | undefined {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[SESSION_COOKIE_NAME]) {
    return cookies[SESSION_COOKIE_NAME];
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  return undefined;
}

function cleanupExpiredMaps(): void {
  const now = Date.now();
  for (const [jti, exp] of revokedTokenIds.entries()) {
    if (exp <= now) revokedTokenIds.delete(jti);
  }
  for (const [ip, entry] of failedLoginAttempts.entries()) {
    if (entry.resetAt <= now) failedLoginAttempts.delete(ip);
  }
  for (const [ip, entry] of orderSubmissionsByIp.entries()) {
    if (entry.resetAt <= now) orderSubmissionsByIp.delete(ip);
  }
}

function readStore(): StoreData {
  ensureDataDir();
  if (!fs.existsSync(STORE_FILE)) {
    if (STORE_FILE !== BUNDLED_STORE_FILE && fs.existsSync(BUNDLED_STORE_FILE)) {
      try {
        fs.copyFileSync(BUNDLED_STORE_FILE, STORE_FILE);
      } catch {
        // Fall through to default initialization if copy fails
      }
    }
  }
  if (!fs.existsSync(STORE_FILE)) {
    const initial: StoreData = {
      products: DEFAULT_PRODUCTS.map((p) => normalizeProduct(p)),
      categories: DEFAULT_CATEGORIES,
      orders: [],
      deliveryChargeBdt: FLAT_DELIVERY_CHARGE_BDT,
      stockHistory: [],
      notifications: [],
    };
    writeStore(initial);
    return initial;
  }

  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    const products = Array.isArray(parsed.products)
      ? parsed.products.map((p) => normalizeProduct(p as Product))
      : DEFAULT_PRODUCTS.map((p) => normalizeProduct(p));
    const categories =
      Array.isArray(parsed.categories) && parsed.categories.length > 0
        ? (parsed.categories as CategoryDefinition[])
        : DEFAULT_CATEGORIES;
    const orders = Array.isArray(parsed.orders)
      ? (parsed.orders as StoredOrder[])
      : [];
    const deliveryChargeBdt =
      typeof parsed.deliveryChargeBdt === 'number' &&
      Number.isFinite(parsed.deliveryChargeBdt) &&
      parsed.deliveryChargeBdt >= 0
        ? Math.round(parsed.deliveryChargeBdt)
        : FLAT_DELIVERY_CHARGE_BDT;
    const stockHistory = Array.isArray(parsed.stockHistory)
      ? (parsed.stockHistory as StockHistoryEntry[])
      : [];
    const notifications = Array.isArray(parsed.notifications)
      ? (parsed.notifications as AdminNotification[])
      : [];
    return {
      products,
      categories,
      orders,
      deliveryChargeBdt,
      stockHistory,
      notifications,
    };
  } catch {
    const fallback: StoreData = {
      products: DEFAULT_PRODUCTS.map((p) => normalizeProduct(p)),
      categories: DEFAULT_CATEGORIES,
      orders: [],
      deliveryChargeBdt: FLAT_DELIVERY_CHARGE_BDT,
      stockHistory: [],
      notifications: [],
    };
    return fallback;
  }
}

function writeStore(data: StoreData): void {
  ensureDataDir();
  const tmpFile = `${STORE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpFile, STORE_FILE);
}

function pushNotification(
  store: StoreData,
  entry: Omit<AdminNotification, 'id' | 'read'>,
): void {
  const notif: AdminNotification = {
    ...entry,
    id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    read: false,
  };
  store.notifications = [notif, ...store.notifications].slice(0, 150);
}

function pushStockHistory(
  store: StoreData,
  entry: Omit<StockHistoryEntry, 'id'>,
): void {
  const rec: StockHistoryEntry = {
    ...entry,
    id: `stk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
  };
  store.stockHistory = [rec, ...store.stockHistory].slice(0, 300);
}

function checkAndEmitStockAlerts(
  store: StoreData,
  product: Product,
  previousStock: number | null,
  now: number,
): void {
  if (typeof product.stockQuantity !== 'number') return;
  const current = product.stockQuantity;
  if (current === 0 && previousStock !== 0) {
    pushNotification(store, {
      type: 'out_of_stock',
      title: 'Out of Stock Alert',
      message: `"${product.name}" is now out of stock (0 remaining).`,
      createdAt: now,
      productId: product.id,
    });
  } else if (
    current > 0 &&
    current <= LOW_STOCK_THRESHOLD &&
    (previousStock === null || previousStock > LOW_STOCK_THRESHOLD || previousStock === 0)
  ) {
    pushNotification(store, {
      type: 'low_stock',
      title: 'Low Stock Warning',
      message: `"${product.name}" is running low (${current} left in stock).`,
      createdAt: now,
      productId: product.id,
    });
  }
}

function normalizeBdMobile(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('8801') && digits.length === 13) {
    return `0${digits.slice(3)}`;
  }
  return digits;
}

function computeBestSellerIds(
  products: Product[],
  orders: StoredOrder[],
): string[] {
  const qtyById = new Map<string, number>();
  const qtyByName = new Map<string, number>();

  for (const order of orders) {
    if (order.status === 'Cancelled' || order.status === 'Returned') continue;
    for (const item of order.items) {
      qtyById.set(
        item.productId,
        (qtyById.get(item.productId) ?? 0) + item.quantity,
      );
      const nameKey = item.productName.trim().toLowerCase();
      qtyByName.set(nameKey, (qtyByName.get(nameKey) ?? 0) + item.quantity);
    }
  }

  if (qtyById.size === 0 && qtyByName.size === 0) return [];

  return products
    .filter((p) => p.published)
    .map((p) => ({
      id: p.id,
      count:
        qtyById.get(p.id) ??
        qtyByName.get(p.name.trim().toLowerCase()) ??
        0,
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((entry) => entry.id);
}

function isSameOriginRequest(req: Request): boolean {
  const origin = req.headers.origin;
  if (typeof origin !== 'string' || !origin.trim()) return true;
  const hostHeader = req.get('x-forwarded-host') || req.get('host');
  if (!hostHeader) return false;
  const expectedHost = hostHeader.split(',')[0].trim().toLowerCase();
  try {
    return new URL(origin).host.toLowerCase() === expectedHost;
  } catch {
    return false;
  }
}

function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  const hasBearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ');
  if (
    !hasBearer &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase()) &&
    !isSameOriginRequest(req)
  ) {
    res.status(403).json({ error: 'Forbidden: cross-origin admin mutation blocked.' });
    return;
  }

  const token = extractSessionToken(req);
  const session = verifyToken(token);
  if (!session) {
    res.status(401).json({
      error: 'Unauthorized. Admin authentication required.',
    });
    return;
  }
  next();
}

async function startServer(): Promise<void> {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  app.use(express.json({ limit: '25mb' }));
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // Ensure initial store exists on boot
  readStore();

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // --- Public Storefront Endpoints ---
  app.get('/api/storefront', (_req, res) => {
    const store = readStore();
    const publishedProducts = store.products.filter((p) => p.published);
    const bestSellerProductIds = computeBestSellerIds(
      store.products,
      store.orders,
    );
    res.json({
      products: publishedProducts,
      categories: store.categories,
      bestSellerProductIds,
      deliveryChargeBdt: store.deliveryChargeBdt,
    });
  });

  app.post('/api/orders', (req, res) => {
    cleanupExpiredMaps();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const orderWindow = orderSubmissionsByIp.get(ip);
    const reqTime = Date.now();
    if (
      orderWindow &&
      orderWindow.resetAt > reqTime &&
      orderWindow.count >= MAX_ORDERS_PER_WINDOW
    ) {
      res.status(429).json({
        error: 'Too many order submissions. Please wait a few minutes and try again.',
      });
      return;
    }
    orderSubmissionsByIp.set(ip, {
      count:
        orderWindow && orderWindow.resetAt > reqTime ? orderWindow.count + 1 : 1,
      resetAt:
        orderWindow && orderWindow.resetAt > reqTime
          ? orderWindow.resetAt
          : reqTime + ORDER_WINDOW_MS,
    });

    const body = req.body as
      | {
          customerName?: string;
          mobileNumber?: string;
          district?: string;
          upazila?: string;
          fullAddress?: string;
          nearbyLandmark?: string;
          deliveryInstructions?: string;
          clientRequestId?: string;
          items?: Array<{
            productId?: string;
            productImage?: string;
            size?: string;
            color?: string;
            quantity?: number;
          }>;
        }
      | undefined;

    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Invalid order payload.' });
      return;
    }

    const customerName =
      typeof body.customerName === 'string' ? body.customerName.trim() : '';
    const rawMobile =
      typeof body.mobileNumber === 'string' ? body.mobileNumber.trim() : '';
    const digitsOnly = rawMobile.replace(/\D/g, '');
    const normalizedMobile =
      digitsOnly.startsWith('8801') && digitsOnly.length === 13
        ? `0${digitsOnly.slice(3)}`
        : digitsOnly;

    const districtInput =
      typeof body.district === 'string' ? body.district.trim() : '';
    const upazilaInput =
      typeof body.upazila === 'string' ? body.upazila.trim() : '';
    const fullAddress =
      typeof body.fullAddress === 'string' ? body.fullAddress.trim() : '';
    const nearbyLandmark =
      typeof body.nearbyLandmark === 'string' ? body.nearbyLandmark.trim() : '';
    const deliveryInstructions =
      typeof body.deliveryInstructions === 'string'
        ? body.deliveryInstructions.trim()
        : '';
    const clientRequestId =
      typeof body.clientRequestId === 'string'
        ? body.clientRequestId.trim()
        : '';

    if (customerName.length < 2) {
      res.status(400).json({ error: 'Please enter your full name.' });
      return;
    }

    if (!/^01[3-9]\d{8}$/.test(normalizedMobile)) {
      res.status(400).json({
        error:
          'Please enter a valid 11-digit Bangladesh mobile number (e.g. 017XXXXXXXX).',
      });
      return;
    }

    const districtEntry = findDistrictEntry(districtInput);
    if (!districtEntry) {
      res.status(400).json({ error: 'Please select a valid district in Bangladesh.' });
      return;
    }

    if (!upazilaInput || !isValidDistrictUpazila(districtEntry.district, upazilaInput)) {
      res.status(400).json({
        error: `Please select a valid upazila belonging to ${districtEntry.district}.`,
      });
      return;
    }

    if (fullAddress.length < 5) {
      res.status(400).json({
        error: 'Please enter your complete delivery address.',
      });
      return;
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ error: 'Your order must include at least one product.' });
      return;
    }

    const store = readStore();

    // Prevent duplicate order submission by clientRequestId
    if (clientRequestId) {
      const existingByReq = store.orders.find(
        (o) => o.clientRequestId && o.clientRequestId === clientRequestId,
      );
      if (existingByReq) {
        res.status(200).json({ order: existingByReq, deduplicated: true });
        return;
      }
    }

    // Prevent rapid accidental duplicate submission with matching mobile + item + address (within 60s)
    const now = Date.now();
    const firstReqItem = body.items[0];
    const recentDuplicate = store.orders.find(
      (o) =>
        now - o.createdAt < 60_000 &&
        o.mobileNumber === normalizedMobile &&
        o.fullAddress.toLowerCase() === fullAddress.toLowerCase() &&
        o.items.length === body.items!.length &&
        o.items[0]?.productId === String(firstReqItem?.productId || '') &&
        o.items[0]?.size === String(firstReqItem?.size || 'Standard') &&
        o.items[0]?.color === String(firstReqItem?.color || 'As Shown'),
    );
    if (recentDuplicate) {
      res.status(409).json({
        error: `A duplicate order (${recentDuplicate.id}) was already placed a moment ago. Please wait before submitting again.`,
      });
      return;
    }

    // Verify products, availability, stock & compute authoritative pricing on backend
    const requestedQtyByProduct = new Map<string, number>();
    const verifiedItems: StoredOrder['items'] = [];
    let regularSubtotal = 0;
    let productSubtotal = 0;

    for (const reqItem of body.items) {
      const prodId = String(reqItem?.productId || '').trim();
      const qty = Math.floor(Number(reqItem?.quantity) || 0);
      if (!prodId || qty < 1 || qty > 50) {
        res.status(400).json({ error: 'Invalid product or quantity in order.' });
        return;
      }

      const product = store.products.find((p) => p.id === prodId);
      if (!product || !product.published) {
        res.status(404).json({
          error: 'Selected product is currently unavailable.',
        });
        return;
      }

      const nextTotalRequested =
        (requestedQtyByProduct.get(product.id) ?? 0) + qty;
      requestedQtyByProduct.set(product.id, nextTotalRequested);

      if (typeof product.stockQuantity === 'number') {
        if (product.stockQuantity <= 0) {
          res.status(409).json({
            error: `Sorry, "${product.name}" is currently out of stock.`,
          });
          return;
        }
        if (nextTotalRequested > product.stockQuantity) {
          res.status(409).json({
            error: `Only ${product.stockQuantity} unit(s) of "${product.name}" are currently in stock.`,
          });
          return;
        }
      }

      const regularUnit = Math.round(product.priceBdt);
      const effectiveUnit = Math.round(getEffectivePrice(product));
      regularSubtotal += regularUnit * qty;
      productSubtotal += effectiveUnit * qty;

      verifiedItems.push({
        productId: product.id,
        productName: product.name,
        productImage:
          typeof reqItem?.productImage === 'string' && reqItem.productImage.trim()
            ? reqItem.productImage.trim()
            : product.images[0] || '',
        size: String(reqItem?.size || product.sizes[0] || 'Standard'),
        color: String(reqItem?.color || product.colors[0] || 'As Shown'),
        quantity: qty,
        regularPriceBdt: regularUnit,
        unitPriceBdt: effectiveUnit,
      });
    }

    // Generate unique Order ID
    const existingIds = new Set(store.orders.map((o) => o.id));
    let id = `STY-${Math.floor(100000 + Math.random() * 900000)}`;
    while (existingIds.has(id)) {
      id = `STY-${Math.floor(100000 + Math.random() * 900000)}`;
    }

    const deliveryCharge = store.deliveryChargeBdt ?? FLAT_DELIVERY_CHARGE_BDT;
    const discountAmount = Math.max(0, regularSubtotal - productSubtotal);
    const grandTotal = productSubtotal + deliveryCharge;

    // Record stock deducted per tracked product so cancellation restores safely without double restoration
    const stockDeductedByProduct: Record<string, number> = {};
    store.products = store.products.map((product) => {
      const orderedQty = requestedQtyByProduct.get(product.id);
      if (orderedQty && typeof product.stockQuantity === 'number') {
        const previousStock = product.stockQuantity;
        const newStock = Math.max(0, previousStock - orderedQty);
        stockDeductedByProduct[product.id] = orderedQty;
        const updatedProduct: Product = {
          ...product,
          stockQuantity: newStock,
          updatedAt: now,
        };
        pushStockHistory(store, {
          timestamp: now,
          productId: product.id,
          productName: product.name,
          type: 'order_deduct',
          delta: -orderedQty,
          previousStock,
          newStock,
          orderId: id,
          note: `Deducted for order ${id}`,
        });
        checkAndEmitStockAlerts(store, updatedProduct, previousStock, now);
        return updatedProduct;
      }
      return product;
    });

    const record: StoredOrder = {
      id,
      createdAt: now,
      updatedAt: now,
      customerName,
      mobileNumber: normalizedMobile,
      district: districtEntry.district,
      upazila: upazilaInput,
      fullAddress,
      nearbyLandmark: nearbyLandmark || undefined,
      deliveryInstructions: deliveryInstructions || undefined,
      paymentMethod: 'Cash on Delivery (COD)',
      items: verifiedItems,
      productSubtotal,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      deliveryCharge,
      grandTotal,
      status: 'Pending',
      statusHistory: [
        {
          status: 'Pending',
          changedAt: now,
          note: 'Order placed via website checkout',
        },
      ],
      stockDeductedByProduct:
        Object.keys(stockDeductedByProduct).length > 0
          ? stockDeductedByProduct
          : undefined,
      stockRestored: false,
      clientRequestId: clientRequestId || undefined,
    };

    pushNotification(store, {
      type: 'new_order',
      title: 'New Order Received',
      message: `${record.id} from ${record.customerName} (${record.district}) — ৳${record.grandTotal.toLocaleString('en-US')}`,
      createdAt: now,
      orderId: record.id,
    });

    store.orders = [record, ...store.orders];
    writeStore(store);
    res.status(201).json({ order: record });
  });

  // --- Admin Authentication Endpoints ---
  app.get('/api/admin/session', (req, res) => {
    const session = verifyToken(extractSessionToken(req));
    if (!session) {
      res.json({
        authenticated: false,
        configured: getConfiguredAdminPassword() !== null,
      });
      return;
    }
    res.json({
      authenticated: true,
      expiresAt: session.exp,
      configured: true,
    });
  });

  app.post('/api/admin/login', (req, res) => {
    cleanupExpiredMaps();

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const existingAttempts = failedLoginAttempts.get(ip);
    const now = Date.now();
    if (
      existingAttempts &&
      existingAttempts.resetAt > now &&
      existingAttempts.count >= MAX_LOGIN_FAILURES
    ) {
      res.status(429).json({
        error: 'Too many failed login attempts. Please wait a few minutes and try again.',
      });
      return;
    }

    const configuredPassword = getConfiguredAdminPassword();
    if (!configuredPassword) {
      res.status(503).json({
        error:
          'Server ADMIN_PASSWORD environment variable is not configured.',
      });
      return;
    }

    const submitted =
      typeof req.body?.password === 'string' ? req.body.password : '';

    if (!submitted || !verifyPasswordConstantTime(submitted, configuredPassword)) {
      const nextCount =
        existingAttempts && existingAttempts.resetAt > now
          ? existingAttempts.count + 1
          : 1;
      failedLoginAttempts.set(ip, {
        count: nextCount,
        resetAt:
          existingAttempts && existingAttempts.resetAt > now
            ? existingAttempts.resetAt
            : now + LOGIN_WINDOW_MS,
      });
      res.status(401).json({
        error: 'Incorrect Password. Please try again.',
      });
      return;
    }

    failedLoginAttempts.delete(ip);
    const expiresAt = now + SESSION_TTL_MS;
    const token = signToken({
      jti: crypto.randomUUID(),
      iat: now,
      exp: expiresAt,
      pwv: getPasswordFingerprint(configuredPassword),
    });

    setSessionCookie(req, res, token);
    res.json({ authenticated: true, expiresAt, token });
  });

  app.post('/api/admin/logout', (req, res) => {
    const session = verifyToken(extractSessionToken(req));
    if (session) {
      revokedTokenIds.set(session.jti, session.exp);
    }
    clearSessionCookie(req, res);
    res.json({ authenticated: false });
  });

  // --- Protected Admin Operations ---
  app.get('/api/admin/catalog', requireAdminAuth, (_req, res) => {
    const store = readStore();
    res.json(store);
  });

  app.get('/api/admin/notifications', requireAdminAuth, (_req, res) => {
    const store = readStore();
    res.json({ notifications: store.notifications });
  });

  app.post('/api/admin/notifications/read', requireAdminAuth, (req, res) => {
    const body = req.body as { id?: string; all?: boolean } | undefined;
    const store = readStore();
    if (body?.all) {
      store.notifications = store.notifications.map((n) => ({
        ...n,
        read: true,
      }));
    } else if (typeof body?.id === 'string' && body.id.trim()) {
      store.notifications = store.notifications.map((n) =>
        n.id === body.id!.trim() ? { ...n, read: true } : n,
      );
    }
    writeStore(store);
    res.json({ notifications: store.notifications });
  });

  app.put('/api/admin/settings', requireAdminAuth, (req, res) => {
    const rawCharge = req.body?.deliveryChargeBdt;
    if (
      typeof rawCharge !== 'number' ||
      !Number.isFinite(rawCharge) ||
      rawCharge < 0 ||
      rawCharge > 10000
    ) {
      res.status(400).json({ error: 'Invalid delivery charge amount.' });
      return;
    }
    const store = readStore();
    store.deliveryChargeBdt = Math.round(rawCharge);
    writeStore(store);
    res.json({ deliveryChargeBdt: store.deliveryChargeBdt });
  });

  app.post('/api/admin/products', requireAdminAuth, (req, res) => {
    const raw = req.body as Partial<Product> | undefined;
    if (
      !raw ||
      typeof raw.name !== 'string' ||
      !raw.name.trim() ||
      typeof raw.priceBdt !== 'number' ||
      !Number.isFinite(raw.priceBdt) ||
      raw.priceBdt <= 0
    ) {
      res.status(400).json({ error: 'Valid product name and price are required.' });
      return;
    }

    const now = Date.now();
    const store = readStore();
    const normalized = normalizeProduct({
      ...(raw as Product),
      id:
        typeof raw.id === 'string' && raw.id.trim()
          ? raw.id.trim()
          : `prod-${now.toString(36)}`,
      name: raw.name.trim(),
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
      updatedAt: now,
    });

    if (typeof normalized.stockQuantity === 'number') {
      pushStockHistory(store, {
        timestamp: now,
        productId: normalized.id,
        productName: normalized.name,
        type: 'manual_adjustment',
        delta: normalized.stockQuantity,
        previousStock: null,
        newStock: normalized.stockQuantity,
        note: 'Initial stock set on product creation',
      });
      checkAndEmitStockAlerts(store, normalized, null, now);
    }

    store.products = [
      normalized,
      ...store.products.filter((p) => p.id !== normalized.id),
    ];
    writeStore(store);
    res.status(201).json({
      product: normalized,
      products: store.products,
      stockHistory: store.stockHistory,
      notifications: store.notifications,
    });
  });

  app.put('/api/admin/products/:id', requireAdminAuth, (req, res) => {
    const targetId = req.params.id;
    const raw = req.body as Partial<Product> | undefined;
    if (!raw || typeof raw !== 'object') {
      res.status(400).json({ error: 'Invalid product payload.' });
      return;
    }

    const store = readStore();
    const existing = store.products.find((p) => p.id === targetId);
    if (!existing) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const now = Date.now();
    const updated = normalizeProduct({
      ...existing,
      ...raw,
      id: targetId,
      createdAt: existing.createdAt,
      updatedAt: now,
    });

    if (existing.stockQuantity !== updated.stockQuantity) {
      const prevNum = existing.stockQuantity ?? 0;
      const nextNum = updated.stockQuantity ?? 0;
      pushStockHistory(store, {
        timestamp: now,
        productId: updated.id,
        productName: updated.name,
        type: 'manual_adjustment',
        delta:
          existing.stockQuantity !== null && updated.stockQuantity !== null
            ? nextNum - prevNum
            : nextNum,
        previousStock: existing.stockQuantity,
        newStock: updated.stockQuantity,
        note: 'Updated via product editor',
      });
      checkAndEmitStockAlerts(store, updated, existing.stockQuantity, now);
    }

    store.products = store.products.map((p) =>
      p.id === targetId ? updated : p,
    );
    writeStore(store);
    res.json({
      product: updated,
      products: store.products,
      stockHistory: store.stockHistory,
      notifications: store.notifications,
    });
  });

  app.patch('/api/admin/products/:id/stock', requireAdminAuth, (req, res) => {
    const targetId = req.params.id;
    const rawStock = req.body?.stockQuantity;
    const note =
      typeof req.body?.note === 'string' ? req.body.note.trim() : '';

    if (
      rawStock !== null &&
      (typeof rawStock !== 'number' ||
        !Number.isFinite(rawStock) ||
        rawStock < 0)
    ) {
      res.status(400).json({ error: 'Valid stock quantity is required.' });
      return;
    }

    const store = readStore();
    const existing = store.products.find((p) => p.id === targetId);
    if (!existing) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const now = Date.now();
    const nextStock = rawStock === null ? null : Math.floor(rawStock);
    const updated: Product = {
      ...existing,
      stockQuantity: nextStock,
      updatedAt: now,
    };

    if (existing.stockQuantity !== nextStock) {
      const prevNum = existing.stockQuantity ?? 0;
      const nextNum = nextStock ?? 0;
      pushStockHistory(store, {
        timestamp: now,
        productId: updated.id,
        productName: updated.name,
        type: 'manual_adjustment',
        delta:
          existing.stockQuantity !== null && nextStock !== null
            ? nextNum - prevNum
            : nextNum,
        previousStock: existing.stockQuantity,
        newStock: nextStock,
        note: note || 'Updated in Inventory Management',
      });
      checkAndEmitStockAlerts(store, updated, existing.stockQuantity, now);
    }

    store.products = store.products.map((p) =>
      p.id === targetId ? updated : p,
    );
    writeStore(store);
    res.json({
      product: updated,
      products: store.products,
      stockHistory: store.stockHistory,
      notifications: store.notifications,
    });
  });

  app.delete('/api/admin/products/:id', requireAdminAuth, (req, res) => {
    const targetId = req.params.id;
    const store = readStore();
    const before = store.products.length;
    store.products = store.products.filter((p) => p.id !== targetId);
    if (store.products.length === before) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    writeStore(store);
    res.json({ products: store.products });
  });

  app.post('/api/admin/products/import', requireAdminAuth, (req, res) => {
    const incoming = req.body?.products;
    if (!Array.isArray(incoming)) {
      res.status(400).json({ error: 'Expected products array.' });
      return;
    }
    const normalized = incoming
      .filter((item) => item && typeof item === 'object' && item.name)
      .map((item) => normalizeProduct(item as Product));

    const store = readStore();
    store.products = normalized;
    writeStore(store);
    res.json({ products: store.products });
  });

  app.post('/api/admin/products/reset', requireAdminAuth, (_req, res) => {
    const store = readStore();
    store.products = DEFAULT_PRODUCTS.map((p) => normalizeProduct(p));
    writeStore(store);
    res.json({ products: store.products });
  });

  app.put('/api/admin/categories', requireAdminAuth, (req, res) => {
    const incoming = req.body?.categories;
    if (!Array.isArray(incoming) || incoming.length === 0) {
      res.status(400).json({ error: 'At least one category is required.' });
      return;
    }
    const store = readStore();
    store.categories = incoming as CategoryDefinition[];
    writeStore(store);
    res.json({ categories: store.categories });
  });

  app.post('/api/admin/categories/reset', requireAdminAuth, (_req, res) => {
    const store = readStore();
    store.categories = DEFAULT_CATEGORIES;
    writeStore(store);
    res.json({ categories: store.categories });
  });

  app.patch('/api/admin/orders/:id', requireAdminAuth, (req, res) => {
    const targetId = req.params.id;
    const status = req.body?.status as OrderStatus | undefined;
    const note =
      typeof req.body?.note === 'string' ? req.body.note.trim() : '';

    if (!status || !ORDER_STATUSES.includes(status)) {
      res.status(400).json({ error: 'Invalid order status.' });
      return;
    }
    const store = readStore();
    const existingOrder = store.orders.find((o) => o.id === targetId);
    if (!existingOrder) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const now = Date.now();
    const prevStatus = existingOrder.status;
    let nextStockRestored = Boolean(existingOrder.stockRestored);

    // Safe stock restoration when cancelling an order (prevent double restoration)
    if (
      status === 'Cancelled' &&
      prevStatus !== 'Cancelled' &&
      !nextStockRestored &&
      existingOrder.stockDeductedByProduct
    ) {
      const deductedMap = existingOrder.stockDeductedByProduct;
      store.products = store.products.map((product) => {
        const qty = deductedMap[product.id];
        if (qty && qty > 0 && typeof product.stockQuantity === 'number') {
          const previousStock = product.stockQuantity;
          const newStock = previousStock + qty;
          pushStockHistory(store, {
            timestamp: now,
            productId: product.id,
            productName: product.name,
            type: 'order_restore',
            delta: qty,
            previousStock,
            newStock,
            orderId: existingOrder.id,
            note: `Restored from cancelled order ${existingOrder.id}`,
          });
          return { ...product, stockQuantity: newStock, updatedAt: now };
        }
        return product;
      });
      nextStockRestored = true;
    } else if (
      prevStatus === 'Cancelled' &&
      status !== 'Cancelled' &&
      status !== 'Returned' &&
      nextStockRestored &&
      existingOrder.stockDeductedByProduct
    ) {
      // Re-activating a previously cancelled order: verify stock first
      const deductedMap = existingOrder.stockDeductedByProduct;
      for (const [prodId, qty] of Object.entries(deductedMap)) {
        const product = store.products.find((p) => p.id === prodId);
        if (product && typeof product.stockQuantity === 'number') {
          if (product.stockQuantity < qty) {
            res.status(409).json({
              error: `Cannot reactivate order: "${product.name}" only has ${product.stockQuantity} in stock (requires ${qty}).`,
            });
            return;
          }
        }
      }
      store.products = store.products.map((product) => {
        const qty = deductedMap[product.id];
        if (qty && qty > 0 && typeof product.stockQuantity === 'number') {
          const previousStock = product.stockQuantity;
          const newStock = Math.max(0, previousStock - qty);
          const updatedProduct = {
            ...product,
            stockQuantity: newStock,
            updatedAt: now,
          };
          pushStockHistory(store, {
            timestamp: now,
            productId: product.id,
            productName: product.name,
            type: 'order_deduct',
            delta: -qty,
            previousStock,
            newStock,
            orderId: existingOrder.id,
            note: `Re-deducted for reactivated order ${existingOrder.id}`,
          });
          checkAndEmitStockAlerts(store, updatedProduct, previousStock, now);
          return updatedProduct;
        }
        return product;
      });
      nextStockRestored = false;
    }

    if (status === 'Cancelled' && prevStatus !== 'Cancelled') {
      pushNotification(store, {
        type: 'order_cancelled',
        title: 'Order Cancelled',
        message: `Order ${existingOrder.id} (${existingOrder.customerName}) was marked Cancelled.`,
        createdAt: now,
        orderId: existingOrder.id,
      });
    }

    const baseHistory =
      Array.isArray(existingOrder.statusHistory) &&
      existingOrder.statusHistory.length > 0
        ? existingOrder.statusHistory
        : [
            {
              status: existingOrder.status,
              changedAt: existingOrder.createdAt,
            },
          ];

    const updatedOrder: StoredOrder = {
      ...existingOrder,
      status,
      updatedAt: now,
      stockRestored: nextStockRestored,
      statusHistory: [
        ...baseHistory,
        {
          status,
          changedAt: now,
          ...(note ? { note } : {}),
        },
      ],
    };

    store.orders = store.orders.map((o) =>
      o.id === targetId ? updatedOrder : o,
    );
    writeStore(store);
    res.json({
      order: updatedOrder,
      orders: store.orders,
      products: store.products,
      stockHistory: store.stockHistory,
      notifications: store.notifications,
    });
  });

  app.put('/api/admin/orders/:id/customer', requireAdminAuth, (req, res) => {
    const targetId = req.params.id;
    const body = req.body as
      | {
          customerName?: string;
          mobileNumber?: string;
          district?: string;
          upazila?: string;
          fullAddress?: string;
          nearbyLandmark?: string;
          deliveryInstructions?: string;
        }
      | undefined;

    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Invalid customer update payload.' });
      return;
    }

    const customerName =
      typeof body.customerName === 'string' ? body.customerName.trim() : '';
    const normalizedMobile = normalizeBdMobile(
      typeof body.mobileNumber === 'string' ? body.mobileNumber.trim() : '',
    );
    const districtInput =
      typeof body.district === 'string' ? body.district.trim() : '';
    const upazilaInput =
      typeof body.upazila === 'string' ? body.upazila.trim() : '';
    const fullAddress =
      typeof body.fullAddress === 'string' ? body.fullAddress.trim() : '';
    const nearbyLandmark =
      typeof body.nearbyLandmark === 'string' ? body.nearbyLandmark.trim() : '';
    const deliveryInstructions =
      typeof body.deliveryInstructions === 'string'
        ? body.deliveryInstructions.trim()
        : '';

    if (customerName.length < 2) {
      res.status(400).json({ error: 'Please enter a valid customer name.' });
      return;
    }
    if (!/^01[3-9]\d{8}$/.test(normalizedMobile)) {
      res.status(400).json({
        error: 'Please enter a valid 11-digit Bangladesh mobile number.',
      });
      return;
    }
    const districtEntry = findDistrictEntry(districtInput);
    if (!districtEntry) {
      res.status(400).json({ error: 'Please select a valid district.' });
      return;
    }
    if (!upazilaInput || !isValidDistrictUpazila(districtEntry.district, upazilaInput)) {
      res.status(400).json({
        error: `Please select a valid upazila for ${districtEntry.district}.`,
      });
      return;
    }
    if (fullAddress.length < 5) {
      res.status(400).json({ error: 'Please enter the full delivery address.' });
      return;
    }

    const store = readStore();
    const existingOrder = store.orders.find((o) => o.id === targetId);
    if (!existingOrder) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const updatedOrder: StoredOrder = {
      ...existingOrder,
      customerName,
      mobileNumber: normalizedMobile,
      district: districtEntry.district,
      upazila: upazilaInput,
      fullAddress,
      nearbyLandmark: nearbyLandmark || undefined,
      deliveryInstructions: deliveryInstructions || undefined,
      updatedAt: Date.now(),
    };

    store.orders = store.orders.map((o) =>
      o.id === targetId ? updatedOrder : o,
    );
    writeStore(store);
    res.json({ order: updatedOrder, orders: store.orders });
  });

  app.delete('/api/admin/orders/:id', requireAdminAuth, (req, res) => {
    const targetId = req.params.id;
    const store = readStore();
    const targetOrder = store.orders.find((o) => o.id === targetId);
    if (!targetOrder) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const now = Date.now();
    // Restore deducted stock if the deleted order had not yet been cancelled/restored
    if (
      targetOrder.status !== 'Cancelled' &&
      !targetOrder.stockRestored &&
      targetOrder.stockDeductedByProduct
    ) {
      const deductedMap = targetOrder.stockDeductedByProduct;
      store.products = store.products.map((product) => {
        const qty = deductedMap[product.id];
        if (qty && qty > 0 && typeof product.stockQuantity === 'number') {
          const previousStock = product.stockQuantity;
          const newStock = previousStock + qty;
          pushStockHistory(store, {
            timestamp: now,
            productId: product.id,
            productName: product.name,
            type: 'order_restore',
            delta: qty,
            previousStock,
            newStock,
            orderId: targetOrder.id,
            note: `Restored upon deletion of order ${targetOrder.id}`,
          });
          return { ...product, stockQuantity: newStock, updatedAt: now };
        }
        return product;
      });
    }

    store.orders = store.orders.filter((o) => o.id !== targetId);
    writeStore(store);
    res.json({
      orders: store.orders,
      products: store.products,
      stockHistory: store.stockHistory,
    });
  });

  // Ensure unknown /api/* requests never fall through to SPA HTML
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(
      '/src/assets/images',
      express.static(path.join(__dirname, 'src', 'assets', 'images'), {
        maxAge: '7d',
      }),
    );
    app.use(
      '/assets',
      express.static(path.join(distDir, 'assets'), {
        maxAge: '1y',
        immutable: true,
      }),
    );
    app.use(express.static(distDir, { index: false, maxAge: '1d' }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`STYLEON server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();

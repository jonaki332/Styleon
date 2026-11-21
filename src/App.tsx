import { ArrowRight, Facebook, Plus, Search, ShieldCheck, X } from 'lucide-react';
import { MotionConfig, motion } from 'motion/react';
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { BagDrawer, BagItem } from './components/BagDrawer';
import { ImageWithFallback } from './components/ImageWithFallback';
import { Navbar } from './components/Navbar';
import { ProductCard } from './components/ProductCard';
import { SharePageButton } from './components/SharePageButton';

const AdminDashboardModal = lazy(() =>
  import('./components/AdminDashboardModal').then((m) => ({
    default: m.AdminDashboardModal,
  })),
);
const AdminPasswordLogin = lazy(() =>
  import('./components/AdminPasswordLogin').then((m) => ({
    default: m.AdminPasswordLogin,
  })),
);
const CheckoutView = lazy(() =>
  import('./components/CheckoutView').then((m) => ({
    default: m.CheckoutView,
  })),
);
const ContactSection = lazy(() =>
  import('./components/ContactSection').then((m) => ({
    default: m.ContactSection,
  })),
);
const InfoPages = lazy(() =>
  import('./components/InfoPages').then((m) => ({
    default: m.InfoPages,
  })),
);
const ProductDetailView = lazy(() =>
  import('./components/ProductDetailView').then((m) => ({
    default: m.ProductDetailView,
  })),
);
import {
  buildWhatsAppUrl,
  CategoryDefinition,
  DEFAULT_CATEGORIES,
  DEFAULT_PRODUCTS,
  FLAT_DELIVERY_CHARGE_BDT,
  formatBdt,
  getEffectivePrice,
  getProductCategories,
  getProductSubcategories,
  HERO_BANNER,
  normalizeProduct,
  Product,
  STORE_CONFIG,
} from './data/catalog';
import {
  AdminApiError,
  checkAdminSession,
  createAdminProduct,
  deleteAdminOrder,
  deleteAdminProduct,
  fetchAdminCatalog,
  fetchPublicStorefront,
  importAdminProducts,
  logoutAdmin,
  markAdminNotificationsRead,
  resetAdminCategories,
  resetAdminProducts,
  saveAdminCategories,
  saveAdminDeliveryCharge,
  updateAdminOrderCustomer,
  updateAdminOrderStatus,
  updateAdminProduct,
  updateAdminProductStock,
  UpdateOrderCustomerPayload,
} from './utils/adminApi';
import {
  AdminNotification,
  loadStoredOrders,
  ORDERS_STORAGE_KEY,
  OrderStatus,
  StockHistoryEntry,
  StoredOrder,
} from './utils/orders';
import {
  findCategoryBySlug,
  findSubcategoryBySlug,
  getCategoryPath,
  getNavTargetPath,
  getProductPath,
  getShopPath,
  InfoPageId,
  NavTarget,
  parseAppLocation,
  ParsedAppRoute,
} from './utils/routes';

const PRODUCTS_STORAGE_KEY = 'styleon_published_products_v1';
const LEGACY_STORAGE_KEY = 'nuvora_published_products_v3';
const CATEGORIES_STORAGE_KEY = 'styleon_categories_v1';

interface CheckoutSelection {
  productId: string;
  size?: string;
  color?: string;
  quantity?: number;
  returnToProductDetails: boolean;
}

type SortOption = 'featured' | 'newest' | 'price-asc' | 'price-desc';

const PAGE_SIZE = 12;

function readInitialRoute(): ParsedAppRoute {
  if (typeof window === 'undefined') return { kind: 'home' };
  return parseAppLocation(window.location.pathname, window.location.search);
}

function pushStorefrontUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const current = `${window.location.pathname}${window.location.search}`;
  if (current !== url) {
    window.history.pushState({}, '', url);
  }
}

function loadStoredProducts(): Product[] {
  try {
    const raw =
      localStorage.getItem(PRODUCTS_STORAGE_KEY) ||
      localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return DEFAULT_PRODUCTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_PRODUCTS;
    }
    return parsed.map((p) => normalizeProduct(p as Product));
  } catch {
    return DEFAULT_PRODUCTS;
  }
}

function loadStoredCategories(): CategoryDefinition[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (!raw) return DEFAULT_CATEGORIES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_CATEGORIES;
    }
    return parsed as CategoryDefinition[];
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export default function App() {
  const [products, setProducts] = useState<Product[]>(() => loadStoredProducts());
  const [categories, setCategories] = useState<CategoryDefinition[]>(() =>
    loadStoredCategories(),
  );
  const [orders, setOrders] = useState<StoredOrder[]>(() => loadStoredOrders());
  const [stockHistory, setStockHistory] = useState<StockHistoryEntry[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [serverBestSellerIds, setServerBestSellerIds] = useState<string[]>([]);
  const [deliveryChargeBdt, setDeliveryChargeBdt] = useState<number>(
    FLAT_DELIVERY_CHARGE_BDT,
  );

  const [route, setRoute] = useState<ParsedAppRoute>(() => readInitialRoute());
  const isAdminRoute = route.kind === 'admin';

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [adminSessionChecking, setAdminSessionChecking] = useState<boolean>(() =>
    readInitialRoute().kind === 'admin',
  );
  const [adminLoginOpen, setAdminLoginOpen] = useState<boolean>(false);

  const [storefrontLoaded, setStorefrontLoaded] = useState<boolean>(false);
  const [checkoutSelection, setCheckoutSelection] =
    useState<CheckoutSelection | null>(null);

  // Shop Filter & Sort State
  const [searchQuery, setSearchQuery] = useState(() => {
    const initial = readInitialRoute();
    return initial.kind === 'shop' ? initial.searchQuery ?? '' : '';
  });
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [visibleLimit, setVisibleLimit] = useState<number>(PAGE_SIZE);

  const [bagOpen, setBagOpen] = useState(false);
  const [bagItems, setBagItems] = useState<BagItem[]>([]);
  const [adminOpen, setAdminOpen] = useState(false);

  const loadStorefront = useCallback(async () => {
    try {
      const payload = await fetchPublicStorefront();
      if (Array.isArray(payload.products)) {
        setProducts(payload.products.map(normalizeProduct));
      }
      if (
        Array.isArray(payload.categories) &&
        payload.categories.length > 0
      ) {
        setCategories(payload.categories);
      }
      if (Array.isArray(payload.bestSellerProductIds)) {
        setServerBestSellerIds(payload.bestSellerProductIds);
      }
      if (typeof payload.deliveryChargeBdt === 'number') {
        setDeliveryChargeBdt(payload.deliveryChargeBdt);
      }
    } catch {
      // Preserve local defaults if backend is unavailable
    } finally {
      setStorefrontLoaded(true);
    }
  }, []);

  const loadAdminWorkspaceData = useCallback(async (): Promise<boolean> => {
    try {
      const data = await fetchAdminCatalog();
      if (Array.isArray(data.products)) {
        setProducts(data.products.map(normalizeProduct));
      }
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        setCategories(data.categories);
      }
      if (Array.isArray(data.orders)) {
        setOrders(data.orders);
      }
      if (Array.isArray(data.stockHistory)) {
        setStockHistory(data.stockHistory);
      }
      if (Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
      }
      if (typeof data.deliveryChargeBdt === 'number') {
        setDeliveryChargeBdt(data.deliveryChargeBdt);
      }
      setIsAdminAuthenticated(true);
      return true;
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 401) {
        setIsAdminAuthenticated(false);
        setAdminOpen(false);
        setStockHistory([]);
        setNotifications([]);
      }
      return false;
    }
  }, []);

  const handleRefreshAdminData = useCallback(async () => {
    await loadAdminWorkspaceData();
  }, [loadAdminWorkspaceData]);

  useEffect(() => {
    void loadStorefront();
  }, [loadStorefront]);

  // Verify session if directly accessing /admin
  useEffect(() => {
    if (!isAdminRoute) return;
    let cancelled = false;
    setAdminSessionChecking(true);
    void (async () => {
      try {
        const status = await checkAdminSession();
        if (cancelled) return;
        if (status.authenticated) {
          await loadAdminWorkspaceData();
        } else {
          setIsAdminAuthenticated(false);
        }
      } catch {
        if (!cancelled) setIsAdminAuthenticated(false);
      } finally {
        if (!cancelled) setAdminSessionChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdminRoute, loadAdminWorkspaceData]);

  useEffect(() => {
    const onPopState = () => {
      const nextRoute = parseAppLocation(
        window.location.pathname,
        window.location.search,
      );
      setRoute(nextRoute);
      setCheckoutSelection(null);
      if (nextRoute.kind === 'shop') {
        setSearchQuery(nextRoute.searchQuery ?? '');
        setVisibleLimit(PAGE_SIZE);
      } else if (nextRoute.kind === 'category') {
        setSearchQuery('');
        setVisibleLimit(PAGE_SIZE);
      }
      if (nextRoute.kind !== 'admin') {
        setAdminOpen(false);
        setAdminLoginOpen(false);
        void loadStorefront();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [loadStorefront]);

  useEffect(() => {
    if (route.kind !== 'new-arrivals') return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById('new-arrivals');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [route.kind]);

  // Persist published catalog & categories cache in localStorage
  useEffect(() => {
    try {
      localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
    } catch {
      // Ignore storage quota errors gracefully
    }
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
    } catch {
      // Ignore storage quota errors gracefully
    }
  }, [categories]);

  const refreshOrders = useCallback(() => {
    setOrders(loadStoredOrders());
    void loadStorefront();
  }, [loadStorefront]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === ORDERS_STORAGE_KEY) {
        refreshOrders();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refreshOrders]);

  const publishedProducts = useMemo(
    () => products.filter((p) => p.published),
    [products],
  );

  const newArrivalsProducts = useMemo(
    () => [...publishedProducts].sort((a, b) => b.createdAt - a.createdAt),
    [publishedProducts],
  );

  const bestSellingProducts = useMemo(() => {
    if (serverBestSellerIds.length > 0) {
      const byId = new Map(publishedProducts.map((p) => [p.id, p]));
      const fromServer = serverBestSellerIds
        .map((id) => byId.get(id))
        .filter((p): p is Product => Boolean(p));
      if (fromServer.length > 0) return fromServer;
    }

    const qtyById = new Map<string, number>();
    const qtyByName = new Map<string, number>();

    orders.forEach((order) => {
      if (order.status === 'Cancelled') return;
      order.items.forEach((item) => {
        qtyById.set(item.productId, (qtyById.get(item.productId) ?? 0) + item.quantity);
        const key = item.productName.trim().toLowerCase();
        qtyByName.set(key, (qtyByName.get(key) ?? 0) + item.quantity);
      });
    });

    if (qtyById.size === 0 && qtyByName.size === 0) return [];

    return publishedProducts
      .map((product) => {
        const count =
          qtyById.get(product.id) ??
          qtyByName.get(product.name.trim().toLowerCase()) ??
          0;
        return { product, count };
      })
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count)
      .map((entry) => entry.product);
  }, [publishedProducts, orders, serverBestSellerIds]);

  const featuredProducts = useMemo(
    () => publishedProducts.filter((p) => p.isFeatured),
    [publishedProducts],
  );

  const matchedRouteCategory = useMemo(
    () =>
      route.kind === 'category'
        ? findCategoryBySlug(categories, route.categorySlug)
        : null,
    [categories, route],
  );

  const selectedCategory =
    route.kind === 'category' ? matchedRouteCategory?.id ?? 'All' : 'All';

  const selectedSubcategory = useMemo(() => {
    if (route.kind !== 'category' || !matchedRouteCategory) return 'All';
    if (!route.subcategorySlug) return 'All';
    return (
      findSubcategoryBySlug(matchedRouteCategory, route.subcategorySlug) ?? 'All'
    );
  }, [matchedRouteCategory, route]);

  const activeCategoryDef =
    route.kind === 'category' ? matchedRouteCategory : null;

  const activeProductId = route.kind === 'product' ? route.productId : null;
  const activeInfoPage: InfoPageId | null =
    route.kind === 'info' ? route.page : null;

  const activeNav: NavTarget | null = useMemo(() => {
    if (route.kind === 'home') return 'home';
    if (route.kind === 'new-arrivals') return 'new-arrivals';
    if (route.kind === 'shop' || route.kind === 'category') return 'shop';
    if (route.kind === 'contact') return 'contact';
    if (route.kind === 'info') return route.page;
    return null;
  }, [route]);

  const activeProduct = useMemo(
    () =>
      activeProductId
        ? publishedProducts.find((p) => p.id === activeProductId) ?? null
        : null,
    [publishedProducts, activeProductId],
  );

  const relatedProducts = useMemo(() => {
    if (!activeProduct) return [];
    const activeCats = new Set(getProductCategories(activeProduct));
    const others = publishedProducts.filter((p) => p.id !== activeProduct.id);
    const sameCat = others.filter((p) =>
      getProductCategories(p).some((c) => activeCats.has(c)),
    );
    return sameCat.length > 0 ? sameCat : others;
  }, [publishedProducts, activeProduct]);

  const checkoutProduct = useMemo(
    () =>
      checkoutSelection
        ? publishedProducts.find((p) => p.id === checkoutSelection.productId) ??
          null
        : null,
    [publishedProducts, checkoutSelection],
  );

  const shopFilteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const min = minPrice.trim() ? Number(minPrice) : null;
    const max = maxPrice.trim() ? Number(maxPrice) : null;

    const matching = publishedProducts.filter((product) => {
      const prodCats = getProductCategories(product);
      const prodSubs = getProductSubcategories(product);

      if (selectedCategory !== 'All' && !prodCats.includes(selectedCategory)) {
        return false;
      }

      if (
        selectedSubcategory !== 'All' &&
        !prodSubs.includes(selectedSubcategory)
      ) {
        return false;
      }

      const effective = getEffectivePrice(product);
      if (min !== null && !Number.isNaN(min) && effective < min) {
        return false;
      }
      if (max !== null && !Number.isNaN(max) && effective > max) {
        return false;
      }

      if (!q) return true;
      return (
        product.name.toLowerCase().includes(q) ||
        prodCats.some((c) => c.toLowerCase().includes(q)) ||
        prodSubs.some((s) => s.toLowerCase().includes(q)) ||
        product.shortDescription.toLowerCase().includes(q) ||
        product.description.toLowerCase().includes(q)
      );
    });

    return [...matching].sort((a, b) => {
      if (sortBy === 'price-asc') {
        return getEffectivePrice(a) - getEffectivePrice(b);
      }
      if (sortBy === 'price-desc') {
        return getEffectivePrice(b) - getEffectivePrice(a);
      }
      if (sortBy === 'newest') {
        return b.createdAt - a.createdAt;
      }
      if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
      return b.createdAt - a.createdAt;
    });
  }, [
    publishedProducts,
    selectedCategory,
    selectedSubcategory,
    minPrice,
    maxPrice,
    searchQuery,
    sortBy,
  ]);

  const paginatedShopProducts = useMemo(
    () => shopFilteredProducts.slice(0, visibleLimit),
    [shopFilteredProducts, visibleLimit],
  );

  const bagCount = useMemo(
    () => bagItems.reduce((sum, item) => sum + item.quantity, 0),
    [bagItems],
  );

  useEffect(() => {
    if (checkoutProduct) {
      document.title = `Checkout: ${checkoutProduct.name} — STYLEON`;
    } else if (route.kind === 'admin') {
      document.title = 'Admin Dashboard — STYLEON';
    } else if (route.kind === 'product') {
      document.title = activeProduct
        ? `${activeProduct.name} — STYLEON`
        : storefrontLoaded
          ? 'Product Not Found — STYLEON'
          : 'Loading Product — STYLEON';
    } else if (route.kind === 'not-found') {
      document.title = 'Page Not Found — STYLEON';
    } else if (route.kind === 'category') {
      if (!matchedRouteCategory) {
        document.title = storefrontLoaded
          ? 'Page Not Found — STYLEON'
          : 'STYLEON';
      } else if (selectedSubcategory !== 'All') {
        document.title = `${matchedRouteCategory.name} — ${selectedSubcategory} — STYLEON`;
      } else {
        document.title = `${matchedRouteCategory.name} — STYLEON`;
      }
    } else if (route.kind === 'shop') {
      document.title = "Shop Men's Collection — STYLEON";
    } else if (route.kind === 'new-arrivals') {
      document.title = 'New Arrivals — STYLEON';
    } else if (route.kind === 'contact') {
      document.title = 'Contact — STYLEON';
    } else if (route.kind === 'info') {
      const titles: Record<InfoPageId, string> = {
        about: 'About Us — STYLEON',
        delivery: 'Shipping Policy — STYLEON',
        returns: 'Return & Refund Policy — STYLEON',
        privacy: 'Privacy Policy — STYLEON',
        terms: 'Terms & Conditions — STYLEON',
      };
      document.title = titles[route.page];
    } else {
      document.title = "STYLEON — Premium Men's Fashion & Clothing";
    }
  }, [
    checkoutProduct,
    route,
    activeProduct,
    storefrontLoaded,
    matchedRouteCategory,
    selectedSubcategory,
  ]);

  const navigateToUrl = useCallback(
    (url: string, opts?: { scrollTop?: boolean }) => {
      pushStorefrontUrl(url);
      const parsedUrl = new URL(url, 'http://styleon.local');
      setRoute(parseAppLocation(parsedUrl.pathname, parsedUrl.search));
      setCheckoutSelection(null);
      if (opts?.scrollTop !== false) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [],
  );

  const openShopWithCategory = (
    categoryId: string,
    subcategory = 'All',
  ) => {
    setVisibleLimit(PAGE_SIZE);
    if (categoryId === 'All') {
      setSearchQuery('');
      navigateToUrl('/shop');
      return;
    }
    setSearchQuery('');
    navigateToUrl(getCategoryPath(categoryId, subcategory));
  };

  const handleNavigate = (target: NavTarget) => {
    const targetUrl = getNavTargetPath(target);
    if (target === 'shop') {
      setSearchQuery('');
      setVisibleLimit(PAGE_SIZE);
      navigateToUrl(targetUrl);
      return;
    }
    if (target === 'new-arrivals') {
      navigateToUrl(targetUrl, { scrollTop: false });
      return;
    }
    navigateToUrl(targetUrl);
  };

  const handleSubmitSearch = (query: string) => {
    setSearchQuery(query);
    setVisibleLimit(PAGE_SIZE);
    navigateToUrl(getShopPath(query));
  };

  const handleSelectProduct = (product: Product) => {
    navigateToUrl(getProductPath(product.id));
  };

  const handleAddToBag = (
    product: Product,
    size: string,
    color: string,
    quantity: number,
  ) => {
    setBagItems((prev) => {
      const existingIdx = prev.findIndex(
        (item) =>
          item.product.id === product.id &&
          item.size === size &&
          item.color === color,
      );
      if (existingIdx >= 0) {
        return prev.map((item, idx) =>
          idx === existingIdx
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      }
      return [...prev, { product, size, color, quantity }];
    });
  };

  const handleOrderFromCard = (product: Product) => {
    setCheckoutSelection({
      productId: product.id,
      returnToProductDetails: false,
    });
  };

  const handleStartCheckoutFromDetails = (
    product: Product,
    size: string,
    color: string,
    quantity: number,
  ) => {
    setCheckoutSelection({
      productId: product.id,
      size,
      color,
      quantity,
      returnToProductDetails: true,
    });
  };

  const handleUpdateQuantity = (
    productId: string,
    size: string,
    color: string,
    delta: number,
  ) => {
    setBagItems((prev) =>
      prev
        .map((item) =>
          item.product.id === productId &&
          item.size === size &&
          item.color === color
            ? { ...item, quantity: item.quantity + delta }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const handleRemoveItem = (productId: string, size: string, color: string) => {
    setBagItems((prev) =>
      prev.filter(
        (item) =>
          !(
            item.product.id === productId &&
            item.size === size &&
            item.color === color
          ),
      ),
    );
  };

  const handleAdminUnauthorized = useCallback(() => {
    setIsAdminAuthenticated(false);
    setAdminOpen(false);
    setStockHistory([]);
    setNotifications([]);
    setAdminLoginOpen(!isAdminRoute);
  }, [isAdminRoute]);

  const handleRequestAdminAccess = useCallback(async () => {
    try {
      const status = await checkAdminSession();
      if (status.authenticated) {
        const loaded = await loadAdminWorkspaceData();
        if (loaded) {
          setAdminLoginOpen(false);
          setAdminOpen(true);
          return;
        }
      }
    } catch {
      // Fall through to password screen
    }
    setIsAdminAuthenticated(false);
    setAdminOpen(false);
    setAdminLoginOpen(true);
  }, [loadAdminWorkspaceData]);

  const handleAdminLoginSuccess = useCallback(async () => {
    const loaded = await loadAdminWorkspaceData();
    if (!loaded) {
      throw new Error(
        'Authenticated session could not be established. Please refresh and try again.',
      );
    }
    setAdminLoginOpen(false);
    setAdminOpen(true);
  }, [loadAdminWorkspaceData]);

  const handleAdminLogout = useCallback(async () => {
    try {
      await logoutAdmin();
    } catch {
      // Ignore network errors and still clear local auth state
    }
    setIsAdminAuthenticated(false);
    setAdminOpen(false);
    setAdminLoginOpen(false);
    setStockHistory([]);
    setNotifications([]);
    void loadStorefront();
  }, [loadStorefront]);

  const handleReturnToStorefront = useCallback(() => {
    pushStorefrontUrl('/');
    setRoute({ kind: 'home' });
    setAdminOpen(false);
    setAdminLoginOpen(false);
    void loadStorefront();
  }, [loadStorefront]);

  // Protected Admin Mutation Handlers
  const handlePublishProduct = (product: Product, isEdit: boolean) => {
    void (async () => {
      try {
        const res = isEdit
          ? await updateAdminProduct(product)
          : await createAdminProduct(product);
        setProducts(res.products.map(normalizeProduct));
        if (Array.isArray(res.stockHistory)) {
          setStockHistory(res.stockHistory);
        }
        if (Array.isArray(res.notifications)) {
          setNotifications(res.notifications);
        }
      } catch (err) {
        if (err instanceof AdminApiError && err.status === 401) {
          handleAdminUnauthorized();
        }
      }
    })();
  };

  const handleTogglePublish = (productId: string) => {
    const target = products.find((p) => p.id === productId);
    if (!target) return;
    const toggled: Product = { ...target, published: !target.published };
    void (async () => {
      try {
        const res = await updateAdminProduct(toggled);
        setProducts(res.products.map(normalizeProduct));
        if (Array.isArray(res.stockHistory)) {
          setStockHistory(res.stockHistory);
        }
        if (Array.isArray(res.notifications)) {
          setNotifications(res.notifications);
        }
      } catch (err) {
        if (err instanceof AdminApiError && err.status === 401) {
          handleAdminUnauthorized();
        }
      }
    })();
  };

  const handleDeleteProduct = (productId: string) => {
    void (async () => {
      try {
        const res = await deleteAdminProduct(productId);
        setProducts(res.products.map(normalizeProduct));
      } catch (err) {
        if (err instanceof AdminApiError && err.status === 401) {
          handleAdminUnauthorized();
        }
      }
    })();
  };

  const handleImportProducts = (imported: Product[]) => {
    void (async () => {
      try {
        const res = await importAdminProducts(imported);
        setProducts(res.products.map(normalizeProduct));
      } catch (err) {
        if (err instanceof AdminApiError && err.status === 401) {
          handleAdminUnauthorized();
        }
      }
    })();
  };

  const handleResetToDefaults = () => {
    void (async () => {
      try {
        const res = await resetAdminProducts();
        setProducts(res.products.map(normalizeProduct));
      } catch (err) {
        if (err instanceof AdminApiError && err.status === 401) {
          handleAdminUnauthorized();
        }
      }
    })();
  };

  const handleUpdateCategories = (nextCategories: CategoryDefinition[]) => {
    void (async () => {
      try {
        const res = await saveAdminCategories(nextCategories);
        setCategories(res.categories);
      } catch (err) {
        if (err instanceof AdminApiError && err.status === 401) {
          handleAdminUnauthorized();
        }
      }
    })();
  };

  const handleResetCategories = () => {
    void (async () => {
      try {
        const res = await resetAdminCategories();
        setCategories(res.categories);
      } catch (err) {
        if (err instanceof AdminApiError && err.status === 401) {
          handleAdminUnauthorized();
        }
      }
    })();
  };

  const handleUpdateProductStock = async (
    productId: string,
    stockQuantity: number | null,
    note?: string,
  ): Promise<void> => {
    try {
      const res = await updateAdminProductStock(productId, stockQuantity, note);
      setProducts(res.products.map(normalizeProduct));
      if (Array.isArray(res.stockHistory)) {
        setStockHistory(res.stockHistory);
      }
      if (Array.isArray(res.notifications)) {
        setNotifications(res.notifications);
      }
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 401) {
        handleAdminUnauthorized();
      }
      throw err;
    }
  };

  const handleUpdateOrderStatus = async (
    orderId: string,
    status: OrderStatus,
    note?: string,
  ): Promise<void> => {
    try {
      const res = await updateAdminOrderStatus(orderId, status, note);
      setOrders(res.orders);
      if (Array.isArray(res.products)) {
        setProducts(res.products.map(normalizeProduct));
      }
      if (Array.isArray(res.stockHistory)) {
        setStockHistory(res.stockHistory);
      }
      if (Array.isArray(res.notifications)) {
        setNotifications(res.notifications);
      }
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 401) {
        handleAdminUnauthorized();
      }
      throw err;
    }
  };

  const handleUpdateOrderCustomer = async (
    orderId: string,
    payload: UpdateOrderCustomerPayload,
  ): Promise<void> => {
    try {
      const res = await updateAdminOrderCustomer(orderId, payload);
      setOrders(res.orders);
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 401) {
        handleAdminUnauthorized();
      }
      throw err;
    }
  };

  const handleDeleteOrder = async (orderId: string): Promise<void> => {
    try {
      const res = await deleteAdminOrder(orderId);
      setOrders(res.orders);
      if (Array.isArray(res.products)) {
        setProducts(res.products.map(normalizeProduct));
      }
      if (Array.isArray(res.stockHistory)) {
        setStockHistory(res.stockHistory);
      }
      if (Array.isArray(res.notifications)) {
        setNotifications(res.notifications);
      }
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 401) {
        handleAdminUnauthorized();
      }
      throw err;
    }
  };

  const handleMarkNotificationsRead = async (opts: {
    id?: string;
    all?: boolean;
  }): Promise<void> => {
    try {
      const res = await markAdminNotificationsRead(opts);
      if (Array.isArray(res.notifications)) {
        setNotifications(res.notifications);
      }
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 401) {
        handleAdminUnauthorized();
      }
    }
  };

  const handleUpdateDeliveryCharge = async (nextCharge: number): Promise<void> => {
    try {
      const res = await saveAdminDeliveryCharge(nextCharge);
      setDeliveryChargeBdt(res.deliveryChargeBdt);
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 401) {
        handleAdminUnauthorized();
      }
      throw err;
    }
  };

  const clearShopFilters = () => {
    setSearchQuery('');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('featured');
    setVisibleLimit(PAGE_SIZE);
    navigateToUrl('/shop');
  };

  // Protected Direct /admin URL Gate
  if (isAdminRoute) {
    if (adminSessionChecking) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4] text-xs font-medium uppercase tracking-[0.16em] text-[#5C574F]">
          Checking Admin Session...
        </div>
      );
    }

    if (!isAdminAuthenticated) {
      return (
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4] text-xs font-medium uppercase tracking-[0.16em] text-[#5C574F]">
              Loading Admin Portal...
            </div>
          }
        >
          <AdminPasswordLogin
            variant="page"
            onSuccess={() => handleAdminLoginSuccess()}
            onClose={handleReturnToStorefront}
          />
        </Suspense>
      );
    }

    return (
      <div className="min-h-screen overflow-x-clip bg-[#FAF8F4]">
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4] text-xs font-medium uppercase tracking-[0.16em] text-[#5C574F]">
              Loading Admin Dashboard...
            </div>
          }
        >
          <AdminDashboardModal
            isOpen={true}
            products={products}
            categories={categories}
            orders={orders}
            stockHistory={stockHistory}
            notifications={notifications}
            deliveryChargeBdt={deliveryChargeBdt}
            onRefreshAdminData={handleRefreshAdminData}
            onMarkNotificationsRead={handleMarkNotificationsRead}
            onUpdateDeliveryCharge={handleUpdateDeliveryCharge}
            onClose={handleReturnToStorefront}
            onLogout={() => {
              void handleAdminLogout();
            }}
            onPublishProduct={handlePublishProduct}
            onTogglePublish={handleTogglePublish}
            onDeleteProduct={handleDeleteProduct}
            onImportProducts={handleImportProducts}
            onResetToDefaults={handleResetToDefaults}
            onUpdateCategories={handleUpdateCategories}
            onResetCategories={handleResetCategories}
            onUpdateProductStock={handleUpdateProductStock}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onUpdateOrderCustomer={handleUpdateOrderCustomer}
            onDeleteOrder={handleDeleteOrder}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen flex-col overflow-x-clip bg-[#FAF8F4] text-[#141414]">
        <Navbar
          bagCount={bagCount}
          activeNav={activeNav}
          searchQuery={searchQuery}
          products={publishedProducts}
          categories={categories}
          onSearchChange={setSearchQuery}
          onSubmitSearch={handleSubmitSearch}
          onSelectProduct={handleSelectProduct}
          onSelectCategory={(cat, sub) =>
            openShopWithCategory(cat, sub ?? 'All')
          }
          onNavigate={handleNavigate}
          onOpenBag={() => setBagOpen(true)}
        />

        <main className="flex-1">
          {checkoutProduct && checkoutSelection ? (
            <Suspense
              fallback={
                <div className="flex min-h-[50vh] items-center justify-center bg-[#FAF8F4] text-xs font-medium uppercase tracking-[0.16em] text-[#5C574F]">
                  Loading Checkout...
                </div>
              }
            >
              <CheckoutView
                key={checkoutProduct.id}
                product={checkoutProduct}
                deliveryChargeBdt={deliveryChargeBdt}
                initialSize={checkoutSelection.size}
                initialColor={checkoutSelection.color}
                initialQuantity={checkoutSelection.quantity}
                onOrderPlaced={() => {
                  void loadStorefront();
                }}
                onContinueShopping={() => {
                  void loadStorefront();
                  navigateToUrl('/shop');
                }}
                onBack={() => {
                  refreshOrders();
                  const returnToDetails = checkoutSelection.returnToProductDetails;
                  const prodId = checkoutProduct.id;
                  setCheckoutSelection(null);
                  if (returnToDetails) {
                    navigateToUrl(getProductPath(prodId), { scrollTop: false });
                  }
                }}
              />
            </Suspense>
          ) : activeProduct ? (
            <Suspense
              fallback={
                <div className="flex min-h-[50vh] items-center justify-center bg-[#FAF8F4] text-xs font-medium uppercase tracking-[0.16em] text-[#5C574F]">
                  Loading Product Details...
                </div>
              }
            >
              <ProductDetailView
                product={activeProduct}
                deliveryChargeBdt={deliveryChargeBdt}
                relatedProducts={relatedProducts}
                onBack={() => navigateToUrl('/shop')}
                onSelectProduct={handleSelectProduct}
                onStartCheckout={handleStartCheckoutFromDetails}
                onOrderProduct={handleOrderFromCard}
                onAddToBag={handleAddToBag}
              />
            </Suspense>
          ) : activeProductId ? (
            storefrontLoaded ? (
              <section className="bg-[#FAF8F4] py-16 md:py-24">
                <div className="mx-auto max-w-[640px] border border-[#E3DBD0] bg-white px-6 py-12 text-center sm:px-10">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#8E6D35]">
                    STYLEON Storefront
                  </p>
                  <h1 className="font-display mt-3 text-3xl font-semibold text-[#141414] sm:text-4xl">
                    Product Not Found
                  </h1>
                  <p className="mt-3 text-sm leading-relaxed text-[#5C574F]">
                    The product you are looking for is unavailable or the link may have changed.
                  </p>
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleNavigate('home')}
                      className="inline-flex min-h-[46px] items-center justify-center bg-[#141414] px-7 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#FAF8F4] transition-colors hover:bg-[#2A2825] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352]"
                    >
                      Return to Homepage
                    </button>
                    <button
                      type="button"
                      onClick={() => openShopWithCategory('All')}
                      className="inline-flex min-h-[46px] items-center justify-center border border-[#141414] bg-white px-6 py-3 text-xs font-medium uppercase tracking-[0.14em] text-[#141414] transition-colors hover:bg-[#EFE9DF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352]"
                    >
                      Browse Shop
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              <div className="flex min-h-[50vh] items-center justify-center bg-[#FAF8F4] text-xs font-medium uppercase tracking-[0.16em] text-[#5C574F]">
                Loading Product Details...
              </div>
            )
          ) : route.kind === 'not-found' ||
            (route.kind === 'category' && !matchedRouteCategory) ? (
            route.kind === 'category' && !storefrontLoaded ? (
              <div className="flex min-h-[50vh] items-center justify-center bg-[#FAF8F4] text-xs font-medium uppercase tracking-[0.16em] text-[#5C574F]">
                Loading Collection...
              </div>
            ) : (
              <section className="bg-[#FAF8F4] py-16 md:py-24">
                <div className="mx-auto max-w-[640px] border border-[#E3DBD0] bg-white px-6 py-12 text-center sm:px-10">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#8E6D35]">
                    404 · STYLEON Storefront
                  </p>
                  <h1 className="font-display mt-3 text-3xl font-semibold text-[#141414] sm:text-4xl">
                    Page Not Found
                  </h1>
                  <p className="mt-3 text-sm leading-relaxed text-[#5C574F]">
                    The page or category you requested does not exist or may
                    have moved.
                  </p>
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleNavigate('home')}
                      className="inline-flex min-h-[46px] items-center justify-center bg-[#141414] px-7 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#FAF8F4] transition-colors hover:bg-[#2A2825] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352]"
                    >
                      Return to Homepage
                    </button>
                    <button
                      type="button"
                      onClick={() => openShopWithCategory('All')}
                      className="inline-flex min-h-[46px] items-center justify-center border border-[#141414] bg-white px-6 py-3 text-xs font-medium uppercase tracking-[0.14em] text-[#141414] transition-colors hover:bg-[#EFE9DF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352]"
                    >
                      Browse Shop
                    </button>
                  </div>
                </div>
              </section>
            )
          ) : activeInfoPage ? (
            <Suspense
              fallback={
                <div className="flex min-h-[40vh] items-center justify-center bg-[#FAF8F4] text-xs font-medium uppercase tracking-[0.16em] text-[#5C574F]">
                  Loading Page...
                </div>
              }
            >
              <InfoPages
                page={activeInfoPage}
                deliveryChargeBdt={deliveryChargeBdt}
                onBackHome={() => handleNavigate('home')}
                onNavigate={handleNavigate}
              />
            </Suspense>
          ) : route.kind === 'contact' ? (
            <Suspense
              fallback={
                <div className="flex min-h-[40vh] items-center justify-center bg-[#FAF8F4] text-xs font-medium uppercase tracking-[0.16em] text-[#5C574F]">
                  Loading Contact...
                </div>
              }
            >
              <ContactSection onBackHome={() => handleNavigate('home')} />
            </Suspense>
          ) : route.kind === 'shop' || route.kind === 'category' ? (
            <section className="bg-[#FAF8F4] py-10 md:py-16">
              <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
                {/* Shop Header */}
                <div className="flex flex-col justify-between gap-4 border-b border-[#E3DBD0] pb-6 sm:flex-row sm:items-end">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#8E6D35]">
                      STYLEON Men&apos;s Store
                    </p>
                    <h1 className="font-display mt-1.5 text-3xl font-semibold tracking-tight text-[#141414] sm:text-4xl">
                      {selectedCategory === 'All'
                        ? 'All Collections'
                        : selectedSubcategory !== 'All'
                          ? `${selectedCategory} — ${selectedSubcategory}`
                          : selectedCategory}
                    </h1>
                    <p className="mt-1 text-xs tabular-nums text-[#5C574F]">
                      {shopFilteredProducts.length}{' '}
                      {shopFilteredProducts.length === 1
                        ? 'product'
                        : 'products'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <SharePageButton
                      label={
                        selectedCategory === 'All'
                          ? 'Share Shop'
                          : 'Share Category'
                      }
                      copiedMessage={
                        selectedCategory === 'All'
                          ? 'Shop link copied to clipboard!'
                          : 'Category link copied to clipboard!'
                      }
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void handleRequestAdminAccess();
                      }}
                      className="inline-flex min-h-[42px] items-center gap-2 border border-[#141414] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#141414] transition-colors hover:bg-[#141414] hover:text-[#FAF8F4]"
                    >
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      <span>Admin Dashboard</span>
                    </button>
                  </div>
                </div>

                {/* Image-based Category Strip */}
                <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
                  <button
                    type="button"
                    onClick={() => openShopWithCategory('All')}
                    className={`flex min-w-[88px] shrink-0 flex-col justify-center border px-3.5 py-2.5 text-left transition-colors sm:min-w-[100px] sm:px-4 sm:py-3 ${
                      selectedCategory === 'All'
                        ? 'border-[#141414] bg-[#141414] text-[#FAF8F4]'
                        : 'border-[#E3DBD0] bg-white text-[#141414] hover:border-[#141414]'
                    }`}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      All
                    </span>
                    <span
                      className={`mt-0.5 text-[11px] tabular-nums ${
                        selectedCategory === 'All'
                          ? 'text-[#D4B882]'
                          : 'text-[#5C574F]'
                      }`}
                    >
                      {publishedProducts.length} items
                    </span>
                  </button>

                  {categories.map((cat) => {
                    const active = selectedCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => openShopWithCategory(cat.id)}
                        className={`flex w-[124px] shrink-0 items-center gap-2 border p-2 text-left transition-colors sm:w-[132px] sm:gap-2.5 ${
                          active
                            ? 'border-[#141414] bg-[#141414] text-[#FAF8F4]'
                            : 'border-[#E3DBD0] bg-white text-[#141414] hover:border-[#141414]'
                        }`}
                      >
                        <span className="h-10 w-10 shrink-0 overflow-hidden bg-[#EFE9DF]">
                          <ImageWithFallback
                            src={cat.image}
                            alt={cat.alt}
                            label={cat.name}
                            className="h-full w-full object-cover"
                          />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs font-medium">
                          {cat.name}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Subcategory Filters when active category defines subcategories */}
                {activeCategoryDef &&
                  activeCategoryDef.subcategories.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#EFE9DF] pt-4">
                      <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-[#8E6D35]">
                        Subcategories:
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          openShopWithCategory(activeCategoryDef.id, 'All')
                        }
                        className={`min-h-[34px] border px-3 text-xs font-medium transition-colors ${
                          selectedSubcategory === 'All'
                            ? 'border-[#141414] bg-[#141414] text-[#FAF8F4]'
                            : 'border-[#E3DBD0] bg-white text-[#5C574F] hover:border-[#141414]'
                        }`}
                      >
                        All {activeCategoryDef.name}
                      </button>
                      {activeCategoryDef.subcategories.map((sub) => {
                        const subActive = selectedSubcategory === sub;
                        return (
                          <button
                            key={sub}
                            type="button"
                            onClick={() =>
                              openShopWithCategory(activeCategoryDef.id, sub)
                            }
                            className={`min-h-[34px] border px-3 text-xs font-medium transition-colors ${
                              subActive
                                ? 'border-[#141414] bg-[#141414] text-[#FAF8F4]'
                                : 'border-[#E3DBD0] bg-white text-[#5C574F] hover:border-[#141414]'
                            }`}
                          >
                            {sub}
                          </button>
                        );
                      })}
                    </div>
                  )}

                {/* Search, Price Range & Sort Controls */}
                <div className="mt-5 grid gap-3 border border-[#E3DBD0] bg-white p-4 md:grid-cols-12 md:items-center">
                  <div className="relative md:col-span-5">
                    <Search
                      className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#5C574F]"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search product name or keyword..."
                      aria-label="Search products"
                      className="min-h-[40px] w-full border border-[#E3DBD0] bg-[#FAF8F4] pr-8 pl-9 text-sm text-[#141414] placeholder:text-[#9A9389] focus:border-[#141414] focus:outline-none"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        aria-label="Clear search"
                        className="absolute top-1/2 right-2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center text-[#5C574F] hover:text-[#141414]"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 md:col-span-4">
                    <input
                      type="number"
                      min={0}
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      placeholder="Min ৳"
                      aria-label="Minimum price in BDT"
                      className="min-h-[40px] w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-xs tabular-nums text-[#141414] placeholder:text-[#7A746B] focus:border-[#141414] focus:outline-none"
                    />
                    <input
                      type="number"
                      min={0}
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="Max ৳"
                      aria-label="Maximum price in BDT"
                      className="min-h-[40px] w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-xs tabular-nums text-[#141414] placeholder:text-[#7A746B] focus:border-[#141414] focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label htmlFor="shop-sort" className="sr-only">
                      Sort products
                    </label>
                    <select
                      id="shop-sort"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      className="min-h-[40px] w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-xs font-medium text-[#141414] focus:border-[#141414] focus:outline-none"
                    >
                      <option value="featured">Sort: Featured</option>
                      <option value="newest">Sort: Newest</option>
                      <option value="price-asc">
                        Sort: Price Low to High
                      </option>
                      <option value="price-desc">
                        Sort: Price High to Low
                      </option>
                    </select>
                  </div>
                </div>

                {/* Product Grid or Clean Empty State */}
                {shopFilteredProducts.length === 0 ? (
                  <div className="mt-10 border border-[#E3DBD0] bg-white p-10 text-center">
                    <h2 className="font-display text-2xl font-medium text-[#141414]">
                      No products currently match this filter
                    </h2>
                    <p className="mt-2 text-sm text-[#5C574F]">
                      Reset your active filters to browse all available pieces in
                      the STYLEON collection, or add a new product in the Admin
                      Dashboard.
                    </p>
                    <div className="mt-5 flex flex-wrap justify-center gap-3">
                      <button
                        type="button"
                        onClick={clearShopFilters}
                        className="min-h-[42px] border border-[#141414] px-5 py-2 text-xs font-medium text-[#141414] transition-colors hover:bg-[#141414] hover:text-[#FAF8F4]"
                      >
                        View All Products
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleRequestAdminAccess();
                        }}
                        className="inline-flex min-h-[42px] items-center gap-2 bg-[#141414] px-5 py-2 text-xs font-medium text-[#FAF8F4] transition-colors hover:bg-[#2A2825]"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Add Product in Admin</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                  <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
                      {paginatedShopProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onViewDetails={handleSelectProduct}
                          onOrderProduct={handleOrderFromCard}
                        />
                      ))}
                    </div>

                    {shopFilteredProducts.length > visibleLimit && (
                      <div className="mt-10 flex justify-center">
                        <button
                          type="button"
                          onClick={() =>
                            setVisibleLimit((prev) => prev + PAGE_SIZE)
                          }
                          className="min-h-[44px] border border-[#141414] bg-white px-8 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#141414] transition-colors hover:bg-[#141414] hover:text-[#FAF8F4]"
                        >
                          Load More Products
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          ) : (
            <>
              {/* 1. Men's Fashion Hero Banner */}
              <section
                id="home"
                className="relative overflow-hidden border-b border-[#E3DBD0] bg-[#EFE9DF]"
              >
                <div className="relative mx-auto min-h-[540px] max-w-[1440px] lg:min-h-[640px]">
                  <ImageWithFallback
                    src={HERO_BANNER.desktopImage}
                    alt={HERO_BANNER.alt}
                    label="STYLEON Men's Collection"
                    priority
                    className="absolute inset-0 h-full w-full object-cover object-[56%_14%] md:object-[64%_18%]"
                  />

                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-[#141414]/85 via-[#141414]/35 to-transparent lg:bg-gradient-to-r lg:from-[#141414]/80 lg:via-[#141414]/35 lg:to-transparent"
                  />

                  <div className="relative z-10 mx-auto flex min-h-[540px] max-w-[1280px] flex-col justify-end px-4 py-12 sm:px-6 md:py-16 lg:min-h-[640px] lg:justify-center lg:px-10">
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                      className="max-w-lg"
                    >
                      <h1 className="font-display text-[clamp(2.35rem,4.4vw,4rem)] font-semibold leading-[1.04] tracking-[0.04em] text-[#FAF8F4] [text-wrap:balance]">
                        ELEVATE YOUR STYLE
                      </h1>
                      <p className="mt-3.5 text-base font-normal tracking-wide text-[#EFE9DF] sm:text-lg">
                        Discover Premium Fashion for Every Occasion.
                      </p>

                      <div className="mt-8">
                        <button
                          type="button"
                          onClick={() => openShopWithCategory('All')}
                          className="inline-flex min-h-[48px] items-center gap-3 bg-[#FAF8F4] px-8 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#141414] transition-colors duration-150 hover:bg-[#EFE9DF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4B882]"
                        >
                          <span>EXPLORE COLLECTION</span>
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </section>

              {/* 2. Shop by Category (Men's Fashion Categories) */}
              <section
                id="categories"
                className="border-b border-[#E3DBD0] bg-[#FAF8F4] py-16 md:py-24"
              >
                <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
                  <div className="flex flex-col justify-between gap-4 border-b border-[#E3DBD0] pb-5 sm:flex-row sm:items-end">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#8E6D35]">
                        Men&apos;s Wardrobe
                      </p>
                      <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight text-[#141414] sm:text-4xl">
                        Shop by Category
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => openShopWithCategory('All')}
                      className="inline-flex min-h-[40px] items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-[#141414] underline-offset-4 hover:underline"
                    >
                      <span>View All Categories</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => openShopWithCategory(cat.id)}
                        className="group flex min-w-0 flex-col border border-[#E3DBD0] bg-white text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#C9BFA9] hover:shadow-[0_14px_30px_-18px_rgba(20,20,20,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352]"
                      >
                        <div className="aspect-[4/3] w-full overflow-hidden bg-[#EFE9DF]">
                          <ImageWithFallback
                            src={cat.image}
                            alt={cat.alt}
                            label={cat.name}
                            className="h-full w-full object-cover object-[center_20%] transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                          />
                        </div>
                        <div className="p-3 sm:p-4">
                          <h3 className="text-sm font-semibold text-[#141414] transition-colors group-hover:text-[#8E6D35] sm:text-base">
                            {cat.name}
                          </h3>
                          {cat.subtitle && (
                            <p className="mt-0.5 text-xs text-[#5C574F]">
                              {cat.subtitle}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* 3. NEW ARRIVALS */}
              <section
                id="new-arrivals"
                className="border-b border-[#E3DBD0] bg-white py-16 md:py-24"
              >
                <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
                  <div className="flex flex-col justify-between gap-4 border-b border-[#E3DBD0] pb-5 sm:flex-row sm:items-end">
                    <div>
                      <h2 className="font-display text-3xl font-semibold tracking-[0.03em] text-[#141414] sm:text-4xl">
                        NEW ARRIVALS
                      </h2>
                      <p className="mt-1.5 text-sm text-[#5C574F]">
                        Discover What&apos;s New.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSortBy('newest');
                        openShopWithCategory('All');
                      }}
                      className="inline-flex min-h-[40px] items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-[#141414] underline-offset-4 hover:underline"
                    >
                      <span>View Latest in Shop</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  {newArrivalsProducts.length > 0 && (
                    <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
                      {newArrivalsProducts.slice(0, 4).map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onViewDetails={handleSelectProduct}
                          onOrderProduct={handleOrderFromCard}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* 4. BEST SELLERS (Real order-based ranking only) */}
              <section
                id="best-sellers"
                className="border-b border-[#E3DBD0] bg-[#EFE9DF]/55 py-16 md:py-24"
              >
                <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
                  <div className="flex flex-col justify-between gap-4 border-b border-[#D8CFC2] pb-5 sm:flex-row sm:items-end">
                    <div>
                      <h2 className="font-display text-3xl font-semibold tracking-[0.03em] text-[#141414] sm:text-4xl">
                        BEST SELLERS
                      </h2>
                      <p className="mt-1.5 text-sm text-[#5C574F]">
                        Most Loved Men&apos;s Fashion.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => openShopWithCategory('All')}
                      className="inline-flex min-h-[40px] items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-[#141414] underline-offset-4 hover:underline"
                    >
                      <span>Browse Shop</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  {bestSellingProducts.length > 0 ? (
                    <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
                      {bestSellingProducts.slice(0, 4).map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onViewDetails={handleSelectProduct}
                          onOrderProduct={handleOrderFromCard}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-8 flex flex-col items-start justify-between gap-4 border border-[#D8CFC2] bg-white p-5 sm:flex-row sm:items-center sm:p-8">
                      <div>
                        <p className="text-sm font-medium text-[#141414]">
                          No completed customer orders recorded yet.
                        </p>
                        <p className="mt-1 text-xs text-[#5C574F]">
                          Best sellers update automatically from real customer
                          orders placed on STYLEON.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openShopWithCategory('All')}
                        className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 border border-[#141414] bg-[#141414] px-5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#FAF8F4] whitespace-nowrap transition-colors hover:bg-[#2A2825] sm:w-auto"
                      >
                        <span>Shop Collection</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {/* 5. FEATURED PRODUCTS */}
              {featuredProducts.length > 0 && (
                <section id="featured" className="bg-white py-16 md:py-24">
                  <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
                    <div className="flex flex-col justify-between gap-4 border-b border-[#E3DBD0] pb-5 sm:flex-row sm:items-end">
                      <div>
                        <h2 className="font-display text-3xl font-semibold tracking-[0.03em] text-[#141414] sm:text-4xl">
                          HANDPICKED FOR YOU
                        </h2>
                        <p className="mt-1.5 text-sm text-[#5C574F]">
                          Explore Our Featured Collection.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSortBy('featured');
                          openShopWithCategory('All');
                        }}
                        className="inline-flex min-h-[40px] items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-[#141414] underline-offset-4 hover:underline"
                      >
                        <span>View Shop</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
                      {featuredProducts.slice(0, 4).map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onViewDetails={handleSelectProduct}
                          onOrderProduct={handleOrderFromCard}
                        />
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </main>

        {/* 6. Minimal Footer */}
        <footer className="border-t border-[#26231F] bg-[#141414] text-[#FAF8F4]">
          <div className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 sm:py-14 lg:px-10">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
              <div>
                <p className="font-display text-2xl font-semibold tracking-[0.22em] text-white">
                  STYLEON
                </p>
                <p className="mt-3 max-w-xs text-xs leading-relaxed text-[#B9B1A5]">
                  Premium International Men&apos;s Fashion &amp; Clothing Store
                  in Bangladesh. Direct Cash on Delivery across all 64
                  districts.
                </p>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4B882]">
                  Navigation
                </h3>
                <ul className="mt-4 space-y-2.5 text-sm text-[#D6CFC4]">
                  <li>
                    <a
                      href={getNavTargetPath('home')}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigate('home');
                      }}
                      className="transition-colors hover:text-white"
                    >
                      Home
                    </a>
                  </li>
                  <li>
                    <a
                      href={getNavTargetPath('shop')}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigate('shop');
                      }}
                      className="transition-colors hover:text-white"
                    >
                      Shop
                    </a>
                  </li>
                  <li>
                    <a
                      href={getNavTargetPath('new-arrivals')}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigate('new-arrivals');
                      }}
                      className="transition-colors hover:text-white"
                    >
                      New Arrivals
                    </a>
                  </li>
                  <li>
                    <a
                      href={getNavTargetPath('about')}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigate('about');
                      }}
                      className="transition-colors hover:text-white"
                    >
                      About Us
                    </a>
                  </li>
                  <li>
                    <a
                      href={getNavTargetPath('contact')}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigate('contact');
                      }}
                      className="transition-colors hover:text-white"
                    >
                      Contact
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4B882]">
                  Policies
                </h3>
                <ul className="mt-4 space-y-2.5 text-sm text-[#D6CFC4]">
                  <li>
                    <a
                      href={getNavTargetPath('privacy')}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigate('privacy');
                      }}
                      className="transition-colors hover:text-white"
                    >
                      Privacy Policy
                    </a>
                  </li>
                  <li>
                    <a
                      href={getNavTargetPath('delivery')}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigate('delivery');
                      }}
                      className="transition-colors hover:text-white"
                    >
                      Shipping Policy
                    </a>
                  </li>
                  <li>
                    <a
                      href={getNavTargetPath('returns')}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigate('returns');
                      }}
                      className="transition-colors hover:text-white"
                    >
                      Return &amp; Refund Policy
                    </a>
                  </li>
                  <li>
                    <a
                      href={getNavTargetPath('terms')}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigate('terms');
                      }}
                      className="transition-colors hover:text-white"
                    >
                      Terms &amp; Conditions
                    </a>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        void handleRequestAdminAccess();
                      }}
                      className="transition-colors hover:text-white"
                    >
                      Admin Dashboard
                    </button>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4B882]">
                  Connect
                </h3>
                <p className="mt-4 text-xs tabular-nums text-[#D6CFC4]">
                  WhatsApp:{' '}
                  <a
                    href={buildWhatsAppUrl(
                      "Hello STYLEON, I would like to inquire about your men's collection.",
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-4 hover:text-white hover:underline"
                  >
                    {STORE_CONFIG.whatsappDisplay}
                  </a>
                </p>
                <p className="mt-1.5 break-words text-xs text-[#B9B1A5]">
                  Email: {STORE_CONFIG.email}
                </p>

                <a
                  href={STORE_CONFIG.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex min-h-[42px] items-center gap-2 border border-[#D4B882]/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#FAF8F4] transition-colors hover:border-white hover:bg-white hover:text-[#141414]"
                >
                  <Facebook className="h-4 w-4" aria-hidden="true" />
                  <span>FOLLOW US ON FACEBOOK</span>
                </a>
              </div>
            </div>

            <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-[#26231F] pt-6 text-xs text-[#9E9689] sm:flex-row sm:items-center">
              <p>© {new Date().getFullYear()} STYLEON. All rights reserved.</p>
              <p>
                Bangladeshi Taka (BDT / ৳) · Flat{' '}
                {formatBdt(deliveryChargeBdt)} Delivery Nationwide
              </p>
            </div>
          </div>
        </footer>

        {/* Slide-Over Order Bag */}
        <BagDrawer
          isOpen={bagOpen}
          items={bagItems}
          deliveryChargeBdt={deliveryChargeBdt}
          onClose={() => setBagOpen(false)}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onOrderPlaced={() => {
            setBagItems([]);
            void loadStorefront();
          }}
        />

        {/* Admin Password Login Popup */}
        {adminLoginOpen && !isAdminAuthenticated && (
          <Suspense fallback={null}>
            <AdminPasswordLogin
              variant="modal"
              onSuccess={() => handleAdminLoginSuccess()}
              onClose={() => setAdminLoginOpen(false)}
            />
          </Suspense>
        )}

        {/* Admin Dashboard Modal (Only mounted when server-authenticated) */}
        {isAdminAuthenticated && (
          <Suspense fallback={null}>
            <AdminDashboardModal
              isOpen={adminOpen}
              products={products}
              categories={categories}
              orders={orders}
              stockHistory={stockHistory}
              notifications={notifications}
              deliveryChargeBdt={deliveryChargeBdt}
              onRefreshAdminData={handleRefreshAdminData}
              onMarkNotificationsRead={handleMarkNotificationsRead}
              onUpdateDeliveryCharge={handleUpdateDeliveryCharge}
              onClose={() => {
                setAdminOpen(false);
                void loadStorefront();
              }}
              onLogout={() => {
                void handleAdminLogout();
              }}
              onPublishProduct={handlePublishProduct}
              onTogglePublish={handleTogglePublish}
              onDeleteProduct={handleDeleteProduct}
              onImportProducts={handleImportProducts}
              onResetToDefaults={handleResetToDefaults}
              onUpdateCategories={handleUpdateCategories}
              onResetCategories={handleResetCategories}
              onUpdateProductStock={handleUpdateProductStock}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onUpdateOrderCustomer={handleUpdateOrderCustomer}
              onDeleteOrder={handleDeleteOrder}
            />
          </Suspense>
        )}
      </div>
    </MotionConfig>
  );
}

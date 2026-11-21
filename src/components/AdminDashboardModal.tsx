import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Bell,
  Boxes,
  Check,
  CopyPlus,
  Download,
  Eye,
  EyeOff,
  FolderUp,
  ImagePlus,
  Layers,
  LogOut,
  Menu,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CategoryDefinition,
  formatBdt,
  getEffectivePrice,
  getProductCategories,
  getProductSubcategories,
  normalizeProduct,
  Product,
} from '../data/catalog';
import { computeBusinessMetrics } from '../utils/adminAnalytics';
import { UpdateOrderCustomerPayload } from '../utils/adminApi';
import {
  AdminNotification,
  OrderStatus,
  StockHistoryEntry,
  StoredOrder,
} from '../utils/orders';
import { AdminCustomersTab } from './AdminCustomersTab';
import { AdminInventoryTab } from './AdminInventoryTab';
import { AdminOrdersTab } from './AdminOrdersTab';
import { AdminReportsTab } from './AdminReportsTab';
import { ImageWithFallback } from './ImageWithFallback';
import { PrintableInvoiceModal } from './PrintableInvoiceModal';

interface AdminDashboardModalProps {
  isOpen: boolean;
  products: Product[];
  categories: CategoryDefinition[];
  orders: StoredOrder[];
  stockHistory: StockHistoryEntry[];
  notifications: AdminNotification[];
  deliveryChargeBdt?: number;
  onRefreshAdminData?: () => Promise<void>;
  onMarkNotificationsRead: (opts: { id?: string; all?: boolean }) => Promise<void>;
  onUpdateDeliveryCharge: (charge: number) => Promise<void>;
  onClose: () => void;
  onLogout: () => void;
  onPublishProduct: (product: Product, isEdit: boolean) => void;
  onTogglePublish: (productId: string) => void;
  onDeleteProduct: (productId: string) => void;
  onImportProducts: (imported: Product[]) => void;
  onResetToDefaults: () => void;
  onUpdateCategories: (categories: CategoryDefinition[]) => void;
  onResetCategories: () => void;
  onUpdateProductStock: (
    productId: string,
    stockQuantity: number | null,
    note?: string,
  ) => Promise<void>;
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
}

type AdminTab =
  | 'products'
  | 'categories'
  | 'orders'
  | 'customers'
  | 'inventory'
  | 'reports';

const SIZE_PRESETS = ['S', 'M', 'L', 'XL', 'XXL', 'Free Size'];
const COLOR_PRESETS = ['Black', 'White', 'Cream', 'Beige', 'Navy', 'Olive', 'Charcoal'];

async function compressImageFile(file: File, maxWidth = 960, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const targetW = Math.max(1, Math.round(img.width * scale));
        const targetH = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        try {
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function slugifyId(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return base || `item-${Date.now()}`;
}

export function AdminDashboardModal({
  isOpen,
  products,
  categories,
  orders,
  stockHistory,
  notifications,
  deliveryChargeBdt = 100,
  onRefreshAdminData,
  onMarkNotificationsRead,
  onUpdateDeliveryCharge,
  onClose,
  onLogout,
  onPublishProduct,
  onTogglePublish,
  onDeleteProduct,
  onImportProducts,
  onResetToDefaults,
  onUpdateCategories,
  onResetCategories,
  onUpdateProductStock,
  onUpdateOrderStatus,
  onUpdateOrderCustomer,
  onDeleteOrder,
}: AdminDashboardModalProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('products');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Product Editor State
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodCategories, setProdCategories] = useState<string[]>(() =>
    categories[0] ? [categories[0].id] : ['Shirts'],
  );
  const [prodSubcategories, setProdSubcategories] = useState<string[]>([]);
  const [prodPrice, setProdPrice] = useState('');
  const [prodDiscountPrice, setProdDiscountPrice] = useState('');
  const [prodStock, setProdStock] = useState('');
  const [prodShortDesc, setProdShortDesc] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodImages, setProdImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [prodSizes, setProdSizes] = useState<string[]>(['M', 'L', 'XL']);
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [prodColors, setProdColors] = useState<string[]>([]);
  const [customColorInput, setCustomColorInput] = useState('');
  const [prodPublished, setProdPublished] = useState(true);
  const [prodFeatured, setProdFeatured] = useState(false);
  const [prodNewArrival, setProdNewArrival] = useState(true);
  const [prodFormError, setProdFormError] = useState('');
  const [prodFormSuccess, setProdFormSuccess] = useState('');
  const [uploadingImages, setUploadingImages] = useState(false);

  // Catalog Management State
  const [catalogSearch, setCatalogSearch] = useState('');
  const [confirmDeleteProdId, setConfirmDeleteProdId] = useState<string | null>(null);
  const [confirmResetCatalog, setConfirmResetCatalog] = useState(false);

  // Category Editor State
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catSubtitle, setCatSubtitle] = useState('');
  const [catImage, setCatImage] = useState('');
  const [catSubInput, setCatSubInput] = useState('');
  const [catSubcategories, setCatSubcategories] = useState<string[]>([]);
  const [catError, setCatError] = useState('');
  const [catSuccess, setCatSuccess] = useState('');
  const [confirmDeleteCatId, setConfirmDeleteCatId] = useState<string | null>(null);
  const [confirmResetCats, setConfirmResetCats] = useState(false);
  const [quickSubInputs, setQuickSubInputs] = useState<Record<string, string>>({});

  // Orders, Notifications, Overview & Invoice State
  const [inspectOrderId, setInspectOrderId] = useState<string | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<StoredOrder | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showOverview, setShowOverview] = useState(true);

  const importInputRef = useRef<HTMLInputElement | null>(null);
  const notifPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (invoiceOrder) return;
        if (notificationsOpen) {
          setNotificationsOpen(false);
          return;
        }
        if (mobileNavOpen) {
          setMobileNavOpen(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, invoiceOrder, notificationsOpen, mobileNavOpen]);

  // Close notifications dropdown on outside click
  useEffect(() => {
    if (!notificationsOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (
        notifPanelRef.current &&
        !notifPanelRef.current.contains(e.target as Node)
      ) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [notificationsOpen]);

  // Periodic background polling (every 15s while dashboard is open)
  useEffect(() => {
    if (!isOpen || !onRefreshAdminData) return;
    const timer = window.setInterval(() => {
      void onRefreshAdminData();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [isOpen, onRefreshAdminData]);

  const availableSubcategoriesForSelected = useMemo(() => {
    const subs = new Set<string>();
    categories.forEach((cat) => {
      if (prodCategories.includes(cat.id)) {
        cat.subcategories.forEach((s) => subs.add(s));
      }
    });
    return Array.from(subs);
  }, [categories, prodCategories]);

  const filteredProducts = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const cats = getProductCategories(p).join(' ').toLowerCase();
      const subs = getProductSubcategories(p).join(' ').toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        cats.includes(q) ||
        subs.includes(q) ||
        p.shortDescription.toLowerCase().includes(q)
      );
    });
  }, [products, catalogSearch]);

  const metrics = useMemo(
    () => computeBusinessMetrics(orders, products, categories),
    [orders, products, categories],
  );

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const handleManualRefresh = async () => {
    if (!onRefreshAdminData || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefreshAdminData();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!isOpen) return null;

  const resetProductForm = () => {
    setEditingProductId(null);
    setProdName('');
    setProdCategories(categories[0] ? [categories[0].id] : ['Shirts']);
    setProdSubcategories([]);
    setProdPrice('');
    setProdDiscountPrice('');
    setProdStock('');
    setProdShortDesc('');
    setProdDesc('');
    setProdImages([]);
    setImageUrlInput('');
    setProdSizes(['M', 'L', 'XL']);
    setCustomSizeInput('');
    setProdColors([]);
    setCustomColorInput('');
    setProdPublished(true);
    setProdFeatured(false);
    setProdNewArrival(true);
    setProdFormError('');
  };

  const handleEditProduct = (product: Product) => {
    setEditingProductId(product.id);
    setProdName(product.name);
    setProdCategories(getProductCategories(product));
    setProdSubcategories(getProductSubcategories(product));
    setProdPrice(String(product.priceBdt));
    setProdDiscountPrice(
      product.discountedPriceBdt !== null ? String(product.discountedPriceBdt) : '',
    );
    setProdStock(
      product.stockQuantity !== null && product.stockQuantity !== undefined
        ? String(product.stockQuantity)
        : '',
    );
    setProdShortDesc(product.shortDescription);
    setProdDesc(product.description);
    setProdImages(product.images);
    setProdSizes(product.sizes);
    setProdColors(product.colors);
    setProdPublished(product.published);
    setProdFeatured(product.isFeatured);
    setProdNewArrival(product.isNewArrival);
    setProdFormError('');
    setProdFormSuccess('');
    setActiveTab('products');
  };

  const handleDuplicateProduct = (product: Product) => {
    const duplicate: Product = {
      ...product,
      id: `prod-${slugifyId(product.name)}-${Date.now().toString(36)}`,
      name: `${product.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onPublishProduct(duplicate, false);
    setProdFormSuccess(`Duplicated "${product.name}".`);
    window.setTimeout(() => setProdFormSuccess(''), 2500);
  };

  const handleFilesUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const imageFiles = Array.from(fileList).filter((f) =>
      f.type.startsWith('image/'),
    );
    if (imageFiles.length === 0) {
      setProdFormError('No valid image files found in the selection.');
      return;
    }

    setUploadingImages(true);
    setProdFormError('');
    try {
      const compressed: string[] = [];
      for (const file of imageFiles.slice(0, 20)) {
        const dataUrl = await compressImageFile(file);
        compressed.push(dataUrl);
      }
      setProdImages((prev) => [...prev, ...compressed]);
    } catch {
      setProdFormError('Failed to process selected image files.');
    } finally {
      setUploadingImages(false);
    }
  };

  const handleAddImageUrl = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) return;
    setProdImages((prev) => [...prev, trimmed]);
    setImageUrlInput('');
  };

  const moveImage = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= prodImages.length) return;
    setProdImages((prev) => {
      const next = [...prev];
      const [removed] = next.splice(idx, 1);
      next.splice(target, 0, removed);
      return next;
    });
  };

  const toggleCategorySelection = (catId: string) => {
    setProdCategories((prev) => {
      const exists = prev.includes(catId);
      const next = exists ? prev.filter((c) => c !== catId) : [...prev, catId];
      return next;
    });
  };

  const toggleSubcategorySelection = (sub: string) => {
    setProdSubcategories((prev) =>
      prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub],
    );
  };

  const toggleSize = (size: string) => {
    setProdSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size],
    );
  };

  const handleAddCustomSize = () => {
    const trimmed = customSizeInput.trim();
    if (!trimmed) return;
    if (!prodSizes.includes(trimmed)) {
      setProdSizes((prev) => [...prev, trimmed]);
    }
    setCustomSizeInput('');
  };

  const toggleColor = (color: string) => {
    setProdColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color],
    );
  };

  const handleAddCustomColor = () => {
    const trimmed = customColorInput.trim();
    if (!trimmed) return;
    if (!prodColors.includes(trimmed)) {
      setProdColors((prev) => [...prev, trimmed]);
    }
    setCustomColorInput('');
  };

  const handleSubmitProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setProdFormError('');
    setProdFormSuccess('');

    const name = prodName.trim();
    const regularPrice = Number(prodPrice);
    const discountPriceRaw = prodDiscountPrice.trim();
    const discountPrice = discountPriceRaw ? Number(discountPriceRaw) : null;
    const stockRaw = prodStock.trim();
    const stockQty = stockRaw !== '' ? Math.max(0, Math.floor(Number(stockRaw))) : null;

    if (!name) {
      setProdFormError('Product name is required.');
      return;
    }
    if (!Number.isFinite(regularPrice) || regularPrice <= 0) {
      setProdFormError('Please enter a valid Regular Price in BDT.');
      return;
    }
    if (
      discountPrice !== null &&
      (!Number.isFinite(discountPrice) ||
        discountPrice <= 0 ||
        discountPrice >= regularPrice)
    ) {
      setProdFormError(
        'Discounted price must be greater than 0 and lower than the regular price.',
      );
      return;
    }
    if (prodCategories.length === 0) {
      setProdFormError('Please select at least one category.');
      return;
    }
    if (prodImages.length === 0) {
      setProdFormError('Please upload at least one product photo.');
      return;
    }

    const existing = editingProductId
      ? products.find((p) => p.id === editingProductId)
      : null;

    const productRecord: Product = normalizeProduct({
      id:
        editingProductId ??
        `prod-${slugifyId(name)}-${Date.now().toString(36)}`,
      name,
      category: prodCategories[0],
      categories: prodCategories,
      subcategories: prodSubcategories,
      priceBdt: Math.round(regularPrice),
      discountedPriceBdt: discountPrice !== null ? Math.round(discountPrice) : null,
      shortDescription:
        prodShortDesc.trim() || prodDesc.trim().slice(0, 140) || name,
      description: prodDesc.trim() || prodShortDesc.trim() || name,
      images: prodImages,
      sizes: prodSizes,
      colors: prodColors,
      stockQuantity:
        stockQty !== null && Number.isFinite(stockQty) ? stockQty : null,
      published: prodPublished,
      isFeatured: prodFeatured,
      isNewArrival: prodNewArrival,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    });

    onPublishProduct(productRecord, Boolean(editingProductId));
    setProdFormSuccess(
      editingProductId
        ? `Updated "${productRecord.name}".`
        : `Published "${productRecord.name}" to STYLEON.`,
    );
    resetProductForm();
    window.setTimeout(() => setProdFormSuccess(''), 3000);
  };

  const handleExportCatalog = () => {
    const payload = JSON.stringify(products, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `styleon-catalog-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        setProdFormError('Invalid catalog JSON file: expected an array of products.');
        return;
      }
      const normalized = parsed
        .filter((item) => item && typeof item === 'object' && item.name)
        .map((item) => normalizeProduct(item as Product));
      if (normalized.length === 0) {
        setProdFormError('No valid product entries found in the imported JSON.');
        return;
      }
      onImportProducts(normalized);
      setProdFormSuccess(`Imported ${normalized.length} products into catalog.`);
      setProdFormError('');
    } catch {
      setProdFormError('Could not parse JSON catalog file.');
    } finally {
      e.target.value = '';
    }
  };

  // Category Handlers
  const resetCategoryForm = () => {
    setEditingCategoryId(null);
    setCatName('');
    setCatSubtitle('');
    setCatImage('');
    setCatSubInput('');
    setCatSubcategories([]);
    setCatError('');
  };

  const handleEditCategory = (cat: CategoryDefinition) => {
    setEditingCategoryId(cat.id);
    setCatName(cat.name);
    setCatSubtitle(cat.subtitle);
    setCatImage(cat.image);
    setCatSubcategories(cat.subcategories);
    setCatError('');
    setCatSuccess('');
  };

  const handleCategoryImageUpload = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const dataUrl = await compressImageFile(file, 800, 0.82);
      setCatImage(dataUrl);
    } catch {
      setCatError('Failed to process category image.');
    }
  };

  const handleAddCatSub = () => {
    const trimmed = catSubInput.trim();
    if (!trimmed) return;
    if (!catSubcategories.includes(trimmed)) {
      setCatSubcategories((prev) => [...prev, trimmed]);
    }
    setCatSubInput('');
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setCatError('');
    setCatSuccess('');

    const trimmedName = catName.trim();
    if (!trimmedName) {
      setCatError('Category name is required.');
      return;
    }

    if (editingCategoryId) {
      const next = categories.map((c) =>
        c.id === editingCategoryId
          ? {
              ...c,
              name: trimmedName,
              subtitle: catSubtitle.trim() || "Men's collection",
              image: catImage.trim() || c.image,
              alt: `${trimmedName} — STYLEON men's fashion`,
              subcategories: catSubcategories,
            }
          : c,
      );
      onUpdateCategories(next);
      setCatSuccess(`Updated category "${trimmedName}".`);
      resetCategoryForm();
      return;
    }

    const exists = categories.some(
      (c) =>
        c.id.toLowerCase() === trimmedName.toLowerCase() ||
        c.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (exists) {
      setCatError('A category with this name already exists.');
      return;
    }

    const newCat: CategoryDefinition = {
      id: trimmedName,
      name: trimmedName,
      subtitle: catSubtitle.trim() || "Men's essentials",
      image:
        catImage.trim() ||
        '/src/assets/images/category_shirts_editorial_1794766023311.jpg',
      alt: `${trimmedName} — STYLEON men's fashion`,
      subcategories: catSubcategories,
      sortOrder: categories.length,
    };

    onUpdateCategories([...categories, newCat]);
    setCatSuccess(`Added category "${trimmedName}".`);
    resetCategoryForm();
  };

  const moveCategory = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= categories.length) return;
    const next = [...categories];
    const [removed] = next.splice(idx, 1);
    next.splice(target, 0, removed);
    onUpdateCategories(next.map((c, i) => ({ ...c, sortOrder: i })));
  };

  const handleQuickAddSubcategory = (catId: string) => {
    const val = (quickSubInputs[catId] || '').trim();
    if (!val) return;
    const next = categories.map((c) =>
      c.id === catId && !c.subcategories.includes(val)
        ? { ...c, subcategories: [...c.subcategories, val] }
        : c,
    );
    onUpdateCategories(next);
    setQuickSubInputs((prev) => ({ ...prev, [catId]: '' }));
  };

  const handleQuickRemoveSubcategory = (catId: string, sub: string) => {
    const next = categories.map((c) =>
      c.id === catId
        ? { ...c, subcategories: c.subcategories.filter((s) => s !== sub) }
        : c,
    );
    onUpdateCategories(next);
  };

  const lowOrOutStockCount =
    metrics.lowStockProducts.length + metrics.outOfStockProducts.length;

  const navItems: {
    id: AdminTab;
    label: string;
    shortLabel: string;
    count?: number;
    badgeCount?: number;
    badgeTone?: 'amber' | 'red';
    icon: typeof Package;
  }[] = [
    {
      id: 'products',
      label: `Products (${products.length})`,
      shortLabel: 'Products',
      count: products.length,
      icon: Package,
    },
    {
      id: 'categories',
      label: `Categories (${categories.length})`,
      shortLabel: 'Categories',
      count: categories.length,
      icon: Layers,
    },
    {
      id: 'orders',
      label: `Orders (${orders.length})`,
      shortLabel: 'Orders',
      count: orders.length,
      badgeCount: metrics.pendingOrders,
      badgeTone: 'amber',
      icon: ShoppingBag,
    },
    {
      id: 'customers',
      label: `Customers (${metrics.totalCustomers})`,
      shortLabel: 'Customers',
      count: metrics.totalCustomers,
      icon: Users,
    },
    {
      id: 'inventory',
      label: 'Inventory',
      shortLabel: 'Inventory',
      badgeCount: lowOrOutStockCount,
      badgeTone: 'red',
      icon: Boxes,
    },
    {
      id: 'reports',
      label: 'Reports & Delivery',
      shortLabel: 'Reports & Delivery',
      icon: BarChart3,
    },
  ];

  const activeNavMeta =
    navItems.find((item) => item.id === activeTab) ?? navItems[0];

  const handleSelectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-0 sm:p-4 lg:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="STYLEON Admin Dashboard"
      onClick={onClose}
    >
      <div
        className="relative flex h-[100dvh] w-full max-w-7xl flex-col overflow-hidden border-[#D8CFC2] bg-[#FAF8F4] shadow-2xl sm:h-[92vh] sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="shrink-0 border-b border-[#E3DBD0] bg-white px-3.5 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen((prev) => !prev)}
                aria-expanded={mobileNavOpen}
                aria-label={mobileNavOpen ? 'Close admin menu' : 'Open admin menu'}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-[#E3DBD0] bg-[#FAF8F4] text-[#141414] transition-colors hover:border-[#141414] lg:hidden"
              >
                {mobileNavOpen ? (
                  <X className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Menu className="h-4 w-4" aria-hidden="true" />
                )}
              </button>

              <div className="min-w-0">
                <p className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8E6D35] sm:block sm:text-[11px]">
                  STYLEON Store Management
                </p>
                <h2 className="font-display truncate text-lg font-semibold text-[#141414] sm:text-2xl">
                  Admin Dashboard
                </h2>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {metrics.pendingOrders > 0 && (
                <button
                  type="button"
                  onClick={() => handleSelectTab('orders')}
                  className="hidden min-h-[38px] items-center gap-1.5 border border-[#8E6D35]/45 bg-[#FDF8EC] px-3 py-1.5 text-xs font-semibold text-[#8E6D35] transition-colors hover:border-[#8E6D35] md:inline-flex"
                >
                  <span className="h-2 w-2 rounded-full bg-[#8E6D35]" />
                  <span className="tabular-nums">
                    {metrics.pendingOrders} Pending Order
                    {metrics.pendingOrders === 1 ? '' : 's'}
                  </span>
                </button>
              )}

              {onRefreshAdminData && (
                <button
                  type="button"
                  onClick={() => void handleManualRefresh()}
                  disabled={isRefreshing}
                  aria-label="Refresh Dashboard Data"
                  className="inline-flex h-[38px] min-w-[38px] items-center justify-center gap-1.5 border border-[#E3DBD0] bg-[#FAF8F4] px-2.5 text-xs font-medium text-[#141414] transition-colors hover:border-[#141414] disabled:opacity-60 sm:px-3"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              )}

              {/* Notifications Bell & Dropdown */}
              <div className="relative" ref={notifPanelRef}>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((prev) => !prev)}
                  aria-label="Admin Notifications"
                  aria-expanded={notificationsOpen}
                  className={`relative inline-flex h-[38px] min-w-[38px] items-center justify-center gap-1.5 border px-2.5 text-xs font-medium transition-colors sm:px-3 ${
                    notificationsOpen
                      ? 'border-[#141414] bg-[#141414] text-[#FAF8F4]'
                      : 'border-[#E3DBD0] bg-[#FAF8F4] text-[#141414] hover:border-[#141414]'
                  }`}
                >
                  <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                  {unreadNotificationsCount > 0 && (
                    <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#9B2C2C] px-1 text-[10px] font-bold tabular-nums text-white">
                      {unreadNotificationsCount > 99
                        ? '99+'
                        : unreadNotificationsCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="fixed inset-x-3 top-16 z-40 border border-[#D8CFC2] bg-white shadow-xl sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-96">
                    <div className="flex items-center justify-between gap-2 border-b border-[#EFE9DF] px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#141414]">
                          Notifications ({notifications.length})
                        </p>
                        <p className="truncate text-[11px] text-[#5C574F]">
                          Orders, cancellations &amp; stock threshold alerts
                        </p>
                      </div>
                      {unreadNotificationsCount > 0 && (
                        <button
                          type="button"
                          onClick={() => void onMarkNotificationsRead({ all: true })}
                          className="shrink-0 text-[11px] font-semibold text-[#8E6D35] underline-offset-4 hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-[#5C574F]">
                        No notifications yet. New customer orders and stock alerts appear here automatically.
                      </div>
                    ) : (
                      <ul className="max-h-[60vh] divide-y divide-[#EFE9DF] overflow-y-auto sm:max-h-80">
                        {notifications.slice(0, 25).map((notif) => (
                          <li key={notif.id}>
                            <button
                              type="button"
                              onClick={() => {
                                if (!notif.read) {
                                  void onMarkNotificationsRead({ id: notif.id });
                                }
                                if (notif.orderId) {
                                  setInspectOrderId(notif.orderId);
                                  handleSelectTab('orders');
                                } else if (notif.productId) {
                                  handleSelectTab('inventory');
                                }
                                setNotificationsOpen(false);
                              }}
                              className={`block w-full px-4 py-3 text-left transition-colors hover:bg-[#FAF8F4] ${
                                notif.read ? 'bg-white' : 'bg-[#FDFBF6]'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs font-semibold text-[#141414]">
                                  {notif.title}
                                </span>
                                {!notif.read && (
                                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#8E6D35]" />
                                )}
                              </div>
                              <p className="mt-0.5 text-[11px] text-[#5C574F]">
                                {notif.message}
                              </p>
                              <p className="mt-1 text-[10px] text-[#7A746B]">
                                {new Date(notif.createdAt).toLocaleString()}
                              </p>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={onLogout}
                aria-label="Logout"
                className="inline-flex h-[38px] items-center justify-center gap-1.5 border border-[#9B2C2C]/35 bg-white px-2.5 text-xs font-semibold uppercase tracking-wider text-[#9B2C2C] transition-colors hover:border-[#9B2C2C] hover:bg-[#FFF5F5] sm:px-3.5"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Logout</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close Admin Dashboard"
                className="inline-flex h-[38px] w-[38px] items-center justify-center border border-[#E3DBD0] bg-white text-[#141414] transition-colors hover:border-[#141414]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Mobile / Tablet Active Section & Quick Drawer Strip */}
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#EFE9DF] pt-2.5 lg:hidden">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="inline-flex min-h-[34px] items-center gap-1.5 border border-[#141414] bg-[#141414] px-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#FAF8F4]"
              >
                <activeNavMeta.icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="truncate">{activeNavMeta.label}</span>
              </button>

              {metrics.pendingOrders > 0 && activeTab !== 'orders' && (
                <button
                  type="button"
                  onClick={() => handleSelectTab('orders')}
                  className="inline-flex min-h-[34px] items-center gap-1 border border-[#8E6D35]/45 bg-[#FDF8EC] px-2.5 text-[11px] font-semibold text-[#8E6D35] md:hidden"
                >
                  <span className="tabular-nums">{metrics.pendingOrders} Pending</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowOverview((prev) => !prev)}
              className="text-[11px] font-medium text-[#5C574F] underline underline-offset-4 hover:text-[#141414]"
            >
              {showOverview ? 'Hide KPIs' : 'Show KPIs'}
            </button>
          </div>
        </div>

        {/* Workspace Shell: Persistent Desktop Sidebar + Mobile Collapsible Drawer + Scrollable Body */}
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {/* Desktop Sidebar */}
          <aside
            aria-label="Admin dashboard sections"
            className="hidden w-60 shrink-0 flex-col justify-between overflow-y-auto border-r border-[#E3DBD0] bg-white p-4 lg:flex"
          >
            <nav className="space-y-1.5">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8E6D35]">
                Sections
              </p>
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectTab(item.id)}
                    className={`flex min-h-[42px] w-full items-center justify-between gap-2 border px-3 py-2 text-left text-xs font-semibold tracking-wider uppercase transition-colors ${
                      active
                        ? 'border-[#141414] bg-[#141414] text-[#FAF8F4]'
                        : 'border-transparent bg-transparent text-[#141414] hover:border-[#E3DBD0] hover:bg-[#FAF8F4]'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                          item.badgeTone === 'red'
                            ? active
                              ? 'bg-[#9B2C2C] text-white'
                              : 'bg-[#FFF5F5] text-[#9B2C2C]'
                            : active
                              ? 'bg-[#8E6D35] text-white'
                              : 'bg-[#FDF8EC] text-[#8E6D35]'
                        }`}
                      >
                        {item.badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="mt-6 space-y-2 border-t border-[#EFE9DF] pt-4">
              <button
                type="button"
                onClick={() => setShowOverview((prev) => !prev)}
                className="flex min-h-[38px] w-full items-center justify-center border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-[11px] font-medium text-[#141414] transition-colors hover:border-[#141414]"
              >
                {showOverview ? 'Hide KPI Overview' : 'Show KPI Overview'}
              </button>
            </div>
          </aside>

          {/* Mobile / Tablet Collapsible Slide-Over Drawer */}
          {mobileNavOpen && (
            <div
              className="absolute inset-0 z-30 flex bg-black/45 lg:hidden"
              onClick={() => setMobileNavOpen(false)}
            >
              <aside
                aria-label="Mobile admin navigation drawer"
                className="flex h-full w-72 max-w-[85vw] flex-col justify-between overflow-y-auto border-r border-[#D8CFC2] bg-white p-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-[#EFE9DF] pb-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8E6D35]">
                        STYLEON Admin
                      </p>
                      <p className="text-sm font-semibold text-[#141414]">
                        Navigation Menu
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMobileNavOpen(false)}
                      aria-label="Close menu drawer"
                      className="inline-flex h-9 w-9 items-center justify-center border border-[#E3DBD0] text-[#141414]"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <nav className="mt-3 space-y-1.5">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectTab(item.id)}
                          className={`flex min-h-[44px] w-full items-center justify-between gap-2 border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider transition-colors ${
                            active
                              ? 'border-[#141414] bg-[#141414] text-[#FAF8F4]'
                              : 'border-[#E3DBD0] bg-[#FAF8F4] text-[#141414]'
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">{item.label}</span>
                          </span>
                          {typeof item.badgeCount === 'number' &&
                            item.badgeCount > 0 && (
                              <span
                                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                                  item.badgeTone === 'red'
                                    ? 'bg-[#9B2C2C] text-white'
                                    : 'bg-[#8E6D35] text-white'
                                }`}
                              >
                                {item.badgeCount}
                              </span>
                            )}
                        </button>
                      );
                    })}
                  </nav>
                </div>

                <div className="mt-6 space-y-2 border-t border-[#EFE9DF] pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowOverview((prev) => !prev);
                      setMobileNavOpen(false);
                    }}
                    className="min-h-[40px] w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-xs font-medium text-[#141414]"
                  >
                    {showOverview ? 'Hide KPI Overview' : 'Show KPI Overview'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileNavOpen(false);
                      onLogout();
                    }}
                    className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 border border-[#9B2C2C]/40 bg-[#FFF5F5] px-3 text-xs font-semibold uppercase tracking-wider text-[#9B2C2C]"
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Logout</span>
                  </button>
                </div>
              </aside>
            </div>
          )}

          {/* Main Scrollable Content Area */}
          <div className="min-w-0 flex-1 overflow-y-auto p-3.5 sm:p-6">
            {/* Business Overview KPI Strip (Section 8 — 10 Real Database Metrics) */}
            {showOverview && (
              <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
                <button
                  type="button"
                  onClick={() => handleSelectTab('products')}
                  className="min-w-0 border border-[#E3DBD0] bg-white p-3 text-left transition-colors hover:border-[#141414]"
                >
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-[#5C574F]">
                    Total Products
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-[#141414] sm:text-xl">
                    {metrics.totalProducts}
                  </p>
                </button>

              <button
                type="button"
                onClick={() => handleSelectTab('categories')}
                className="min-w-0 border border-[#E3DBD0] bg-white p-3 text-left transition-colors hover:border-[#141414]"
              >
                <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-[#5C574F]">
                  Total Categories
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-[#141414] sm:text-xl">
                  {metrics.totalCategories}
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('orders')}
                className="min-w-0 border border-[#E3DBD0] bg-white p-3 text-left transition-colors hover:border-[#141414]"
              >
                <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-[#5C574F]">
                  Total Orders
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-[#141414] sm:text-xl">
                  {metrics.totalOrders}
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('orders')}
                className="min-w-0 border border-[#E3DBD0] bg-white p-3 text-left transition-colors hover:border-[#8E6D35]"
              >
                <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-[#8E6D35]">
                  Pending Orders
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-[#8E6D35] sm:text-xl">
                  {metrics.pendingOrders}
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('orders')}
                className="min-w-0 border border-[#E3DBD0] bg-white p-3 text-left transition-colors hover:border-[#141414]"
              >
                <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-[#1E40AF]">
                  Confirmed Orders
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-[#1E40AF] sm:text-xl">
                  {metrics.confirmedOrders}
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('orders')}
                className="min-w-0 border border-[#E3DBD0] bg-white p-3 text-left transition-colors hover:border-[#15803D]"
              >
                <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-[#15803D]">
                  Delivered Orders
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-[#15803D] sm:text-xl">
                  {metrics.deliveredOrders}
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('orders')}
                className="min-w-0 border border-[#E3DBD0] bg-white p-3 text-left transition-colors hover:border-[#9B2C2C]"
              >
                <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-[#9B2C2C]">
                  Cancelled Orders
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-[#9B2C2C] sm:text-xl">
                  {metrics.cancelledOrders}
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('customers')}
                className="min-w-0 border border-[#E3DBD0] bg-white p-3 text-left transition-colors hover:border-[#141414]"
              >
                <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-[#5C574F]">
                  Total Customers
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-[#141414] sm:text-xl">
                  {metrics.totalCustomers}
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('inventory')}
                className="min-w-0 border border-[#E3DBD0] bg-white p-3 text-left transition-colors hover:border-[#9B2C2C]"
              >
                <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-[#9B2C2C]">
                  Low Stock Products
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-[#141414] sm:text-xl">
                  {metrics.lowStockProducts.length +
                    metrics.outOfStockProducts.length}
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('reports')}
                className="min-w-0 border border-[#E3DBD0] bg-white p-3 text-left transition-colors hover:border-[#15803D]"
              >
                <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-[#15803D]">
                  Delivered Revenue
                </p>
                <p className="mt-1 break-words text-base font-semibold tabular-nums text-[#141414] sm:text-xl">
                  {formatBdt(metrics.deliveredRevenue)}
                </p>
              </button>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Product Upload / Editor Form */}
              <form
                onSubmit={handleSubmitProduct}
                className="min-w-0 space-y-5 border border-[#E3DBD0] bg-white p-4 sm:p-6 lg:col-span-6"
              >
                <div className="flex items-center justify-between border-b border-[#EFE9DF] pb-3">
                  <h3 className="font-display text-xl font-semibold text-[#141414]">
                    {editingProductId ? 'Edit Product' : 'Add New Product'}
                  </h3>
                  {editingProductId && (
                    <button
                      type="button"
                      onClick={resetProductForm}
                      className="text-xs font-medium text-[#8E6D35] underline-offset-4 hover:underline"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                {prodFormError && (
                  <div
                    role="alert"
                    className="border border-[#9B2C2C]/30 bg-[#FFF5F5] p-3 text-xs text-[#9B2C2C]"
                  >
                    {prodFormError}
                  </div>
                )}

                {prodFormSuccess && (
                  <div
                    role="status"
                    className="flex items-center gap-2 border border-[#15803D]/30 bg-[#F0FDF4] p-3 text-xs text-[#15803D]"
                  >
                    <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{prodFormSuccess}</span>
                  </div>
                )}

                {/* Images Upload */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#141414]">
                    Product Photos ({prodImages.length})
                  </label>
                  <p className="mt-1 text-[11px] text-[#5C574F]">
                    Upload multiple photos or an entire folder. Photos are automatically compressed for fast browsing.
                  </p>

                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 border border-[#141414] bg-[#141414] px-3.5 py-2 text-xs font-medium text-[#FAF8F4] transition-colors hover:bg-[#2A2825]">
                      <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{uploadingImages ? 'Processing...' : 'Upload Images'}</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          void handleFilesUpload(e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </label>

                    <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 border border-[#141414] bg-white px-3.5 py-2 text-xs font-medium text-[#141414] transition-colors hover:bg-[#EFE9DF]">
                      <FolderUp className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Upload Folder</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="sr-only"
                        {...({
                          webkitdirectory: '',
                          directory: '',
                        } as React.InputHTMLAttributes<HTMLInputElement>)}
                        onChange={(e) => {
                          void handleFilesUpload(e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="Or paste image URL (/assets/... or https://...)"
                      className="min-h-[38px] min-w-0 flex-1 border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-xs text-[#141414] placeholder:text-[#9A9389] focus:border-[#141414] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddImageUrl}
                      className="min-h-[38px] shrink-0 border border-[#141414] px-3 text-xs font-medium text-[#141414] hover:bg-[#EFE9DF]"
                    >
                      Add URL
                    </button>
                  </div>

                  {prodImages.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {prodImages.map((src, idx) => (
                        <div
                          key={`${idx}-${src.slice(0, 28)}`}
                          className="group relative border border-[#E3DBD0] bg-[#EFE9DF]"
                        >
                          <div className="aspect-[4/5] w-full overflow-hidden">
                            <ImageWithFallback
                              src={src}
                              alt={`Product photo ${idx + 1}`}
                              label={`Photo ${idx + 1}`}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          {idx === 0 && (
                            <span className="absolute top-1 left-1 bg-[#141414]/85 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white">
                              Cover
                            </span>
                          )}
                          <div className="flex items-center justify-between border-t border-[#E3DBD0] bg-white px-1 py-0.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveImage(idx, -1)}
                              aria-label="Move image left"
                              className="p-0.5 text-[#5C574F] hover:text-[#141414] disabled:opacity-30"
                            >
                              <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setProdImages((prev) => prev.filter((_, i) => i !== idx))
                              }
                              aria-label="Remove image"
                              className="p-0.5 text-[#9B2C2C] hover:opacity-75"
                            >
                              <Trash2 className="h-3 w-3" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === prodImages.length - 1}
                              onClick={() => moveImage(idx, 1)}
                              aria-label="Move image right"
                              className="p-0.5 text-[#5C574F] hover:text-[#141414] disabled:opacity-30"
                            >
                              <ArrowRight className="h-3 w-3" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Basic Info */}
                <div>
                  <label
                    htmlFor="admin-prod-name"
                    className="block text-xs font-medium text-[#141414]"
                  >
                    Product Name *
                  </label>
                  <input
                    id="admin-prod-name"
                    type="text"
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    placeholder="e.g. Tailored Linen Panjabi"
                    className="mt-1 min-h-[42px] w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-sm text-[#141414] focus:border-[#141414] focus:outline-none"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="admin-prod-price"
                      className="block text-xs font-medium text-[#141414]"
                    >
                      Regular Price (৳) *
                    </label>
                    <input
                      id="admin-prod-price"
                      type="number"
                      min={1}
                      value={prodPrice}
                      onChange={(e) => setProdPrice(e.target.value)}
                      placeholder="1250"
                      className="mt-1 min-h-[42px] w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-sm tabular-nums text-[#141414] focus:border-[#141414] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="admin-prod-discount"
                      className="block text-xs font-medium text-[#141414]"
                    >
                      Discount Price (৳)
                    </label>
                    <input
                      id="admin-prod-discount"
                      type="number"
                      min={1}
                      value={prodDiscountPrice}
                      onChange={(e) => setProdDiscountPrice(e.target.value)}
                      placeholder="Optional"
                      className="mt-1 min-h-[42px] w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-sm tabular-nums text-[#141414] focus:border-[#141414] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="admin-prod-stock"
                      className="block text-xs font-medium text-[#141414]"
                    >
                      Stock Qty
                    </label>
                    <input
                      id="admin-prod-stock"
                      type="number"
                      min={0}
                      value={prodStock}
                      onChange={(e) => setProdStock(e.target.value)}
                      placeholder="Optional"
                      className="mt-1 min-h-[42px] w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-sm tabular-nums text-[#141414] focus:border-[#141414] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Multi-Category Selection */}
                <div>
                  <span className="block text-xs font-medium text-[#141414]">
                    Categories *
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {categories.map((cat) => {
                      const active = prodCategories.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleCategorySelection(cat.id)}
                          className={`min-h-[34px] border px-3 text-xs font-medium transition-colors ${
                            active
                              ? 'border-[#141414] bg-[#141414] text-[#FAF8F4]'
                              : 'border-[#E3DBD0] bg-[#FAF8F4] text-[#141414] hover:border-[#141414]'
                          }`}
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Subcategories */}
                {availableSubcategoriesForSelected.length > 0 && (
                  <div>
                    <span className="block text-xs font-medium text-[#141414]">
                      Subcategories
                    </span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {availableSubcategoriesForSelected.map((sub) => {
                        const active = prodSubcategories.includes(sub);
                        return (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => toggleSubcategorySelection(sub)}
                            className={`min-h-[32px] border px-2.5 text-xs font-medium transition-colors ${
                              active
                                ? 'border-[#8E6D35] bg-[#8E6D35] text-white'
                                : 'border-[#E3DBD0] bg-[#FAF8F4] text-[#5C574F] hover:border-[#141414]'
                            }`}
                          >
                            {sub}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sizes */}
                <div>
                  <span className="block text-xs font-medium text-[#141414]">
                    Available Sizes
                  </span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Array.from(new Set([...SIZE_PRESETS, ...prodSizes])).map((s) => {
                      const active = prodSizes.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleSize(s)}
                          className={`min-h-[34px] border px-3 text-xs font-medium transition-colors ${
                            active
                              ? 'border-[#141414] bg-[#141414] text-[#FAF8F4]'
                              : 'border-[#E3DBD0] bg-[#FAF8F4] text-[#5C574F] hover:border-[#141414]'
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={customSizeInput}
                      onChange={(e) => setCustomSizeInput(e.target.value)}
                      placeholder="Add custom size (e.g. 32, 34, 42)"
                      className="min-h-[38px] min-w-0 flex-1 border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-xs text-[#141414] focus:border-[#141414] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomSize}
                      className="min-h-[38px] shrink-0 border border-[#141414] px-3 text-xs font-medium text-[#141414] hover:bg-[#EFE9DF]"
                    >
                      Add Size
                    </button>
                  </div>
                </div>

                {/* Colors */}
                <div>
                  <span className="block text-xs font-medium text-[#141414]">
                    Available Colors (leave empty to auto-use Photo #1, #2...)
                  </span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Array.from(new Set([...COLOR_PRESETS, ...prodColors])).map((c) => {
                      const active = prodColors.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => toggleColor(c)}
                          className={`min-h-[34px] border px-3 text-xs font-medium transition-colors ${
                            active
                              ? 'border-[#141414] bg-[#141414] text-[#FAF8F4]'
                              : 'border-[#E3DBD0] bg-[#FAF8F4] text-[#5C574F] hover:border-[#141414]'
                          }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={customColorInput}
                      onChange={(e) => setCustomColorInput(e.target.value)}
                      placeholder="Add custom color name"
                      className="min-h-[38px] min-w-0 flex-1 border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-xs text-[#141414] focus:border-[#141414] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomColor}
                      className="min-h-[38px] shrink-0 border border-[#141414] px-3 text-xs font-medium text-[#141414] hover:bg-[#EFE9DF]"
                    >
                      Add Color
                    </button>
                  </div>
                </div>

                {/* Descriptions */}
                <div>
                  <label
                    htmlFor="admin-prod-short-desc"
                    className="block text-xs font-medium text-[#141414]"
                  >
                    Short Description
                  </label>
                  <input
                    id="admin-prod-short-desc"
                    type="text"
                    value={prodShortDesc}
                    onChange={(e) => setProdShortDesc(e.target.value)}
                    placeholder="Concise 1-line card summary"
                    className="mt-1 min-h-[40px] w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-sm text-[#141414] focus:border-[#141414] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="admin-prod-desc"
                    className="block text-xs font-medium text-[#141414]"
                  >
                    Full Product Details
                  </label>
                  <textarea
                    id="admin-prod-desc"
                    rows={4}
                    value={prodDesc}
                    onChange={(e) => setProdDesc(e.target.value)}
                    placeholder="Fabric, GSM, sizing measurements, and styling notes..."
                    className="mt-1 w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 py-2 text-sm text-[#141414] focus:border-[#141414] focus:outline-none"
                  />
                </div>

                {/* Visibility Toggles */}
                <div className="flex flex-wrap gap-5 border-t border-[#EFE9DF] pt-3 text-xs text-[#141414]">
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={prodPublished}
                      onChange={(e) => setProdPublished(e.target.checked)}
                      className="h-4 w-4 accent-[#141414]"
                    />
                    <span>Publish immediately</span>
                  </label>

                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={prodFeatured}
                      onChange={(e) => setProdFeatured(e.target.checked)}
                      className="h-4 w-4 accent-[#141414]"
                    />
                    <span>Featured Product</span>
                  </label>

                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={prodNewArrival}
                      onChange={(e) => setProdNewArrival(e.target.checked)}
                      className="h-4 w-4 accent-[#141414]"
                    />
                    <span>New Arrival</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 bg-[#141414] px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#FAF8F4] transition-colors hover:bg-[#2A2825]"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>{editingProductId ? 'Save Product Changes' : 'Publish Product'}</span>
                </button>
              </form>

              {/* Existing Catalog Column */}
              <div className="min-w-0 space-y-4 lg:col-span-6">
                <div className="border border-[#E3DBD0] bg-white p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-display text-xl font-semibold text-[#141414]">
                      Product Catalog ({products.length})
                    </h3>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleExportCatalog}
                        className="inline-flex min-h-[36px] items-center gap-1.5 border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-xs font-medium text-[#141414] hover:border-[#141414]"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Export</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => importInputRef.current?.click()}
                        className="inline-flex min-h-[36px] items-center gap-1.5 border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-xs font-medium text-[#141414] hover:border-[#141414]"
                      >
                        <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Import</span>
                      </button>
                      <input
                        ref={importInputRef}
                        type="file"
                        accept="application/json"
                        className="sr-only"
                        onChange={(e) => {
                          void handleImportJson(e);
                        }}
                      />

                      {confirmResetCatalog ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              onResetToDefaults();
                              setConfirmResetCatalog(false);
                              resetProductForm();
                            }}
                            className="min-h-[36px] bg-[#9B2C2C] px-3 text-xs font-medium text-white"
                          >
                            Confirm Reset
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmResetCatalog(false)}
                            className="min-h-[36px] border border-[#E3DBD0] px-2.5 text-xs text-[#5C574F]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmResetCatalog(true)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-xs font-medium text-[#5C574F] hover:border-[#141414] hover:text-[#141414]"
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Restore Initial</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="relative mt-4">
                    <Search
                      className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#5C574F]"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Filter catalog by name or category..."
                      className="min-h-[40px] w-full border border-[#E3DBD0] bg-[#FAF8F4] pr-3 pl-9 text-xs text-[#141414] placeholder:text-[#9A9389] focus:border-[#141414] focus:outline-none"
                    />
                  </div>
                </div>

                {filteredProducts.length === 0 ? (
                  <div className="border border-[#E3DBD0] bg-white p-8 text-center text-sm text-[#5C574F]">
                    No products found in catalog.
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {filteredProducts.map((product) => {
                      const effPrice = getEffectivePrice(product);
                      const cats = getProductCategories(product);
                      return (
                        <li
                          key={product.id}
                          className="flex flex-col gap-3 border border-[#E3DBD0] bg-white p-4 sm:flex-row sm:items-center"
                        >
                          <div className="h-20 w-16 shrink-0 overflow-hidden bg-[#EFE9DF]">
                            <ImageWithFallback
                              src={product.images[0] ?? ''}
                              alt={product.name}
                              label={product.name}
                              className="h-full w-full object-cover"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="truncate text-sm font-semibold text-[#141414]">
                                {product.name}
                              </h4>
                              <span
                                className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                  product.published
                                    ? 'bg-[#F0FDF4] text-[#15803D]'
                                    : 'bg-[#EFE9DF] text-[#5C574F]'
                                }`}
                              >
                                {product.published ? 'Published' : 'Hidden'}
                              </span>
                              {product.isFeatured && (
                                <span className="bg-[#FAF8F4] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#8E6D35]">
                                  Featured
                                </span>
                              )}
                              {typeof product.stockQuantity === 'number' && (
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                    product.stockQuantity <= 0
                                      ? 'bg-[#FFF5F5] text-[#9B2C2C]'
                                      : 'bg-[#FAF8F4] text-[#5C574F]'
                                  }`}
                                >
                                  {product.stockQuantity <= 0
                                    ? 'Out of Stock'
                                    : `Stock: ${product.stockQuantity}`}
                                </span>
                              )}
                            </div>

                            <p className="mt-1 text-xs text-[#5C574F]">
                              {cats.join(', ')} ·{' '}
                              <strong className="tabular-nums text-[#141414]">
                                {formatBdt(effPrice)}
                              </strong>
                              {product.discountedPriceBdt !== null && (
                                <span className="ml-1.5 line-through tabular-nums text-[#9A9389]">
                                  {formatBdt(product.priceBdt)}
                                </span>
                              )}
                              {' · '}
                              {product.images.length} photos
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onTogglePublish(product.id)}
                              title={product.published ? 'Hide product' : 'Publish product'}
                              className="inline-flex min-h-[34px] items-center gap-1 border border-[#E3DBD0] px-2.5 text-xs text-[#141414] hover:border-[#141414]"
                            >
                              {product.published ? (
                                <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                              )}
                              <span>{product.published ? 'Hide' : 'Publish'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleEditProduct(product)}
                              className="inline-flex min-h-[34px] items-center gap-1 border border-[#E3DBD0] px-2.5 text-xs text-[#141414] hover:border-[#141414]"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDuplicateProduct(product)}
                              title="Duplicate product"
                              className="inline-flex min-h-[34px] items-center gap-1 border border-[#E3DBD0] px-2.5 text-xs text-[#141414] hover:border-[#141414]"
                            >
                              <CopyPlus className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>

                            {confirmDeleteProdId === product.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteProduct(product.id);
                                    setConfirmDeleteProdId(null);
                                    if (editingProductId === product.id) {
                                      resetProductForm();
                                    }
                                  }}
                                  className="min-h-[34px] bg-[#9B2C2C] px-2.5 text-xs font-medium text-white"
                                >
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteProdId(null)}
                                  className="min-h-[34px] border border-[#E3DBD0] px-2 text-xs text-[#5C574F]"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteProdId(product.id)}
                                aria-label={`Delete ${product.name}`}
                                className="inline-flex min-h-[34px] items-center justify-center border border-[#E3DBD0] px-2.5 text-xs text-[#9B2C2C] hover:border-[#9B2C2C]"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Category Add/Edit Form */}
              <form
                onSubmit={handleSaveCategory}
                className="min-w-0 space-y-4 border border-[#E3DBD0] bg-white p-4 sm:p-6 lg:col-span-5"
              >
                <div className="flex items-center justify-between border-b border-[#EFE9DF] pb-3">
                  <h3 className="font-display text-xl font-semibold text-[#141414]">
                    {editingCategoryId ? 'Edit Category' : 'Add Category'}
                  </h3>
                  {editingCategoryId && (
                    <button
                      type="button"
                      onClick={resetCategoryForm}
                      className="text-xs font-medium text-[#8E6D35] hover:underline"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                {catError && (
                  <div className="border border-[#9B2C2C]/30 bg-[#FFF5F5] p-3 text-xs text-[#9B2C2C]">
                    {catError}
                  </div>
                )}
                {catSuccess && (
                  <div className="border border-[#15803D]/30 bg-[#F0FDF4] p-3 text-xs text-[#15803D]">
                    {catSuccess}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="admin-cat-name"
                    className="block text-xs font-medium text-[#141414]"
                  >
                    Category Name *
                  </label>
                  <input
                    id="admin-cat-name"
                    type="text"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="e.g. Footwear"
                    className="mt-1 min-h-[42px] w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-sm text-[#141414] focus:border-[#141414] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="admin-cat-subtitle"
                    className="block text-xs font-medium text-[#141414]"
                  >
                    Subtitle
                  </label>
                  <input
                    id="admin-cat-subtitle"
                    type="text"
                    value={catSubtitle}
                    onChange={(e) => setCatSubtitle(e.target.value)}
                    placeholder="e.g. Leather loafers & sneakers"
                    className="mt-1 min-h-[42px] w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-sm text-[#141414] focus:border-[#141414] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#141414]">
                    Category Image
                  </label>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <label className="inline-flex min-h-[38px] shrink-0 cursor-pointer items-center gap-1.5 border border-[#141414] bg-[#141414] px-3 text-xs font-medium text-[#FAF8F4]">
                      <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Upload Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          void handleCategoryImageUpload(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <input
                      type="text"
                      value={catImage}
                      onChange={(e) => setCatImage(e.target.value)}
                      placeholder="Or image URL"
                      className="min-h-[38px] min-w-0 flex-1 border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-xs text-[#141414] focus:border-[#141414] focus:outline-none"
                    />
                  </div>
                  {catImage && (
                    <div className="mt-2 h-24 w-32 overflow-hidden border border-[#E3DBD0] bg-[#EFE9DF]">
                      <ImageWithFallback
                        src={catImage}
                        alt={catName || 'Category preview'}
                        label={catName || 'Preview'}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <span className="block text-xs font-medium text-[#141414]">
                    Subcategories
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={catSubInput}
                      onChange={(e) => setCatSubInput(e.target.value)}
                      placeholder="Add subcategory name"
                      className="min-h-[38px] min-w-0 flex-1 border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-xs text-[#141414] focus:border-[#141414] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddCatSub}
                      className="min-h-[38px] shrink-0 border border-[#141414] px-3 text-xs font-medium text-[#141414] hover:bg-[#EFE9DF]"
                    >
                      Add
                    </button>
                  </div>
                  {catSubcategories.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {catSubcategories.map((sub) => (
                        <span
                          key={sub}
                          className="inline-flex items-center gap-1 border border-[#E3DBD0] bg-[#FAF8F4] px-2.5 py-1 text-xs text-[#141414]"
                        >
                          <span>{sub}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setCatSubcategories((prev) =>
                                prev.filter((s) => s !== sub),
                              )
                            }
                            aria-label={`Remove ${sub}`}
                            className="text-[#9B2C2C]"
                          >
                            <X className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="inline-flex min-h-[44px] w-full items-center justify-center bg-[#141414] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#FAF8F4] hover:bg-[#2A2825]"
                >
                  {editingCategoryId ? 'Save Category' : 'Add Category'}
                </button>
              </form>

              {/* Category List */}
              <div className="min-w-0 space-y-4 lg:col-span-7">
                <div className="flex flex-wrap items-center justify-between gap-3 border border-[#E3DBD0] bg-white p-4 sm:p-5">
                  <h3 className="font-display text-xl font-semibold text-[#141414]">
                    Storefront Categories ({categories.length})
                  </h3>

                  {confirmResetCats ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onResetCategories();
                          setConfirmResetCats(false);
                          resetCategoryForm();
                        }}
                        className="min-h-[36px] bg-[#9B2C2C] px-3 text-xs font-medium text-white"
                      >
                        Confirm Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmResetCats(false)}
                        className="min-h-[36px] border border-[#E3DBD0] px-3 text-xs text-[#5C574F]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmResetCats(true)}
                      className="inline-flex min-h-[36px] items-center gap-1.5 border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-xs font-medium text-[#5C574F] hover:border-[#141414] hover:text-[#141414]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Reset Default Categories</span>
                    </button>
                  )}
                </div>

                <ul className="space-y-3">
                  {categories.map((cat, idx) => (
                    <li
                      key={cat.id}
                      className="border border-[#E3DBD0] bg-white p-4"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="h-14 w-16 shrink-0 overflow-hidden bg-[#EFE9DF]">
                          <ImageWithFallback
                            src={cat.image}
                            alt={cat.alt}
                            label={cat.name}
                            className="h-full w-full object-cover"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-semibold text-[#141414]">
                            {cat.name}
                          </h4>
                          <p className="text-xs text-[#5C574F]">{cat.subtitle}</p>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveCategory(idx, -1)}
                            aria-label="Move category up"
                            className="inline-flex h-8 w-8 items-center justify-center border border-[#E3DBD0] text-[#141414] disabled:opacity-30"
                          >
                            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === categories.length - 1}
                            onClick={() => moveCategory(idx, 1)}
                            aria-label="Move category down"
                            className="inline-flex h-8 w-8 items-center justify-center border border-[#E3DBD0] text-[#141414] disabled:opacity-30"
                          >
                            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditCategory(cat)}
                            className="inline-flex h-8 items-center gap-1 border border-[#E3DBD0] px-2.5 text-xs text-[#141414] hover:border-[#141414]"
                          >
                            <Pencil className="h-3 w-3" aria-hidden="true" />
                            <span>Edit</span>
                          </button>

                          {confirmDeleteCatId === cat.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateCategories(
                                    categories.filter((c) => c.id !== cat.id),
                                  );
                                  setConfirmDeleteCatId(null);
                                  if (editingCategoryId === cat.id) {
                                    resetCategoryForm();
                                  }
                                }}
                                className="h-8 bg-[#9B2C2C] px-2.5 text-xs text-white"
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteCatId(null)}
                                className="h-8 border border-[#E3DBD0] px-2 text-xs text-[#5C574F]"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteCatId(cat.id)}
                              aria-label={`Delete ${cat.name}`}
                              className="inline-flex h-8 w-8 items-center justify-center border border-[#E3DBD0] text-[#9B2C2C] hover:border-[#9B2C2C]"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Subcategories inline editor */}
                      <div className="mt-3 border-t border-[#EFE9DF] pt-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8E6D35]">
                            Subcategories:
                          </span>
                          {cat.subcategories.length === 0 ? (
                            <span className="text-xs text-[#9A9389]">None</span>
                          ) : (
                            cat.subcategories.map((sub) => (
                              <span
                                key={sub}
                                className="inline-flex items-center gap-1 border border-[#E3DBD0] bg-[#FAF8F4] px-2 py-0.5 text-xs text-[#141414]"
                              >
                                <span>{sub}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleQuickRemoveSubcategory(cat.id, sub)
                                  }
                                  aria-label={`Remove ${sub}`}
                                  className="text-[#9B2C2C]"
                                >
                                  <X className="h-3 w-3" aria-hidden="true" />
                                </button>
                              </span>
                            ))
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <input
                            type="text"
                            value={quickSubInputs[cat.id] || ''}
                            onChange={(e) =>
                              setQuickSubInputs((prev) => ({
                                ...prev,
                                [cat.id]: e.target.value,
                              }))
                            }
                            placeholder={`Add subcategory to ${cat.name}...`}
                            className="min-h-[36px] min-w-0 flex-1 border border-[#E3DBD0] bg-[#FAF8F4] px-2.5 text-xs text-[#141414] focus:border-[#141414] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuickAddSubcategory(cat.id)}
                            className="min-h-[36px] shrink-0 border border-[#141414] px-3 text-xs font-medium text-[#141414] hover:bg-[#EFE9DF]"
                          >
                            Add Sub
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <AdminOrdersTab
              orders={orders}
              inspectOrderId={inspectOrderId}
              onClearInspectOrder={() => setInspectOrderId(null)}
              onUpdateOrderStatus={onUpdateOrderStatus}
              onUpdateOrderCustomer={onUpdateOrderCustomer}
              onDeleteOrder={onDeleteOrder}
              onPrintInvoice={(order) => setInvoiceOrder(order)}
            />
          )}

          {activeTab === 'customers' && (
            <AdminCustomersTab
              orders={orders}
              onInspectOrder={(orderId) => {
                setInspectOrderId(orderId);
                handleSelectTab('orders');
              }}
            />
          )}

          {activeTab === 'inventory' && (
            <AdminInventoryTab
              products={products}
              stockHistory={stockHistory}
              onUpdateProductStock={onUpdateProductStock}
            />
          )}

          {activeTab === 'reports' && (
            <AdminReportsTab
              metrics={metrics}
              deliveryChargeBdt={deliveryChargeBdt}
              onUpdateDeliveryCharge={onUpdateDeliveryCharge}
            />
          )}
          </div>
        </div>
      </div>

      <PrintableInvoiceModal
        order={invoiceOrder}
        onClose={() => setInvoiceOrder(null)}
      />
    </div>
  );
}

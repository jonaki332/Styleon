export interface Product {
  id: string;
  name: string;
  category: string;
  categories: string[];
  subcategories: string[];
  priceBdt: number;
  discountedPriceBdt: number | null;
  shortDescription: string;
  description: string;
  images: string[];
  sizes: string[];
  colors: string[];
  stockQuantity: number | null;
  published: boolean;
  isNewArrival: boolean;
  isFeatured: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CategoryDefinition {
  id: string;
  name: string;
  subtitle: string;
  image: string;
  alt: string;
  subcategories: string[];
  sortOrder?: number;
}

export const FLAT_DELIVERY_CHARGE_BDT = 100;

export const STORE_CONFIG = {
  brandName: 'STYLEON',
  email: 'codexa1920@gmail.com',
  whatsappNumber: '8801642742437',
  whatsappDisplay: '+880 1642-742437',
  facebookUrl: 'https://www.facebook.com/share/1CKvLGmjsJ/',
  location: 'Dhaka & Nationwide Delivery Across All 64 Districts, Bangladesh',
} as const;

export const HERO_BANNER = {
  desktopImage: '/src/assets/images/hero_mens_styleon_1794766927227.jpg',
  alt: "Stylish young adult male fashion model wearing a crisp tailored shirt and minimalist trousers for STYLEON men's collection",
} as const;

export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/${STORE_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export function formatBdt(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `৳${safe.toLocaleString('en-US')}`;
}

export function getEffectivePrice(
  product: Pick<Product, 'priceBdt' | 'discountedPriceBdt'>,
): number {
  const base =
    Number.isFinite(product.priceBdt) && product.priceBdt > 0
      ? Math.round(product.priceBdt)
      : 0;
  const disc =
    typeof product.discountedPriceBdt === 'number' &&
    Number.isFinite(product.discountedPriceBdt) &&
    product.discountedPriceBdt > 0 &&
    product.discountedPriceBdt < base
      ? Math.round(product.discountedPriceBdt)
      : null;
  return disc ?? base;
}

export function getDiscountPercentage(
  product: Pick<Product, 'priceBdt' | 'discountedPriceBdt'>,
): number | null {
  const base =
    Number.isFinite(product.priceBdt) && product.priceBdt > 0
      ? product.priceBdt
      : 0;
  const disc =
    typeof product.discountedPriceBdt === 'number' &&
    Number.isFinite(product.discountedPriceBdt) &&
    product.discountedPriceBdt > 0 &&
    product.discountedPriceBdt < base
      ? product.discountedPriceBdt
      : null;

  if (disc === null || base <= 0) return null;
  const pct = Math.round(((base - disc) / base) * 100);
  return pct > 0 ? pct : null;
}

export function getProductCategories(product: Partial<Product>): string[] {
  const list = Array.isArray(product.categories)
    ? product.categories.map((c) => String(c).trim()).filter(Boolean)
    : [];
  if (list.length > 0) return Array.from(new Set(list));
  const fallback =
    typeof product.category === 'string' ? product.category.trim() : '';
  return fallback ? [fallback] : [];
}

export function getProductSubcategories(product: Partial<Product>): string[] {
  if (!Array.isArray(product.subcategories)) return [];
  return Array.from(
    new Set(product.subcategories.map((s) => String(s).trim()).filter(Boolean)),
  );
}

function isSafeImageSrc(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) return !trimmed.startsWith('//');
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^data:image\/(png|jpeg|jpg|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return true;
  }
  return false;
}

export function normalizeProduct(raw: Product): Product {
  const categories = getProductCategories(raw);
  const primaryCategory =
    typeof raw.category === 'string' && raw.category.trim()
      ? raw.category.trim()
      : categories[0] ?? 'Shirts';

  const normalizedCategories =
    categories.length > 0 ? categories : [primaryCategory];

  const regularPrice =
    typeof raw.priceBdt === 'number' &&
    Number.isFinite(raw.priceBdt) &&
    raw.priceBdt > 0
      ? Math.round(raw.priceBdt)
      : 1;

  const rawDiscount =
    typeof raw.discountedPriceBdt === 'number' &&
    Number.isFinite(raw.discountedPriceBdt) &&
    raw.discountedPriceBdt > 0 &&
    raw.discountedPriceBdt < regularPrice
      ? Math.round(raw.discountedPriceBdt)
      : null;

  const stockQuantity =
    typeof raw.stockQuantity === 'number' && Number.isFinite(raw.stockQuantity)
      ? Math.max(0, Math.floor(raw.stockQuantity))
      : null;

  const images = Array.isArray(raw.images)
    ? raw.images.map((img) => String(img).trim()).filter(isSafeImageSrc)
    : [];

  const sizes = Array.isArray(raw.sizes)
    ? Array.from(new Set(raw.sizes.map((s) => String(s).trim()).filter(Boolean)))
    : [];

  const colors = Array.isArray(raw.colors)
    ? Array.from(new Set(raw.colors.map((c) => String(c).trim()).filter(Boolean)))
    : [];

  const now = Date.now();
  const createdAt =
    typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt)
      ? raw.createdAt
      : now;
  const updatedAt =
    typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
      ? raw.updatedAt
      : createdAt;

  return {
    id:
      typeof raw.id === 'string' && raw.id.trim()
        ? raw.id.trim()
        : `prod-${createdAt.toString(36)}`,
    name: typeof raw.name === 'string' ? raw.name.trim() : 'Untitled Product',
    category: primaryCategory,
    categories: normalizedCategories,
    subcategories: getProductSubcategories(raw),
    priceBdt: regularPrice,
    discountedPriceBdt: rawDiscount,
    shortDescription:
      typeof raw.shortDescription === 'string'
        ? raw.shortDescription.trim()
        : '',
    description:
      typeof raw.description === 'string' ? raw.description.trim() : '',
    images,
    sizes,
    colors,
    stockQuantity,
    published: raw.published !== false,
    isNewArrival: Boolean(raw.isNewArrival),
    isFeatured: Boolean(raw.isFeatured),
    createdAt,
    updatedAt,
  };
}

export const DEFAULT_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'Shirts',
    name: 'Shirts',
    subtitle: 'Tailored cotton & denim',
    image: '/src/assets/images/category_shirts_editorial_1794766023311.jpg',
    alt: "Tailored men's crisp white cotton and washed indigo denim shirts on hangers",
    subcategories: [],
    sortOrder: 0,
  },
  {
    id: 'T-Shirts',
    name: 'T-Shirts',
    subtitle: 'Heavyweight essentials',
    image: '/src/assets/images/category_tshirts_editorial_1794766023997.jpg',
    alt: "Folded men's combed cotton crew-neck T-shirts in cream, beige, and black",
    subcategories: [],
    sortOrder: 1,
  },
  {
    id: 'Winter Collection',
    name: 'Winter Collection',
    subtitle: 'Hoodies, jackets & knitwear',
    image: '/src/assets/images/category_outerwear_editorial_1794766024587.jpg',
    alt: "Structured black men's hoodie layered beneath a tailored camel wool overshirt",
    subcategories: [
      'Hoodies',
      'Sweatshirts',
      'Jackets',
      'Sweaters',
      'Winter Wear',
    ],
    sortOrder: 2,
  },
  {
    id: 'Panjabi',
    name: 'Panjabi',
    subtitle: 'Traditional & modern tailoring',
    image: '/src/assets/images/category_panjabi_mens_1794766926951.jpg',
    alt: "Male fashion model wearing a tailored ivory men's Panjabi in natural daylight",
    subcategories: [],
    sortOrder: 3,
  },
  {
    id: 'Pants',
    name: 'Pants',
    subtitle: 'Pleated trousers & chinos',
    image: '/src/assets/images/category_trousers_editorial_1794766024515.jpg',
    alt: "Tailored men's charcoal pleated trousers and cream chinos on an oak bench",
    subcategories: [],
    sortOrder: 4,
  },
  {
    id: 'Watches',
    name: 'Watches',
    subtitle: 'Minimalist timepieces',
    image: '/src/assets/images/category_watches_mens_1794766928481.jpg',
    alt: "Brushed steel men's chronograph watch with black dial on travertine stone",
    subcategories: [],
    sortOrder: 5,
  },
  {
    id: 'Jerseys',
    name: 'Jerseys',
    subtitle: 'Athletic & streetwear cuts',
    image: '/src/assets/images/category_jerseys_mens_1794766929091.jpg',
    alt: "Male model wearing a minimalist black and cream men's athletic jersey",
    subcategories: [],
    sortOrder: 6,
  },
  {
    id: 'Accessories',
    name: 'Accessories',
    subtitle: 'Wallets, belts & eyewear',
    image: '/src/assets/images/category_accessories_mens_1794766929103.jpg',
    alt: "Men's black leather bifold wallet, leather belt, and classic sunglasses on stone",
    subcategories: ['Wallets', 'Belts', 'Sunglasses', 'Other Accessories'],
    sortOrder: 7,
  },
];

export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'styleon-tailored-cotton-shirt',
    name: 'Tailored Oxford Cotton Shirt',
    category: 'Shirts',
    categories: ['Shirts'],
    subcategories: [],
    priceBdt: 1850,
    discountedPriceBdt: 1590,
    shortDescription:
      'Breathable 100% long-staple cotton shirt tailored for crisp smart-casual layering.',
    description:
      'Crafted from breathable combed Oxford cotton with structured collar fusing, mother-of-pearl style buttons, and clean single-needle tailoring suitable for office and evening wear.',
    images: ['/src/assets/images/product_mens_shirt_trousers_1794680306410.jpg'],
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: ['Crisp White', 'Sand Beige', 'Charcoal'],
    stockQuantity: 25,
    published: true,
    isNewArrival: true,
    isFeatured: true,
    createdAt: 1740000001000,
    updatedAt: 1740000001000,
  },
  {
    id: 'styleon-heavyweight-crew-tee',
    name: 'Heavyweight Signature Crew T-Shirt',
    category: 'T-Shirts',
    categories: ['T-Shirts'],
    subcategories: [],
    priceBdt: 950,
    discountedPriceBdt: null,
    shortDescription:
      '240 GSM combed cotton jersey with structured ribbed neckline and relaxed fit.',
    description:
      'Designed as an everyday wardrobe foundation in 240 GSM enzyme-washed cotton. Holds its clean drape without losing neckline structure after repeated washes.',
    images: ['/src/assets/images/product_mens_tshirt_casual_1794680305948.jpg'],
    sizes: ['M', 'L', 'XL'],
    colors: ['Obsidian Black', 'Warm Cream', 'Soft Beige'],
    stockQuantity: 40,
    published: true,
    isNewArrival: true,
    isFeatured: true,
    createdAt: 1740000002000,
    updatedAt: 1740000002000,
  },
  {
    id: 'styleon-ivory-embroidered-panjabi',
    name: 'Ivory Minimalist Cotton Panjabi',
    category: 'Panjabi',
    categories: ['Panjabi'],
    subcategories: [],
    priceBdt: 2450,
    discountedPriceBdt: 2150,
    shortDescription:
      'Fine slub cotton Panjabi with tonal placket embroidery and tailored silhouette.',
    description:
      'Tailored from breathable slub cotton for effortless all-day comfort at festive gatherings and evening occasions, finished with clean tonal stitching.',
    images: ['/src/assets/images/category_panjabi_mens_1794766926951.jpg'],
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: ['Ivory Cream', 'Warm Sand'],
    stockQuantity: 18,
    published: true,
    isNewArrival: true,
    isFeatured: true,
    createdAt: 1740000003000,
    updatedAt: 1740000003000,
  },
  {
    id: 'styleon-camel-overshirt-jacket',
    name: 'Camel Wool-Blend Winter Overshirt',
    category: 'Winter Collection',
    categories: ['Winter Collection'],
    subcategories: ['Jackets', 'Winter Wear'],
    priceBdt: 3450,
    discountedPriceBdt: null,
    shortDescription:
      'Structured mid-weight wool-blend overshirt crafted for crisp evening layering.',
    description:
      'Clean architectural winter layering piece featuring matte horn buttons, twin chest pockets, and brushed interior finish for warmth without bulk.',
    images: ['/src/assets/images/category_outerwear_editorial_1794766024587.jpg'],
    sizes: ['M', 'L', 'XL'],
    colors: ['Camel Beige', 'Jet Black'],
    stockQuantity: 14,
    published: true,
    isNewArrival: true,
    isFeatured: true,
    createdAt: 1740000004000,
    updatedAt: 1740000004000,
  },
  {
    id: 'styleon-pleated-tailored-chinos',
    name: 'Relaxed Pleated Dress Trousers',
    category: 'Pants',
    categories: ['Pants'],
    subcategories: [],
    priceBdt: 2100,
    discountedPriceBdt: 1890,
    shortDescription:
      'Tailored cotton-twill pleated trousers in a modern tapered leg silhouette.',
    description:
      'Cut from high-twist cotton twill with subtle front pleats, extended waist tab closure, and versatile charcoal & cream finishes.',
    images: ['/src/assets/images/category_trousers_editorial_1794766024515.jpg'],
    sizes: ['30', '32', '34', '36'],
    colors: ['Charcoal', 'Cream'],
    stockQuantity: 22,
    published: true,
    isNewArrival: false,
    isFeatured: true,
    createdAt: 1740000005000,
    updatedAt: 1740000005000,
  },
  {
    id: 'styleon-chronograph-steel-watch',
    name: 'Monochrome Steel Chronograph Watch',
    category: 'Watches',
    categories: ['Watches'],
    subcategories: [],
    priceBdt: 3800,
    discountedPriceBdt: 3250,
    shortDescription:
      'Brushed stainless steel timepiece with sunray black dial and sapphire-coated glass.',
    description:
      'Minimalist men’s chronograph watch featuring water-resistant 316L stainless steel casing, luminous hands, and precision quartz movement.',
    images: ['/src/assets/images/product_luxury_watch_1794680307009.jpg'],
    sizes: ['One Size'],
    colors: ['Brushed Steel / Black Dial'],
    stockQuantity: 15,
    published: true,
    isNewArrival: true,
    isFeatured: true,
    createdAt: 1740000006000,
    updatedAt: 1740000006000,
  },
  {
    id: 'styleon-atelier-athletic-jersey',
    name: 'Monochrome Studio Athletic Jersey',
    category: 'Jerseys',
    categories: ['Jerseys'],
    subcategories: [],
    priceBdt: 1350,
    discountedPriceBdt: null,
    shortDescription:
      'Moisture-wicking micro-mesh knit jersey with minimalist contrast trim.',
    description:
      'Engineered from breathable micro-piqué athletic knit fabric with a clean boxy streetwear drape suitable for training and casual styling.',
    images: ['/src/assets/images/category_jerseys_mens_1794766929091.jpg'],
    sizes: ['M', 'L', 'XL'],
    colors: ['Black / Cream'],
    stockQuantity: 30,
    published: true,
    isNewArrival: false,
    isFeatured: false,
    createdAt: 1740000007000,
    updatedAt: 1740000007000,
  },
  {
    id: 'styleon-tortoise-eyewear-kit',
    name: 'Classic Acetate Frame Sunglasses',
    category: 'Accessories',
    categories: ['Accessories'],
    subcategories: ['Sunglasses'],
    priceBdt: 1450,
    discountedPriceBdt: 1200,
    shortDescription:
      'Hand-finished UV400 polarized sunglasses in warm tortoiseshell acetate.',
    description:
      'Lightweight sculpted acetate frame paired with anti-glare UV400 polarized lenses and a structured protective hard case.',
    images: ['/src/assets/images/product_tortoise_sunglasses_1794680310302.jpg'],
    sizes: ['One Size'],
    colors: ['Warm Tortoise', 'Matte Black'],
    stockQuantity: 20,
    published: true,
    isNewArrival: false,
    isFeatured: true,
    createdAt: 1740000008000,
    updatedAt: 1740000008000,
  },
];

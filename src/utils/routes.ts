import type { CategoryDefinition } from '../data/catalog';

export type InfoPageId =
  | 'about'
  | 'privacy'
  | 'returns'
  | 'delivery'
  | 'terms';

export type NavTarget =
  | 'home'
  | 'shop'
  | 'new-arrivals'
  | 'about'
  | 'contact'
  | 'privacy'
  | 'returns'
  | 'delivery'
  | 'terms';

export type ParsedAppRoute =
  | { kind: 'home' }
  | { kind: 'new-arrivals' }
  | { kind: 'shop'; searchQuery?: string }
  | { kind: 'category'; categorySlug: string; subcategorySlug?: string }
  | { kind: 'product'; productId: string }
  | { kind: 'info'; page: InfoPageId }
  | { kind: 'contact' }
  | { kind: 'admin' }
  | { kind: 'not-found'; path: string };

export function slugifyRouteSegment(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';
  const asciiSlug = trimmed
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return asciiSlug || encodeURIComponent(trimmed);
}

export function getNavTargetPath(target: NavTarget): string {
  switch (target) {
    case 'home':
      return '/';
    case 'shop':
      return '/shop';
    case 'new-arrivals':
      return '/new-arrivals';
    case 'about':
      return '/about';
    case 'contact':
      return '/contact';
    case 'privacy':
      return '/privacy-policy';
    case 'returns':
      return '/return-policy';
    case 'delivery':
      return '/shipping-policy';
    case 'terms':
      return '/terms-and-conditions';
  }
}

export function getShopPath(searchQuery?: string): string {
  const q = searchQuery?.trim();
  return q ? `/shop?q=${encodeURIComponent(q)}` : '/shop';
}

export function getCategoryPath(
  categoryIdOrName: string,
  subcategory?: string,
): string {
  if (!categoryIdOrName || categoryIdOrName === 'All') {
    return '/shop';
  }
  const catSlug = slugifyRouteSegment(categoryIdOrName);
  const basePath = `/category/${catSlug}`;
  if (subcategory && subcategory !== 'All') {
    const subSlug = slugifyRouteSegment(subcategory);
    if (subSlug) {
      return `${basePath}?subcategory=${encodeURIComponent(subSlug)}`;
    }
  }
  return basePath;
}

export function getProductPath(productId: string): string {
  return `/product/${encodeURIComponent(productId)}`;
}

function safeDecodeSegment(raw: string): string {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

export function parseAppLocation(
  pathname: string,
  search = '',
): ParsedAppRoute {
  const normalizedPath =
    pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname || '/';
  const lower = normalizedPath.toLowerCase();
  const params = new URLSearchParams(search);

  if (lower === '/admin' || lower.startsWith('/admin/')) {
    return { kind: 'admin' };
  }

  if (lower === '/') {
    return { kind: 'home' };
  }

  if (lower === '/shop') {
    const q = params.get('q')?.trim();
    return { kind: 'shop', searchQuery: q || undefined };
  }

  if (lower === '/new-arrivals') {
    return { kind: 'new-arrivals' };
  }

  if (lower === '/about') {
    return { kind: 'info', page: 'about' };
  }

  if (lower === '/contact') {
    return { kind: 'contact' };
  }

  if (lower === '/privacy-policy') {
    return { kind: 'info', page: 'privacy' };
  }

  if (lower === '/return-policy') {
    return { kind: 'info', page: 'returns' };
  }

  if (lower === '/shipping-policy') {
    return { kind: 'info', page: 'delivery' };
  }

  if (lower === '/terms-and-conditions') {
    return { kind: 'info', page: 'terms' };
  }

  const categoryMatch = normalizedPath.match(/^\/category\/([^/]+)$/i);
  if (categoryMatch && categoryMatch[1]) {
    const categorySlug = safeDecodeSegment(categoryMatch[1]);
    const rawSub = params.get('subcategory')?.trim();
    if (categorySlug) {
      return {
        kind: 'category',
        categorySlug,
        subcategorySlug: rawSub ? safeDecodeSegment(rawSub) : undefined,
      };
    }
  }

  const productMatch = normalizedPath.match(/^\/product\/([^/]+)$/i);
  if (productMatch && productMatch[1]) {
    const productId = safeDecodeSegment(productMatch[1]);
    if (productId) {
      return { kind: 'product', productId };
    }
  }

  return { kind: 'not-found', path: pathname };
}

export function findCategoryBySlug(
  categories: CategoryDefinition[],
  slug: string,
): CategoryDefinition | null {
  const normalizedInput = slugifyRouteSegment(slug);
  const rawLower = slug.trim().toLowerCase();
  return (
    categories.find((cat) => {
      return (
        slugifyRouteSegment(cat.id) === normalizedInput ||
        slugifyRouteSegment(cat.name) === normalizedInput ||
        cat.id.trim().toLowerCase() === rawLower ||
        cat.name.trim().toLowerCase() === rawLower
      );
    }) ?? null
  );
}

export function findSubcategoryBySlug(
  category: CategoryDefinition,
  slug: string,
): string | null {
  const normalizedInput = slugifyRouteSegment(slug);
  const rawLower = slug.trim().toLowerCase();
  return (
    category.subcategories.find((sub) => {
      return (
        slugifyRouteSegment(sub) === normalizedInput ||
        sub.trim().toLowerCase() === rawLower
      );
    }) ?? null
  );
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

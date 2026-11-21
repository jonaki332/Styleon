import { ChevronDown, Menu, Search, ShoppingBag, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  CategoryDefinition,
  formatBdt,
  getEffectivePrice,
  getProductCategories,
  Product,
} from '../data/catalog';
import { ImageWithFallback } from './ImageWithFallback';

export type NavTarget =
  | 'home'
  | 'shop'
  | 'new-arrivals'
  | 'contact'
  | 'privacy'
  | 'returns'
  | 'delivery'
  | 'terms';

interface NavbarProps {
  bagCount: number;
  activeNav: NavTarget;
  searchQuery: string;
  products: Product[];
  categories: CategoryDefinition[];
  onSearchChange: (value: string) => void;
  onSubmitSearch: (value: string) => void;
  onSelectProduct: (product: Product) => void;
  onSelectCategory: (categoryId: string, subcategory?: string) => void;
  onNavigate: (target: NavTarget) => void;
  onOpenBag: () => void;
}

const NAV_LINKS: { label: string; target: NavTarget }[] = [
  { label: 'HOME', target: 'home' },
  { label: 'SHOP', target: 'shop' },
  { label: 'NEW ARRIVALS', target: 'new-arrivals' },
  { label: 'CONTACT', target: 'contact' },
];

export function Navbar({
  bagCount,
  activeNav,
  searchQuery,
  products,
  categories,
  onSearchChange,
  onSubmitSearch,
  onSelectProduct,
  onSelectCategory,
  onNavigate,
  onOpenBag,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shopMenuOpen, setShopMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const closeMenuTimer = useRef<number | null>(null);

  useEffect(() => {
    if (searchOpen) {
      window.setTimeout(() => searchInputRef.current?.focus(), 40);
    }
  }, [searchOpen]);

  const handleNavClick = (target: NavTarget) => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
    setShopMenuOpen(false);
    onNavigate(target);
  };

  const handleSearchFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchOpen(false);
    setMobileMenuOpen(false);
    onSubmitSearch(searchQuery);
  };

  const openShopDropdown = () => {
    if (closeMenuTimer.current) {
      window.clearTimeout(closeMenuTimer.current);
    }
    setShopMenuOpen(true);
  };

  const scheduleCloseShopDropdown = () => {
    closeMenuTimer.current = window.setTimeout(() => {
      setShopMenuOpen(false);
    }, 120);
  };

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const quickMatches = trimmedQuery
    ? products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(trimmedQuery) ||
            getProductCategories(p).some((c) =>
              c.toLowerCase().includes(trimmedQuery),
            ) ||
            p.shortDescription.toLowerCase().includes(trimmedQuery),
        )
        .slice(0, 4)
    : [];

  return (
    <header className="sticky top-0 z-40 border-b border-[#E3DBD0] bg-[#FAF8F4]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6 lg:gap-8 lg:px-10">
        {/* Zone 1: Brand Wordmark */}
        <a
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            handleNavClick('home');
          }}
          className="font-display shrink-0 whitespace-nowrap text-xl font-semibold tracking-[0.18em] text-[#141414] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352] sm:text-2xl sm:tracking-[0.22em]"
        >
          STYLEON
        </a>

        {/* Zone 2: Minimalist Men's Fashion Navigation */}
        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-6 lg:flex xl:gap-8"
        >
          {NAV_LINKS.map((item) => {
            const isActive = activeNav === item.target;
            if (item.target === 'shop') {
              return (
                <div
                  key={item.target}
                  className="relative"
                  onMouseEnter={openShopDropdown}
                  onMouseLeave={scheduleCloseShopDropdown}
                >
                  <button
                    type="button"
                    onClick={() => handleNavClick('shop')}
                    aria-expanded={shopMenuOpen}
                    className={`relative inline-flex items-center gap-1 py-1 text-xs font-medium tracking-[0.12em] uppercase whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352] ${
                      isActive
                        ? 'text-[#141414] after:absolute after:right-0 after:bottom-0 after:left-0 after:h-[1.5px] after:bg-[#141414]'
                        : 'text-[#5C574F] hover:text-[#141414]'
                    }`}
                  >
                    <span>{item.label}</span>
                    <ChevronDown className="h-3 w-3" aria-hidden="true" />
                  </button>

                  {shopMenuOpen && (
                    <div
                      onMouseEnter={openShopDropdown}
                      onMouseLeave={scheduleCloseShopDropdown}
                      className="absolute top-full left-0 z-50 mt-2 w-[540px] max-w-[calc(100vw-2rem)] border border-[#E3DBD0] bg-white p-5 shadow-[0_18px_40px_-20px_rgba(20,20,20,0.22)]"
                    >
                      <div className="flex items-center justify-between border-b border-[#EFE9DF] pb-3">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8E6D35]">
                          Shop Men&apos;s Categories
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setShopMenuOpen(false);
                            onSelectCategory('All');
                          }}
                          className="text-xs font-medium text-[#141414] underline underline-offset-4"
                        >
                          View All Products
                        </button>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
                        {categories.map((cat) => (
                          <div key={cat.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setShopMenuOpen(false);
                                onSelectCategory(cat.id);
                              }}
                              className="text-sm font-semibold text-[#141414] transition-colors hover:text-[#8E6D35]"
                            >
                              {cat.name}
                            </button>
                            {cat.subcategories.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-1">
                                {cat.subcategories.map((sub) => (
                                  <button
                                    key={sub}
                                    type="button"
                                    onClick={() => {
                                      setShopMenuOpen(false);
                                      onSelectCategory(cat.id, sub);
                                    }}
                                    className="text-[11px] text-[#5C574F] hover:text-[#141414] hover:underline"
                                  >
                                    {sub}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button
                key={item.target}
                type="button"
                onClick={() => handleNavClick(item.target)}
                className={`relative py-1 text-xs font-medium tracking-[0.12em] uppercase whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352] ${
                  isActive
                    ? 'text-[#141414] after:absolute after:right-0 after:bottom-0 after:left-0 after:h-[1.5px] after:bg-[#141414]'
                    : 'text-[#5C574F] hover:text-[#141414]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Search, Shopping Cart & Mobile Menu */}
        <div className="flex items-center gap-1.5 shrink-0 sm:gap-2">
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              setSearchOpen((prev) => !prev);
            }}
            aria-expanded={searchOpen}
            aria-label={searchOpen ? 'Close search' : 'Open search'}
            className="inline-flex h-10 w-10 items-center justify-center text-[#141414] transition-colors duration-150 hover:bg-[#EFE9DF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352]"
          >
            {searchOpen ? (
              <X className="h-[18px] w-[18px]" aria-hidden="true" />
            ) : (
              <Search className="h-[18px] w-[18px]" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenBag}
            aria-label={`Open shopping bag, ${bagCount} items`}
            className="relative inline-flex h-10 min-w-[44px] items-center justify-center gap-1.5 px-2.5 text-[#141414] transition-colors duration-150 hover:bg-[#EFE9DF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352]"
          >
            <ShoppingBag className="h-[18px] w-[18px]" aria-hidden="true" />
            <span className="text-xs font-medium tabular-nums text-[#141414]">
              {bagCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSearchOpen(false);
              setMobileMenuOpen((prev) => !prev);
            }}
            aria-expanded={mobileMenuOpen}
            aria-label={
              mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'
            }
            className="inline-flex h-10 w-10 items-center justify-center text-[#141414] transition-colors duration-150 hover:bg-[#EFE9DF] lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352]"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Expandable Search Bar */}
      {searchOpen && (
        <div className="border-t border-[#E3DBD0] bg-white px-4 py-4 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-[1280px]">
            <form
              onSubmit={handleSearchFormSubmit}
              className="flex flex-col gap-2.5 sm:flex-row sm:items-center"
            >
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#5C574F]"
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search men's shirts, Panjabi, winter wear, watches..."
                  aria-label="Search STYLEON collection"
                  className="min-h-[44px] w-full border border-[#E3DBD0] bg-[#FAF8F4] pr-10 pl-10 text-sm text-[#141414] placeholder:text-[#9A9389] focus:border-[#141414] focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    aria-label="Clear search query"
                    className="absolute top-1/2 right-2.5 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center text-[#5C574F] hover:text-[#141414]"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="min-h-[44px] bg-[#141414] px-6 py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-[#FAF8F4] whitespace-nowrap shrink-0 transition-colors hover:bg-[#2A2825]"
              >
                Search Shop
              </button>
            </form>

            {trimmedQuery && (
              <div className="mt-3 border-t border-[#EFE9DF] pt-3">
                {quickMatches.length === 0 ? (
                  <p className="text-xs text-[#5C574F]">
                    No products matched &ldquo;{searchQuery}&rdquo;. Press
                    Search Shop to explore all categories.
                  </p>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {quickMatches.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchOpen(false);
                            onSelectProduct(item);
                          }}
                          className="flex w-full items-center gap-3 border border-[#E3DBD0] bg-[#FAF8F4] p-2 text-left transition-colors hover:border-[#141414]"
                        >
                          <span className="h-12 w-10 shrink-0 overflow-hidden bg-[#EFE9DF]">
                            <ImageWithFallback
                              src={item.images[0] ?? ''}
                              alt={item.name}
                              label={item.name}
                              className="h-full w-full object-cover"
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-[#141414]">
                              {item.name}
                            </span>
                            <span className="mt-0.5 block text-xs tabular-nums text-[#5C574F]">
                              {formatBdt(getEffectivePrice(item))}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile navigation"
          className="max-h-[80vh] overflow-y-auto border-t border-[#E3DBD0] bg-[#FAF8F4] px-4 py-4 lg:hidden"
        >
          <div className="flex flex-col divide-y divide-[#EFE9DF]">
            {NAV_LINKS.map((item) => {
              const isActive = activeNav === item.target;
              return (
                <button
                  key={item.target}
                  type="button"
                  onClick={() => handleNavClick(item.target)}
                  className={`flex min-h-[46px] w-full items-center justify-between py-2.5 text-left text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                    isActive ? 'text-[#141414]' : 'text-[#5C574F]'
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="text-[11px] font-medium text-[#8E6D35]">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 border-t border-[#E3DBD0] pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8E6D35]">
              Shop Categories
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onSelectCategory(cat.id);
                  }}
                  className="min-h-[40px] border border-[#E3DBD0] bg-white px-3 py-2 text-left text-xs font-medium text-[#141414] hover:border-[#141414]"
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}

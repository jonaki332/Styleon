import { ArrowLeft, Minus, Plus, ShoppingBag, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  FLAT_DELIVERY_CHARGE_BDT,
  formatBdt,
  getDiscountPercentage,
  getEffectivePrice,
  getProductCategories,
  Product,
} from '../data/catalog';
import { ImageWithFallback } from './ImageWithFallback';
import { ProductCard } from './ProductCard';

interface ProductDetailViewProps {
  product: Product;
  deliveryChargeBdt?: number;
  relatedProducts: Product[];
  onBack: () => void;
  onSelectProduct: (product: Product) => void;
  onStartCheckout: (
    product: Product,
    size: string,
    color: string,
    quantity: number,
  ) => void;
  onOrderProduct: (product: Product) => void;
  onAddToBag: (
    product: Product,
    size: string,
    color: string,
    quantity: number,
  ) => void;
}

export function ProductDetailView({
  product,
  deliveryChargeBdt = FLAT_DELIVERY_CHARGE_BDT,
  relatedProducts,
  onBack,
  onSelectProduct,
  onStartCheckout,
  onOrderProduct,
  onAddToBag,
}: ProductDetailViewProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState(
    product.sizes[0] ?? 'Standard',
  );
  const [selectedColor, setSelectedColor] = useState(
    product.colors[0] ??
      (product.images.length > 1 ? 'Photo #1' : 'As Shown'),
  );
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);

  useEffect(() => {
    setActiveImageIndex(0);
    setSelectedSize(product.sizes[0] ?? 'Standard');
    setSelectedColor(
      product.colors[0] ??
        (product.images.length > 1 ? 'Photo #1' : 'As Shown'),
    );
    setQuantity(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [product]);

  const activeImage = product.images[activeImageIndex] ?? product.images[0] ?? '';
  const discountPct = getDiscountPercentage(product);
  const effectivePrice = getEffectivePrice(product);
  const subtotal = effectivePrice * quantity;
  const productCategories = getProductCategories(product);
  const hasTrackedStock = typeof product.stockQuantity === 'number';
  const availableStock = hasTrackedStock ? Math.max(0, product.stockQuantity!) : null;
  const isOutOfStock = availableStock !== null && availableStock <= 0;
  const maxAllowedQty = availableStock !== null ? Math.max(1, availableStock) : 50;

  const handleSelectPhotoVariant = (idx: number) => {
    setActiveImageIndex(idx);
    if (product.colors.length === 0 && product.images.length > 1) {
      setSelectedColor(`Photo #${idx + 1}`);
    }
  };

  const handleAdd = () => {
    if (isOutOfStock) return;
    onAddToBag(product, selectedSize, selectedColor, quantity);
    setAddedFeedback(true);
    window.setTimeout(() => setAddedFeedback(false), 1500);
  };

  return (
    <section className="bg-[#FAF8F4] py-8 md:py-14">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[42px] items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-[#5C574F] transition-colors hover:text-[#141414] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Shop</span>
        </button>

        <div className="mt-6 grid gap-8 lg:grid-cols-12 lg:items-start lg:gap-12">
          {/* Left Column: Large Product Gallery */}
          <div className="min-w-0 space-y-3 lg:sticky lg:top-24 lg:col-span-6">
            <div className="aspect-[4/5] w-full overflow-hidden border border-[#E3DBD0] bg-[#EFE9DF]">
              <ImageWithFallback
                src={activeImage}
                alt={`${product.name} — image ${activeImageIndex + 1}`}
                label={product.name}
                priority
                className="h-full w-full object-cover"
              />
            </div>

            {product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-7">
                {product.images.map((img, idx) => {
                  const isActive = idx === activeImageIndex;
                  return (
                    <button
                      key={`${img}-${idx}`}
                      type="button"
                      onClick={() => handleSelectPhotoVariant(idx)}
                      aria-label={`View photo ${idx + 1}`}
                      className={`aspect-[4/5] overflow-hidden border bg-[#EFE9DF] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352] ${
                        isActive
                          ? 'border-[#141414] ring-1 ring-[#141414]'
                          : 'border-[#E3DBD0] opacity-75 hover:opacity-100'
                      }`}
                    >
                      <ImageWithFallback
                        src={img}
                        alt={`${product.name} thumbnail ${idx + 1}`}
                        label={`Photo ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Contiguous Purchase Module */}
          <div className="min-w-0 border border-[#E3DBD0] bg-white p-4 sm:p-8 lg:col-span-6">
            {productCategories.length > 0 && (
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#8E6D35]">
                {productCategories.join(' · ')}
              </p>
            )}
            <h1 className="font-display mt-1.5 break-words text-2xl font-semibold leading-tight text-[#141414] sm:text-4xl">
              {product.name}
            </h1>

            {/* Price, Discount & Stock */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-[#EFE9DF] py-4 tabular-nums">
              <div className="flex flex-wrap items-baseline gap-3">
                {discountPct !== null && product.discountedPriceBdt !== null ? (
                  <>
                    <span className="text-2xl font-semibold text-[#141414]">
                      {formatBdt(product.discountedPriceBdt)}
                    </span>
                    <span className="text-base text-[#7A746B] line-through">
                      {formatBdt(product.priceBdt)}
                    </span>
                    <span className="bg-[#141414] px-2 py-0.5 text-[11px] font-medium text-[#FAF8F4]">
                      -{discountPct}%
                    </span>
                  </>
                ) : (
                  <span className="text-2xl font-semibold text-[#141414]">
                    {formatBdt(product.priceBdt)}
                  </span>
                )}
              </div>

              <span
                className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                  isOutOfStock
                    ? 'bg-[#FFF5F5] text-[#9B2C2C]'
                    : 'bg-[#F0FDF4] text-[#15803D]'
                }`}
              >
                {isOutOfStock
                  ? 'Out of Stock'
                  : availableStock !== null
                    ? `${availableStock} Available`
                    : 'In Stock'}
              </span>
            </div>

            {/* Available Sizes */}
            {product.sizes.length > 0 && (
              <div className="mt-6">
                <span className="block text-xs font-semibold uppercase tracking-wider text-[#141414]">
                  Size
                </span>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {product.sizes.map((size) => {
                    const selected = selectedSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        className={`min-h-[42px] min-w-[52px] border px-4 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352] ${
                          selected
                            ? 'border-[#141414] bg-[#141414] text-[#FAF8F4]'
                            : 'border-[#E3DBD0] bg-[#FAF8F4] text-[#141414] hover:border-[#141414]'
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Available Colors / Photo Variants */}
            {(product.colors.length > 0 || product.images.length > 1) && (
              <div className="mt-5">
                <span className="block text-xs font-semibold uppercase tracking-wider text-[#141414]">
                  {product.colors.length > 0 ? 'Color' : 'Photo Variant'}
                </span>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {product.colors.length > 0
                    ? product.colors.map((color) => {
                        const selected = selectedColor === color;
                        return (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setSelectedColor(color)}
                            className={`min-h-[42px] border px-4 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352] ${
                              selected
                                ? 'border-[#141414] bg-[#141414] text-[#FAF8F4]'
                                : 'border-[#E3DBD0] bg-[#FAF8F4] text-[#141414] hover:border-[#141414]'
                            }`}
                          >
                            {color}
                          </button>
                        );
                      })
                    : product.images.map((_, idx) => {
                        const label = `Photo #${idx + 1}`;
                        const selected = selectedColor === label;
                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() => handleSelectPhotoVariant(idx)}
                            className={`min-h-[40px] border px-3.5 py-1.5 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352] ${
                              selected
                                ? 'border-[#141414] bg-[#141414] text-[#FAF8F4]'
                                : 'border-[#E3DBD0] bg-[#FAF8F4] text-[#141414] hover:border-[#141414]'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                </div>
              </div>
            )}

            {/* Quantity Selector */}
            <div className="mt-5">
              <span className="block text-xs font-semibold uppercase tracking-wider text-[#141414]">
                Quantity
              </span>
              <div className="mt-2.5 flex flex-wrap items-center gap-4">
                <div className="inline-flex items-center border border-[#E3DBD0] bg-[#FAF8F4]">
                  <button
                    type="button"
                    disabled={quantity <= 1 || isOutOfStock}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                    className="inline-flex h-11 w-11 items-center justify-center text-[#141414] hover:bg-[#EFE9DF] disabled:opacity-40"
                  >
                    <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <span className="min-w-[44px] text-center text-sm font-semibold tabular-nums text-[#141414]">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    disabled={isOutOfStock || quantity >= maxAllowedQty}
                    onClick={() =>
                      setQuantity((q) => Math.min(maxAllowedQty, q + 1))
                    }
                    aria-label="Increase quantity"
                    className="inline-flex h-11 w-11 items-center justify-center text-[#141414] hover:bg-[#EFE9DF] disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>

                <div className="text-xs text-[#5C574F] tabular-nums">
                  Subtotal:{' '}
                  <strong className="text-[#141414]">
                    {formatBdt(subtotal)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Delivery Information */}
            <div className="mt-6 flex items-start gap-3 border border-[#E3DBD0] bg-[#FAF8F4] p-3.5 text-xs leading-relaxed text-[#5C574F]">
              <Truck
                className="mt-0.5 h-4 w-4 shrink-0 text-[#8E6D35]"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold text-[#141414]">
                  DELIVERY CHARGE: {formatBdt(deliveryChargeBdt)} Across
                  Bangladesh
                </p>
                <p className="mt-0.5">
                  Cash on Delivery across all 64 districts &amp; upazilas. Click
                  Order Now to complete your order directly on our website.
                </p>
              </div>
            </div>

            {/* Order Now & Add to Bag Actions */}
            <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                disabled={isOutOfStock}
                onClick={() =>
                  onStartCheckout(product, selectedSize, selectedColor, quantity)
                }
                className="inline-flex min-h-[48px] items-center justify-center bg-[#141414] px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#FAF8F4] transition-colors hover:bg-[#2A2825] disabled:cursor-not-allowed disabled:bg-[#7A746B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352]"
              >
                {isOutOfStock ? 'Out of Stock' : 'Order Now'}
              </button>

              <button
                type="button"
                disabled={isOutOfStock}
                onClick={handleAdd}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 border border-[#141414] bg-white px-4 py-3 text-xs font-medium uppercase tracking-[0.12em] text-[#141414] transition-colors hover:bg-[#EFE9DF] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352]"
              >
                <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                <span>{addedFeedback ? 'Added to Bag' : 'Add to Bag'}</span>
              </button>
            </div>

            {/* Full Product Description */}
            <div className="mt-8 border-t border-[#E3DBD0] pt-6">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8E6D35]">
                Product Details
              </h2>
              <div className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-[#2C2A27]">
                {product.description}
              </div>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-16 border-t border-[#E3DBD0] pt-12">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#8E6D35]">
                  Curated Pairing
                </p>
                <h2 className="font-display mt-1.5 text-2xl font-semibold tracking-tight text-[#141414] sm:text-3xl">
                  Related Products
                </h2>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
              {relatedProducts.slice(0, 4).map((item) => (
                <ProductCard
                  key={item.id}
                  product={item}
                  onViewDetails={onSelectProduct}
                  onOrderProduct={onOrderProduct}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

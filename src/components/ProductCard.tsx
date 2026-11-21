import {
  formatBdt,
  getDiscountPercentage,
  Product,
} from '../data/catalog';
import { ImageWithFallback } from './ImageWithFallback';

interface ProductCardProps {
  product: Product;
  onViewDetails: (product: Product) => void;
  onOrderProduct: (product: Product) => void;
}

export function ProductCard({
  product,
  onViewDetails,
  onOrderProduct,
}: ProductCardProps) {
  const discountPct = getDiscountPercentage(product);
  const primaryImage = product.images[0] ?? '';
  const isOutOfStock =
    typeof product.stockQuantity === 'number' && product.stockQuantity <= 0;

  return (
    <article className="group flex min-w-0 flex-col border border-[#E3DBD0] bg-white transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[#C9BFA9] hover:shadow-[0_14px_30px_-18px_rgba(20,20,20,0.16)]">
      {/* Large Product Image */}
      <button
        type="button"
        onClick={() => onViewDetails(product)}
        aria-label={`View product ${product.name}`}
        className="relative aspect-[4/5] w-full overflow-hidden bg-[#EFE9DF] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352]"
      >
        <ImageWithFallback
          src={primaryImage}
          alt={product.name}
          label={product.name}
          className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
        />

        {discountPct !== null && (
          <span className="absolute top-2 left-2 bg-[#141414] px-2 py-0.5 text-[10px] font-medium tracking-wide tabular-nums text-[#FAF8F4] sm:top-2.5 sm:left-2.5 sm:text-[11px]">
            -{discountPct}%
          </span>
        )}
        {isOutOfStock && (
          <span className="absolute top-2 right-2 bg-[#9B2C2C] px-2 py-0.5 text-[10px] font-medium tracking-wide text-white sm:top-2.5 sm:right-2.5 sm:text-[11px]">
            Out of Stock
          </span>
        )}
      </button>

      {/* Clean Editorial Card Body */}
      <div className="flex flex-1 flex-col justify-between p-2.5 sm:p-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => onViewDetails(product)}
            className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352]"
          >
            <h3 className="line-clamp-2 break-words text-[13px] font-medium leading-snug text-[#141414] transition-colors group-hover:text-[#8E6D35] sm:text-[15px]">
              {product.name}
            </h3>
          </button>

          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 tabular-nums">
            {discountPct !== null && product.discountedPriceBdt !== null ? (
              <>
                <span className="text-[13px] font-semibold text-[#141414] sm:text-[15px]">
                  {formatBdt(product.discountedPriceBdt)}
                </span>
                <span className="text-[11px] text-[#7A746B] line-through sm:text-xs">
                  {formatBdt(product.priceBdt)}
                </span>
              </>
            ) : (
              <span className="text-[13px] font-semibold text-[#141414] sm:text-[15px]">
                {formatBdt(product.priceBdt)}
              </span>
            )}
          </div>

          {product.sizes.length > 0 && (
            <p className="mt-1.5 truncate text-[11px] text-[#5C574F]">
              Sizes: {product.sizes.join(' · ')}
            </p>
          )}
        </div>

        {/* Clean Action Controls */}
        <div className="mt-3 grid grid-cols-1 gap-1.5 border-t border-[#EFE9DF] pt-2.5 sm:mt-4 sm:grid-cols-2 sm:pt-3">
          <button
            type="button"
            onClick={() => onViewDetails(product)}
            className="inline-flex min-h-[38px] items-center justify-center border border-[#E3DBD0] bg-[#FAF8F4] px-2 py-1.5 text-[11px] font-medium text-[#141414] whitespace-nowrap transition-colors duration-150 hover:border-[#141414] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352] sm:min-h-[40px] sm:px-2.5 sm:text-xs"
          >
            View Product
          </button>

          <button
            type="button"
            disabled={isOutOfStock}
            onClick={() => onOrderProduct(product)}
            className="inline-flex min-h-[38px] items-center justify-center border border-[#141414] bg-[#141414] px-2 py-1.5 text-[11px] font-medium tracking-wide text-[#FAF8F4] whitespace-nowrap transition-colors duration-150 hover:bg-[#2A2825] disabled:cursor-not-allowed disabled:border-[#7A746B] disabled:bg-[#7A746B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352] sm:min-h-[40px] sm:px-2.5 sm:text-xs"
          >
            {isOutOfStock ? 'Out of Stock' : 'Order Now'}
          </button>
        </div>
      </div>
    </article>
  );
}

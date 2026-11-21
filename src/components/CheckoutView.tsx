import {
  ArrowLeft,
  CheckCircle2,
  MapPin,
  Minus,
  Package,
  Phone,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Truck,
  User,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BANGLADESH_DISTRICTS } from '../data/bangladeshLocations';
import {
  FLAT_DELIVERY_CHARGE_BDT,
  formatBdt,
  getDiscountPercentage,
  getEffectivePrice,
  Product,
} from '../data/catalog';
import { AdminApiError, submitPublicOrder } from '../utils/adminApi';
import {
  calculateOrderTotals,
  CheckoutErrors,
  CheckoutFormValues,
  validateCheckoutForm,
} from '../utils/checkout';
import { StoredOrder } from '../utils/orders';
import { ImageWithFallback } from './ImageWithFallback';
import {
  LocationOption,
  SearchableLocationSelect,
} from './SearchableLocationSelect';

interface CheckoutViewProps {
  product: Product;
  deliveryChargeBdt?: number;
  initialSize?: string;
  initialColor?: string;
  initialQuantity?: number;
  onBack: () => void;
  onContinueShopping?: () => void;
  onOrderPlaced?: (order: StoredOrder) => void;
}

function createClientRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function CheckoutView({
  product,
  deliveryChargeBdt = FLAT_DELIVERY_CHARGE_BDT,
  initialSize,
  initialColor,
  initialQuantity = 1,
  onBack,
  onContinueShopping,
  onOrderPlaced,
}: CheckoutViewProps) {
  const hasExplicitColors = product.colors.length > 0;
  const hasMultiImages = product.images.length > 1;
  const requiresColorSelection = hasExplicitColors || hasMultiImages;
  const requiresSizeSelection = product.sizes.length > 0;

  const hasTrackedStock = typeof product.stockQuantity === 'number';
  const availableStock = hasTrackedStock ? Math.max(0, product.stockQuantity!) : null;
  const isOutOfStock = availableStock !== null && availableStock <= 0;
  const maxAllowedQty = availableStock !== null ? Math.max(1, availableStock) : 50;

  const defaultSize =
    initialSize && product.sizes.includes(initialSize)
      ? initialSize
      : product.sizes[0] ?? 'Standard';

  const defaultColor =
    initialColor ||
    (hasExplicitColors
      ? product.colors[0]
      : hasMultiImages
        ? 'Photo #1'
        : 'As Shown');

  const [customerName, setCustomerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [district, setDistrict] = useState('');
  const [upazila, setUpazila] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [nearbyLandmark, setNearbyLandmark] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [selectedSize, setSelectedSize] = useState(defaultSize);
  const [selectedColor, setSelectedColor] = useState(defaultColor);
  const [quantity, setQuantity] = useState(() =>
    Math.min(maxAllowedQty, Math.max(1, initialQuantity)),
  );

  const [clientRequestId] = useState<string>(() => createClientRequestId());
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<StoredOrder | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [product.id, placedOrder]);

  const unitPriceBdt = getEffectivePrice(product);
  const discountPct = getDiscountPercentage(product);
  const totals = calculateOrderTotals(
    unitPriceBdt,
    quantity,
    deliveryChargeBdt,
    product.priceBdt,
  );

  const districtOptions = useMemo<LocationOption[]>(
    () =>
      BANGLADESH_DISTRICTS.map((d) => ({
        value: d.district,
        labelEn: d.district,
        labelBn: d.districtBn,
        meta: `${d.division} Division`,
      })),
    [],
  );

  const selectedDistrictEntry = useMemo(
    () => BANGLADESH_DISTRICTS.find((d) => d.district === district) ?? null,
    [district],
  );

  const upazilaOptions = useMemo<LocationOption[]>(
    () =>
      (selectedDistrictEntry?.upazilas ?? []).map((u) => ({
        value: u.name,
        labelEn: u.name,
        labelBn: u.nameBn,
      })),
    [selectedDistrictEntry],
  );

  const photoVariantMatch = /^Photo #(\d+)$/.exec(selectedColor);
  const previewImageIndex = photoVariantMatch
    ? Math.min(
        product.images.length - 1,
        Math.max(0, Number(photoVariantMatch[1]) - 1),
      )
    : 0;
  const previewImage =
    product.images[previewImageIndex] ?? product.images[0] ?? '';

  const formValues: CheckoutFormValues = {
    customerName,
    mobileNumber,
    district,
    upazila,
    fullAddress,
    nearbyLandmark,
    deliveryInstructions,
    productName: product.name,
    unitPriceBdt,
    selectedSize,
    selectedColor,
    quantity,
  };

  const clearFieldError = (field: keyof CheckoutErrors) => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (submitError) setSubmitError('');
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitError('');

    if (isOutOfStock) {
      setSubmitError('Sorry, this product is currently out of stock.');
      return;
    }

    if (availableStock !== null && quantity > availableStock) {
      setErrors((prev) => ({
        ...prev,
        quantity: `Only ${availableStock} unit(s) currently available in stock.`,
      }));
      return;
    }

    const validationErrors = validateCheckoutForm(formValues, {
      requireSize: requiresSizeSelection,
      requireColor: requiresColorSelection,
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      const fieldElementMap: Partial<Record<keyof CheckoutErrors, string>> = {
        customerName: 'checkout-name',
        mobileNumber: 'checkout-mobile',
        district: 'checkout-district',
        upazila: 'checkout-upazila',
        fullAddress: 'checkout-address',
      };
      const firstErrorField = (
        Object.keys(validationErrors) as (keyof CheckoutErrors)[]
      ).find((key) => Boolean(fieldElementMap[key]));
      const targetId = firstErrorField
        ? fieldElementMap[firstErrorField]
        : undefined;
      if (targetId) {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus({ preventScroll: true });
        }
      }
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      const order = await submitPublicOrder({
        customerName: customerName.trim(),
        mobileNumber: mobileNumber.trim(),
        district: district.trim(),
        upazila: upazila.trim(),
        fullAddress: fullAddress.trim(),
        nearbyLandmark: nearbyLandmark.trim() || undefined,
        deliveryInstructions: deliveryInstructions.trim() || undefined,
        clientRequestId,
        items: [
          {
            productId: product.id,
            productImage: previewImage,
            size: selectedSize,
            color: selectedColor,
            quantity: totals.quantity,
          },
        ],
      });

      setPlacedOrder(order);
      onOrderPlaced?.(order);
    } catch (err) {
      const message =
        err instanceof AdminApiError
          ? err.message
          : 'Could not place your order right now. Please check your connection and try again.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (placedOrder) {
    const orderedItem = placedOrder.items[0];
    return (
      <section className="bg-[#FAF8F4] py-8 md:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-10">
          <div className="border border-[#E3DBD0] bg-white p-4 sm:p-10">
            <div className="inline-flex items-center gap-2 border border-[#15803D]/25 bg-[#F0FDF4] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#15803D]">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>Order Confirmed</span>
            </div>

            <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight text-[#141414] sm:text-4xl">
              YOUR ORDER HAS BEEN PLACED!
            </h1>
            <p className="mt-2 text-sm text-[#5C574F]">
              Thank you for shopping with STYLEON. Your Cash on Delivery order
              has been received and is now pending confirmation.
            </p>

            {/* Order Identity & Status Bar */}
            <div className="mt-6 grid gap-3 border border-[#E3DBD0] bg-[#FAF8F4] p-4 sm:grid-cols-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#5C574F]">
                  Order ID
                </p>
                <p className="mt-1 font-mono text-base font-semibold text-[#141414]">
                  {placedOrder.id}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#5C574F]">
                  Payment Method
                </p>
                <p className="mt-1 text-sm font-semibold text-[#141414]">
                  Cash on Delivery
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#5C574F]">
                  Order Status
                </p>
                <p className="mt-1 inline-flex items-center border border-[#B89352]/40 bg-white px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-[#8E6D35]">
                  {placedOrder.status}
                </p>
              </div>
            </div>

            {/* Product Details */}
            {orderedItem && (
              <div className="mt-6 border border-[#E3DBD0] bg-white p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8E6D35]">
                  Ordered Product
                </p>
                <div className="mt-3 flex gap-4">
                  <div className="aspect-[4/5] w-20 shrink-0 overflow-hidden border border-[#E3DBD0] bg-[#EFE9DF]">
                    <ImageWithFallback
                      src={orderedItem.productImage || previewImage}
                      alt={orderedItem.productName}
                      label={orderedItem.productName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-base font-semibold text-[#141414]">
                      {orderedItem.productName}
                    </h2>
                    <p className="mt-1 break-words text-xs text-[#5C574F]">
                      Size:{' '}
                      <strong className="text-[#141414]">
                        {orderedItem.size}
                      </strong>{' '}
                      · Color:{' '}
                      <strong className="text-[#141414]">
                        {orderedItem.color}
                      </strong>{' '}
                      · Quantity:{' '}
                      <strong className="tabular-nums text-[#141414]">
                        {orderedItem.quantity}
                      </strong>
                    </p>
                    <p className="mt-2 text-sm font-semibold tabular-nums text-[#141414]">
                      {formatBdt(
                        orderedItem.unitPriceBdt * orderedItem.quantity,
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Customer & Delivery Details */}
            <div className="mt-5 grid gap-5 border border-[#E3DBD0] bg-white p-4 sm:grid-cols-2 sm:p-5">
              <div className="min-w-0 space-y-2 text-xs">
                <p className="font-semibold uppercase tracking-[0.16em] text-[#8E6D35]">
                  Customer &amp; Delivery Address
                </p>
                <p className="flex items-center gap-2 break-words text-sm font-semibold text-[#141414]">
                  <User className="h-3.5 w-3.5 shrink-0 text-[#8E6D35]" aria-hidden="true" />
                  <span className="min-w-0 break-words">{placedOrder.customerName}</span>
                </p>
                <p className="flex items-center gap-2 tabular-nums text-[#141414]">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-[#8E6D35]" aria-hidden="true" />
                  <span>{placedOrder.mobileNumber}</span>
                </p>
                <p className="flex items-start gap-2 break-words leading-relaxed text-[#5C574F]">
                  <MapPin
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8E6D35]"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 break-words">
                    {placedOrder.fullAddress}, {placedOrder.upazila},{' '}
                    {placedOrder.district}
                  </span>
                </p>
                {placedOrder.nearbyLandmark && (
                  <p className="text-[#5C574F]">
                    Nearby Landmark:{' '}
                    <span className="text-[#141414]">
                      {placedOrder.nearbyLandmark}
                    </span>
                  </p>
                )}
                {placedOrder.deliveryInstructions && (
                  <p className="text-[#5C574F]">
                    Instructions:{' '}
                    <span className="text-[#141414]">
                      {placedOrder.deliveryInstructions}
                    </span>
                  </p>
                )}
              </div>

              {/* Payment Breakdown */}
              <div className="space-y-2 border-t border-[#EFE9DF] pt-4 text-xs sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5">
                <p className="font-semibold uppercase tracking-[0.16em] text-[#8E6D35]">
                  Payment Breakdown
                </p>
                <div className="flex justify-between text-[#5C574F]">
                  <span>Product Subtotal</span>
                  <span className="font-medium tabular-nums text-[#141414]">
                    {formatBdt(placedOrder.productSubtotal)}
                  </span>
                </div>
                {typeof placedOrder.discountAmount === 'number' &&
                  placedOrder.discountAmount > 0 && (
                    <div className="flex justify-between text-[#15803D]">
                      <span>Discount Applied</span>
                      <span className="font-medium tabular-nums">
                        -{formatBdt(placedOrder.discountAmount)}
                      </span>
                    </div>
                  )}
                <div className="flex justify-between text-[#5C574F]">
                  <span>Delivery Charge</span>
                  <span className="font-medium tabular-nums text-[#141414]">
                    {formatBdt(placedOrder.deliveryCharge)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-[#E3DBD0] pt-2.5 text-sm font-semibold text-[#141414]">
                  <span>Total Payable (COD)</span>
                  <span className="tabular-nums">
                    {formatBdt(placedOrder.grandTotal)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onContinueShopping ?? onBack}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 bg-[#141414] px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#FAF8F4] transition-colors hover:bg-[#2A2825] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352]"
              >
                <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                <span>CONTINUE SHOPPING</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#FAF8F4] py-8 md:py-14">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[42px] items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-[#5C574F] transition-colors hover:text-[#141414] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back</span>
        </button>

        <div className="mt-4 border-b border-[#E3DBD0] pb-5">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#8E6D35]">
            Direct Website Checkout · Cash on Delivery
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-[#141414] sm:text-4xl">
            COMPLETE YOUR ORDER
          </h1>
          <p className="mt-1.5 text-sm text-[#5C574F]">
            Please provide your delivery information to confirm your order.
          </p>
        </div>

        <form
          noValidate
          onSubmit={handlePlaceOrder}
          className="mt-8 grid gap-8 lg:grid-cols-12 lg:items-start"
        >
          {/* Left Column: Customer & Delivery Information + Product Options + COD */}
          <div className="min-w-0 space-y-6 border border-[#E3DBD0] bg-white p-4 sm:p-8 lg:col-span-7">
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#141414]">
                  1. Customer &amp; Delivery Information
                </h2>
                <span className="text-[11px] text-[#5C574F]">
                  * চিহ্নিত ঘরগুলো অবশ্যই পূরণ করতে হবে
                </span>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label
                    htmlFor="checkout-name"
                    className="block text-xs font-medium text-[#141414]"
                  >
                    Customer Full Name (আপনার সম্পূর্ণ নাম) *
                  </label>
                  <input
                    id="checkout-name"
                    type="text"
                    autoComplete="name"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      clearFieldError('customerName');
                    }}
                    placeholder="আপনার সম্পূর্ণ নাম লিখুন"
                    className={`mt-1.5 min-h-[46px] w-full border px-3 text-sm text-[#141414] placeholder:text-[#9A9389] focus:outline-none ${
                      errors.customerName
                        ? 'border-[#9B2C2C] bg-[#FFF5F5]'
                        : 'border-[#E3DBD0] bg-[#FAF8F4] focus:border-[#141414]'
                    }`}
                  />
                  {errors.customerName && (
                    <p className="mt-1 text-xs text-[#9B2C2C]" role="alert">
                      {errors.customerName}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="checkout-mobile"
                    className="block text-xs font-medium text-[#141414]"
                  >
                    Mobile Number (মোবাইল নম্বর) *
                  </label>
                  <input
                    id="checkout-mobile"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={mobileNumber}
                    onChange={(e) => {
                      setMobileNumber(e.target.value);
                      clearFieldError('mobileNumber');
                    }}
                    placeholder="01XXXXXXXXX"
                    className={`mt-1.5 min-h-[46px] w-full border px-3 text-sm tabular-nums text-[#141414] placeholder:text-[#9A9389] focus:outline-none ${
                      errors.mobileNumber
                        ? 'border-[#9B2C2C] bg-[#FFF5F5]'
                        : 'border-[#E3DBD0] bg-[#FAF8F4] focus:border-[#141414]'
                    }`}
                  />
                  {errors.mobileNumber && (
                    <p className="mt-1 text-xs text-[#9B2C2C]" role="alert">
                      {errors.mobileNumber}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="checkout-district"
                    className="block text-xs font-medium text-[#141414]"
                  >
                    District (জেলা — All 64 Districts) *
                  </label>
                  <div className="mt-1.5">
                    <SearchableLocationSelect
                      id="checkout-district"
                      value={district}
                      options={districtOptions}
                      placeholder="আপনার জেলা নির্বাচন করুন"
                      searchPlaceholder="Search district (English or বাংলা)..."
                      hasError={Boolean(errors.district)}
                      emptyMessage="No matching district found in Bangladesh."
                      onChange={(nextDistrict) => {
                        setDistrict(nextDistrict);
                        setUpazila('');
                        clearFieldError('district');
                        clearFieldError('upazila');
                      }}
                    />
                  </div>
                  {errors.district && (
                    <p className="mt-1 text-xs text-[#9B2C2C]" role="alert">
                      {errors.district}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="checkout-upazila"
                    className="block text-xs font-medium text-[#141414]"
                  >
                    Upazila / Thana (উপজেলা) *
                  </label>
                  <div className="mt-1.5">
                    <SearchableLocationSelect
                      id="checkout-upazila"
                      value={upazila}
                      options={upazilaOptions}
                      disabled={!district}
                      placeholder={
                        district
                          ? 'আপনার উপজেলা নির্বাচন করুন'
                          : 'প্রথমে জেলা নির্বাচন করুন'
                      }
                      searchPlaceholder="Search upazila / area (English or বাংলা)..."
                      hasError={Boolean(errors.upazila)}
                      emptyMessage="No matching upazila found for this district."
                      onChange={(nextUpazila) => {
                        setUpazila(nextUpazila);
                        clearFieldError('upazila');
                      }}
                    />
                  </div>
                  {errors.upazila && (
                    <p className="mt-1 text-xs text-[#9B2C2C]" role="alert">
                      {errors.upazila}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <label
                  htmlFor="checkout-address"
                  className="block text-xs font-medium text-[#141414]"
                >
                  Full Delivery Address (সম্পূর্ণ ডেলিভারি ঠিকানা) *
                </label>
                <textarea
                  id="checkout-address"
                  rows={3}
                  autoComplete="street-address"
                  value={fullAddress}
                  onChange={(e) => {
                    setFullAddress(e.target.value);
                    clearFieldError('fullAddress');
                  }}
                  placeholder="বাসা নম্বর, রোড, এলাকা, গ্রাম অথবা বাজারের নাম লিখুন।"
                  className={`mt-1.5 w-full border px-3 py-2.5 text-sm text-[#141414] placeholder:text-[#9A9389] focus:outline-none ${
                    errors.fullAddress
                      ? 'border-[#9B2C2C] bg-[#FFF5F5]'
                      : 'border-[#E3DBD0] bg-[#FAF8F4] focus:border-[#141414]'
                  }`}
                />
                {errors.fullAddress && (
                  <p className="mt-1 text-xs text-[#9B2C2C]" role="alert">
                    {errors.fullAddress}
                  </p>
                )}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label
                    htmlFor="checkout-landmark"
                    className="block text-xs font-medium text-[#5C574F]"
                  >
                    Nearby Landmark — Optional (প্রয়োজন না হলে ফাঁকা রাখুন)
                  </label>
                  <input
                    id="checkout-landmark"
                    type="text"
                    value={nearbyLandmark}
                    onChange={(e) => setNearbyLandmark(e.target.value)}
                    placeholder="নিকটস্থ পরিচিত স্থান (যেমন: মসজিদ/বাজার)"
                    className="mt-1.5 min-h-[44px] w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-sm text-[#141414] placeholder:text-[#9A9389] focus:border-[#141414] focus:outline-none"
                  />
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="checkout-instructions"
                    className="block text-xs font-medium text-[#5C574F]"
                  >
                    Additional Instructions — Optional (প্রয়োজন না হলে ফাঁকা রাখুন)
                  </label>
                  <input
                    id="checkout-instructions"
                    type="text"
                    value={deliveryInstructions}
                    onChange={(e) => setDeliveryInstructions(e.target.value)}
                    placeholder="অতিরিক্ত নির্দেশনা (প্রয়োজন না হলে ফাঁকা রাখুন)"
                    className="mt-1.5 min-h-[44px] w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-sm text-[#141414] placeholder:text-[#9A9389] focus:border-[#141414] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Product Options & Stock */}
            <div className="border-t border-[#EFE9DF] pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#141414]">
                  2. Product Options
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                    isOutOfStock
                      ? 'bg-[#FFF5F5] text-[#9B2C2C]'
                      : 'bg-[#F0FDF4] text-[#15803D]'
                  }`}
                >
                  <Package className="h-3 w-3" aria-hidden="true" />
                  <span>
                    {isOutOfStock
                      ? 'Out of Stock'
                      : availableStock !== null
                        ? `${availableStock} In Stock`
                        : 'In Stock'}
                  </span>
                </span>
              </div>

              {requiresSizeSelection && (
                <div className="mt-4">
                  <span className="block text-xs font-medium text-[#141414]">
                    Size Selection *
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {product.sizes.map((size) => {
                      const active = selectedSize === size;
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => {
                            setSelectedSize(size);
                            clearFieldError('selectedSize');
                          }}
                          className={`min-h-[42px] min-w-[52px] border px-4 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352] ${
                            active
                              ? 'border-[#141414] bg-[#141414] text-[#FAF8F4]'
                              : 'border-[#E3DBD0] bg-[#FAF8F4] text-[#141414] hover:border-[#141414]'
                          }`}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                  {errors.selectedSize && (
                    <p className="mt-1 text-xs text-[#9B2C2C]" role="alert">
                      {errors.selectedSize}
                    </p>
                  )}
                </div>
              )}

              {requiresColorSelection && (
                <div className="mt-5">
                  <span className="block text-xs font-medium text-[#141414]">
                    {hasExplicitColors
                      ? 'Color Selection *'
                      : 'Color / Photo Variant Selection *'}
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {hasExplicitColors
                      ? product.colors.map((color) => {
                          const active = selectedColor === color;
                          return (
                            <button
                              key={color}
                              type="button"
                              onClick={() => {
                                setSelectedColor(color);
                                clearFieldError('selectedColor');
                              }}
                              className={`min-h-[42px] border px-4 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352] ${
                                active
                                  ? 'border-[#141414] bg-[#141414] text-[#FAF8F4]'
                                  : 'border-[#E3DBD0] bg-[#FAF8F4] text-[#141414] hover:border-[#141414]'
                              }`}
                            >
                              {color}
                            </button>
                          );
                        })
                      : product.images.map((img, idx) => {
                          const label = `Photo #${idx + 1}`;
                          const active = selectedColor === label;
                          return (
                            <button
                              key={`${img}-${idx}`}
                              type="button"
                              onClick={() => {
                                setSelectedColor(label);
                                clearFieldError('selectedColor');
                              }}
                              className={`flex items-center gap-2 border p-1.5 pr-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352] ${
                                active
                                  ? 'border-[#141414] bg-[#141414] text-[#FAF8F4]'
                                  : 'border-[#E3DBD0] bg-[#FAF8F4] text-[#141414] hover:border-[#141414]'
                              }`}
                            >
                              <span className="h-8 w-7 overflow-hidden bg-[#EFE9DF]">
                                <ImageWithFallback
                                  src={img}
                                  alt={`${product.name} ${label}`}
                                  label={label}
                                  className="h-full w-full object-cover"
                                />
                              </span>
                              <span className="tabular-nums">{label}</span>
                            </button>
                          );
                        })}
                  </div>
                  {errors.selectedColor && (
                    <p className="mt-1 text-xs text-[#9B2C2C]" role="alert">
                      {errors.selectedColor}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-5">
                <span className="block text-xs font-medium text-[#141414]">
                  Quantity *
                </span>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center border border-[#E3DBD0] bg-[#FAF8F4]">
                    <button
                      type="button"
                      disabled={quantity <= 1 || isOutOfStock}
                      onClick={() => {
                        setQuantity((q) => Math.max(1, q - 1));
                        clearFieldError('quantity');
                      }}
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
                      onClick={() => {
                        setQuantity((q) => Math.min(maxAllowedQty, q + 1));
                        clearFieldError('quantity');
                      }}
                      aria-label="Increase quantity"
                      className="inline-flex h-11 w-11 items-center justify-center text-[#141414] hover:bg-[#EFE9DF] disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  {availableStock !== null && !isOutOfStock && (
                    <span className="text-xs text-[#5C574F]">
                      Maximum available: {availableStock}
                    </span>
                  )}
                </div>
                {errors.quantity && (
                  <p className="mt-1 text-xs text-[#9B2C2C]" role="alert">
                    {errors.quantity}
                  </p>
                )}
              </div>
            </div>

            {/* Section 3: Payment Method (COD Only) */}
            <div className="border-t border-[#EFE9DF] pt-6">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#141414]">
                3. Payment Method
              </h2>
              <div className="mt-3 flex items-start gap-3 border border-[#141414] bg-[#FAF8F4] p-4">
                <ShieldCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#8E6D35]"
                  aria-hidden="true"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#141414]">
                      CASH ON DELIVERY (COD)
                    </p>
                    <span className="bg-[#141414] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#FAF8F4]">
                      Selected
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#5C574F]">
                    Pay when your product is delivered.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Auto-Populated Product & Complete Order Summary */}
          <div className="min-w-0 border border-[#E3DBD0] bg-white p-4 sm:p-8 lg:sticky lg:top-24 lg:col-span-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8E6D35]">
              Order Summary
            </h2>

            <div className="mt-4 flex gap-4 border-b border-[#EFE9DF] pb-5">
              <div className="aspect-[4/5] w-24 shrink-0 overflow-hidden border border-[#E3DBD0] bg-[#EFE9DF]">
                <ImageWithFallback
                  src={previewImage}
                  alt={product.name}
                  label={product.name}
                  priority
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold leading-snug text-[#141414]">
                  {product.name}
                </p>
                <div className="mt-1 flex flex-wrap items-baseline gap-2 tabular-nums">
                  <span className="text-sm font-semibold text-[#141414]">
                    {formatBdt(unitPriceBdt)}
                  </span>
                  {discountPct !== null && (
                    <span className="text-xs text-[#7A746B] line-through">
                      {formatBdt(product.priceBdt)}
                    </span>
                  )}
                </div>
                <dl className="mt-2.5 space-y-1 text-xs text-[#5C574F]">
                  <div className="flex justify-between gap-2">
                    <dt>Size:</dt>
                    <dd className="font-medium text-[#141414]">
                      {selectedSize}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Color:</dt>
                    <dd className="font-medium text-[#141414]">
                      {selectedColor}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Quantity:</dt>
                    <dd className="font-medium tabular-nums text-[#141414]">
                      {totals.quantity}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <dl className="mt-5 space-y-2.5 text-sm">
              <div className="flex items-center justify-between text-[#5C574F]">
                <dt>
                  Subtotal ({formatBdt(totals.unitPriceBdt)} × {totals.quantity})
                </dt>
                <dd className="font-medium tabular-nums text-[#141414]">
                  {formatBdt(totals.productSubtotal)}
                </dd>
              </div>

              {totals.discountAmount > 0 && (
                <div className="flex items-center justify-between text-[#15803D]">
                  <dt>Discount Savings</dt>
                  <dd className="font-medium tabular-nums">
                    -{formatBdt(totals.discountAmount)}
                  </dd>
                </div>
              )}

              <div className="flex items-center justify-between text-[#5C574F]">
                <dt className="font-medium text-[#141414]">
                  DELIVERY CHARGE
                </dt>
                <dd className="font-semibold tabular-nums text-[#141414]">
                  {formatBdt(totals.deliveryCharge)}
                </dd>
              </div>

              <div className="flex items-center justify-between border-t border-[#E3DBD0] pt-3 text-base font-semibold text-[#141414]">
                <dt>Total Amount</dt>
                <dd className="tabular-nums">{formatBdt(totals.grandTotal)}</dd>
              </div>
            </dl>

            <div className="mt-4 flex items-center gap-2 border border-[#EFE9DF] bg-[#FAF8F4] px-3 py-2.5 text-xs text-[#5C574F]">
              <Truck
                className="h-3.5 w-3.5 shrink-0 text-[#8E6D35]"
                aria-hidden="true"
              />
              <span>
                <strong className="text-[#141414]">
                  DELIVERY CHARGE: {formatBdt(totals.deliveryCharge)}
                </strong>{' '}
                · Flat rate across all 64 districts &amp; upazilas
              </span>
            </div>

            {(Object.keys(errors).length > 0 || submitError) && (
              <div
                className="mt-5 border border-[#9B2C2C]/30 bg-[#FFF5F5] p-3 text-xs text-[#9B2C2C]"
                role="alert"
              >
                {submitError ||
                  'Please complete all required customer and delivery fields before placing your order.'}
              </div>
            )}

            <div className="mt-6">
              <button
                type="submit"
                disabled={submitting || isOutOfStock}
                className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 bg-[#141414] px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#FAF8F4] transition-colors hover:bg-[#2A2825] disabled:cursor-not-allowed disabled:bg-[#7A746B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352]"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>
                  {isOutOfStock
                    ? 'OUT OF STOCK'
                    : submitting
                      ? 'PLACING ORDER...'
                      : 'PLACE ORDER'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}

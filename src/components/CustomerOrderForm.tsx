import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BANGLADESH_DISTRICTS } from '../data/bangladeshLocations';
import { FLAT_DELIVERY_CHARGE_BDT, formatBdt } from '../data/catalog';
import { AdminApiError, submitPublicOrder } from '../utils/adminApi';
import { CheckoutErrors, validateCheckoutForm } from '../utils/checkout';
import { StoredOrder } from '../utils/orders';
import {
  LocationOption,
  SearchableLocationSelect,
} from './SearchableLocationSelect';

export interface OrderLineItem {
  productId: string;
  productName: string;
  productImage?: string;
  size: string;
  color: string;
  quantity: number;
  regularPriceBdt?: number;
  unitPriceBdt: number;
}

interface CustomerOrderFormProps {
  items: OrderLineItem[];
  deliveryChargeBdt?: number;
  onOrderPlaced?: (order: StoredOrder) => void;
}

function createClientRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `bag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function CustomerOrderForm({
  items,
  deliveryChargeBdt = FLAT_DELIVERY_CHARGE_BDT,
  onOrderPlaced,
}: CustomerOrderFormProps) {
  const [customerName, setCustomerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [district, setDistrict] = useState('');
  const [upazila, setUpazila] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [nearbyLandmark, setNearbyLandmark] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [clientRequestId] = useState<string>(() => createClientRequestId());
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const regularSubtotal = items.reduce(
    (sum, item) =>
      sum + (item.regularPriceBdt ?? item.unitPriceBdt) * item.quantity,
    0,
  );
  const productSubtotal = items.reduce(
    (sum, item) => sum + item.unitPriceBdt * item.quantity,
    0,
  );
  const discountAmount = Math.max(0, regularSubtotal - productSubtotal);
  const grandTotal = productSubtotal + deliveryChargeBdt;

  const validateAll = (): boolean => {
    const first = items[0];
    if (!first) return false;
    const validationErrors = validateCheckoutForm(
      {
        customerName,
        mobileNumber,
        district,
        upazila,
        fullAddress,
        nearbyLandmark,
        deliveryInstructions,
        productName: first.productName,
        unitPriceBdt: first.unitPriceBdt,
        selectedSize: first.size,
        selectedColor: first.color,
        quantity: first.quantity,
      },
      { requireSize: true, requireColor: true },
    );

    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitError('');
    if (!validateAll()) return;

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
        items: items.map((item) => ({
          productId: item.productId,
          productImage: item.productImage,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
        })),
      });
      onOrderPlaced?.(order);
    } catch (err) {
      setSubmitError(
        err instanceof AdminApiError
          ? err.message
          : 'Could not place your order right now. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4">
      <div className="border-b border-[#E3DBD0] pb-2">
        <div className="flex flex-wrap items-baseline justify-between gap-1">
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#141414]">
            COMPLETE YOUR ORDER
          </h3>
          <span className="text-[11px] text-[#5C574F]">
            * চিহ্নিত ঘরগুলো অবশ্যই পূরণ করতে হবে
          </span>
        </div>
        <p className="mt-1 text-xs text-[#5C574F]">
          DELIVERY CHARGE: {formatBdt(deliveryChargeBdt)} Across All 64 Districts
          in Bangladesh
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label
            htmlFor="order-fullname"
            className="block text-xs font-medium text-[#141414]"
          >
            Customer Full Name *
          </label>
          <input
            id="order-fullname"
            type="text"
            value={customerName}
            onChange={(e) => {
              setCustomerName(e.target.value);
              clearFieldError('customerName');
            }}
            placeholder="আপনার সম্পূর্ণ নাম লিখুন"
            className={`mt-1 min-h-[44px] w-full border px-3 text-sm text-[#141414] placeholder:text-[#9A9389] focus:outline-none ${
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
            htmlFor="order-mobile"
            className="block text-xs font-medium text-[#141414]"
          >
            Mobile Number *
          </label>
          <input
            id="order-mobile"
            type="tel"
            inputMode="tel"
            value={mobileNumber}
            onChange={(e) => {
              setMobileNumber(e.target.value);
              clearFieldError('mobileNumber');
            }}
            placeholder="01XXXXXXXXX"
            className={`mt-1 min-h-[44px] w-full border px-3 text-sm tabular-nums text-[#141414] placeholder:text-[#9A9389] focus:outline-none ${
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

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label
            htmlFor="order-district"
            className="block text-xs font-medium text-[#141414]"
          >
            District (64 Districts) *
          </label>
          <div className="mt-1">
            <SearchableLocationSelect
              id="order-district"
              value={district}
              options={districtOptions}
              placeholder="আপনার জেলা নির্বাচন করুন"
              searchPlaceholder="Search district..."
              hasError={Boolean(errors.district)}
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
            htmlFor="order-upazila"
            className="block text-xs font-medium text-[#141414]"
          >
            Upazila *
          </label>
          <div className="mt-1">
            <SearchableLocationSelect
              id="order-upazila"
              value={upazila}
              options={upazilaOptions}
              disabled={!district}
              placeholder={
                district
                  ? 'আপনার উপজেলা নির্বাচন করুন'
                  : 'প্রথমে জেলা নির্বাচন করুন'
              }
              searchPlaceholder="Search upazila..."
              hasError={Boolean(errors.upazila)}
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

      <div>
        <label
          htmlFor="order-address"
          className="block text-xs font-medium text-[#141414]"
        >
          Full Delivery Address *
        </label>
        <textarea
          id="order-address"
          rows={2}
          value={fullAddress}
          onChange={(e) => {
            setFullAddress(e.target.value);
            clearFieldError('fullAddress');
          }}
          placeholder="বাসা নম্বর, রোড, এলাকা, গ্রাম অথবা বাজারের নাম লিখুন।"
          className={`mt-1 w-full border px-3 py-2 text-sm text-[#141414] placeholder:text-[#9A9389] focus:outline-none ${
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

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label
            htmlFor="order-landmark"
            className="block text-xs font-medium text-[#5C574F]"
          >
            Nearby Landmark — Optional (প্রয়োজন না হলে ফাঁকা রাখুন)
          </label>
          <input
            id="order-landmark"
            type="text"
            value={nearbyLandmark}
            onChange={(e) => setNearbyLandmark(e.target.value)}
            placeholder="নিকটস্থ পরিচিত স্থান"
            className="mt-1 min-h-[40px] w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-xs text-[#141414] placeholder:text-[#9A9389] focus:border-[#141414] focus:outline-none"
          />
        </div>
        <div className="min-w-0">
          <label
            htmlFor="order-instructions"
            className="block text-xs font-medium text-[#5C574F]"
          >
            Additional Instructions — Optional (প্রয়োজন না হলে ফাঁকা রাখুন)
          </label>
          <input
            id="order-instructions"
            type="text"
            value={deliveryInstructions}
            onChange={(e) => setDeliveryInstructions(e.target.value)}
            placeholder="অতিরিক্ত নির্দেশনা"
            className="mt-1 min-h-[40px] w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-xs text-[#141414] placeholder:text-[#9A9389] focus:border-[#141414] focus:outline-none"
          />
        </div>
      </div>

      {/* Payment Method: Cash on Delivery */}
      <div className="flex items-start gap-2.5 border border-[#141414] bg-[#FAF8F4] p-3 text-xs">
        <ShieldCheck
          className="mt-0.5 h-4 w-4 shrink-0 text-[#8E6D35]"
          aria-hidden="true"
        />
        <div>
          <p className="font-semibold text-[#141414]">
            CASH ON DELIVERY (COD)
          </p>
          <p className="text-[#5C574F]">Pay when your product is delivered.</p>
        </div>
      </div>

      {/* Live Order Calculation Summary */}
      <div className="border border-[#D8CFC2] bg-[#EFE9DF]/70 p-4 text-sm">
        <div className="flex items-center justify-between text-xs text-[#5C574F]">
          <span>Product Subtotal</span>
          <span className="font-medium tabular-nums text-[#141414]">
            {formatBdt(productSubtotal)}
          </span>
        </div>
        {discountAmount > 0 && (
          <div className="mt-1.5 flex items-center justify-between text-xs text-[#15803D]">
            <span>Discount Savings</span>
            <span className="font-medium tabular-nums">
              -{formatBdt(discountAmount)}
            </span>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between text-xs text-[#5C574F]">
          <span>DELIVERY CHARGE</span>
          <span className="font-medium tabular-nums text-[#141414]">
            {formatBdt(deliveryChargeBdt)}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-[#D8CFC2] pt-2.5 text-sm font-semibold text-[#141414]">
          <span>Total Amount (COD)</span>
          <span className="tabular-nums">{formatBdt(grandTotal)}</span>
        </div>
      </div>

      {submitError && (
        <p
          className="border border-[#9B2C2C]/30 bg-[#FFF5F5] p-3 text-xs text-[#9B2C2C]"
          role="alert"
        >
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 bg-[#141414] px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#FAF8F4] transition-colors hover:bg-[#2A2825] disabled:cursor-not-allowed disabled:bg-[#7A746B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352]"
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        <span>{submitting ? 'PLACING ORDER...' : 'PLACE ORDER'}</span>
      </button>
    </form>
  );
}

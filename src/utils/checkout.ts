import {
  findDistrictEntry,
  isValidDistrictUpazila,
} from '../data/bangladeshLocations';
import { FLAT_DELIVERY_CHARGE_BDT } from '../data/catalog';

export interface CheckoutFormValues {
  customerName: string;
  mobileNumber: string;
  district: string;
  upazila: string;
  fullAddress: string;
  nearbyLandmark?: string;
  deliveryInstructions?: string;
  productName: string;
  unitPriceBdt: number;
  selectedSize: string;
  selectedColor: string;
  quantity: number;
}

export type CheckoutField =
  | 'customerName'
  | 'mobileNumber'
  | 'district'
  | 'upazila'
  | 'fullAddress'
  | 'selectedSize'
  | 'selectedColor'
  | 'quantity';

export type CheckoutErrors = Partial<Record<CheckoutField, string>>;

export interface OrderTotals {
  regularUnitPriceBdt: number;
  unitPriceBdt: number;
  quantity: number;
  regularSubtotal: number;
  discountAmount: number;
  productSubtotal: number;
  deliveryCharge: number;
  grandTotal: number;
}

export function normalizeBangladeshMobile(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('8801') && digits.length === 13) {
    return `0${digits.slice(3)}`;
  }
  return digits;
}

export function isValidBangladeshMobile(raw: string): boolean {
  const normalized = normalizeBangladeshMobile(raw);
  return /^01[3-9]\d{8}$/.test(normalized);
}

export function calculateOrderTotals(
  unitPriceBdt: number,
  quantity: number,
  deliveryChargeBdt: number = FLAT_DELIVERY_CHARGE_BDT,
  regularUnitPriceBdt?: number,
): OrderTotals {
  const safeUnit =
    Number.isFinite(unitPriceBdt) && unitPriceBdt > 0 ? Math.round(unitPriceBdt) : 0;
  const safeRegular =
    typeof regularUnitPriceBdt === 'number' &&
    Number.isFinite(regularUnitPriceBdt) &&
    regularUnitPriceBdt > safeUnit
      ? Math.round(regularUnitPriceBdt)
      : safeUnit;
  const safeQty =
    Number.isFinite(quantity) && quantity >= 1 ? Math.floor(quantity) : 1;
  const safeDelivery =
    Number.isFinite(deliveryChargeBdt) && deliveryChargeBdt >= 0
      ? Math.round(deliveryChargeBdt)
      : FLAT_DELIVERY_CHARGE_BDT;

  const regularSubtotal = safeRegular * safeQty;
  const productSubtotal = safeUnit * safeQty;
  const discountAmount = Math.max(0, regularSubtotal - productSubtotal);
  const grandTotal = productSubtotal + safeDelivery;

  return {
    regularUnitPriceBdt: safeRegular,
    unitPriceBdt: safeUnit,
    quantity: safeQty,
    regularSubtotal,
    discountAmount,
    productSubtotal,
    deliveryCharge: safeDelivery,
    grandTotal,
  };
}

export function validateCheckoutForm(
  values: CheckoutFormValues,
  options: { requireSize: boolean; requireColor: boolean },
): CheckoutErrors {
  const errors: CheckoutErrors = {};

  if (values.customerName.trim().length < 2) {
    errors.customerName =
      'Please enter your full name (আপনার সম্পূর্ণ নাম লিখুন).';
  }

  if (!values.mobileNumber.trim()) {
    errors.mobileNumber = 'Please enter your mobile number.';
  } else if (!isValidBangladeshMobile(values.mobileNumber)) {
    errors.mobileNumber =
      'Please enter a valid 11-digit Bangladesh mobile number (e.g. 017XXXXXXXX).';
  }

  if (!values.district.trim() || !findDistrictEntry(values.district)) {
    errors.district = 'Please select a valid district (আপনার জেলা নির্বাচন করুন).';
  }

  if (!values.upazila.trim()) {
    errors.upazila = 'Please select your upazila (আপনার উপজেলা নির্বাচন করুন).';
  } else if (
    values.district.trim() &&
    !isValidDistrictUpazila(values.district, values.upazila)
  ) {
    errors.upazila =
      'Selected upazila does not belong to the chosen district.';
  }

  if (values.fullAddress.trim().length < 5) {
    errors.fullAddress =
      'Please enter your full delivery address (বাসা নম্বর, রোড বা এলাকা লিখুন).';
  }

  if (options.requireSize && !values.selectedSize.trim()) {
    errors.selectedSize = 'Please select a product size.';
  }

  if (options.requireColor && !values.selectedColor.trim()) {
    errors.selectedColor = 'Please select a color / photo variant.';
  }

  if (!Number.isFinite(values.quantity) || values.quantity < 1) {
    errors.quantity = 'Quantity must be at least 1.';
  }

  return errors;
}

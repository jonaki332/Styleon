import { ArrowLeft } from 'lucide-react';
import {
  FLAT_DELIVERY_CHARGE_BDT,
  formatBdt,
  STORE_CONFIG,
} from '../data/catalog';
import { InfoPageId, NavTarget } from '../utils/routes';
import { SharePageButton } from './SharePageButton';

export type { InfoPageId };

interface InfoPagesProps {
  page: InfoPageId;
  deliveryChargeBdt?: number;
  onBackHome: () => void;
  onNavigate: (target: NavTarget) => void;
}

export function InfoPages({
  page,
  deliveryChargeBdt = FLAT_DELIVERY_CHARGE_BDT,
  onBackHome,
  onNavigate,
}: InfoPagesProps) {
  return (
    <section className="bg-[#FAF8F4] py-12 md:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex min-h-[42px] items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-[#5C574F] transition-colors hover:text-[#141414]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to Home</span>
          </button>

          <SharePageButton label="Share Page" />
        </div>

        <div className="mt-6 break-words border border-[#E3DBD0] bg-white p-5 sm:p-10">
          {page === 'about' && (
            <div className="space-y-5">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#8E6D35]">
                About STYLEON
              </p>
              <h1 className="font-display text-3xl font-semibold text-[#141414] sm:text-4xl">
                Modern Men&apos;s Fashion &amp; Tailored Essentials
              </h1>
              <p className="text-sm leading-relaxed text-[#5C574F]">
                STYLEON curates contemporary men&apos;s clothing and accessories
                designed for versatility, comfort, and refined everyday style
                across Bangladesh—from breathable Oxford shirts, heavyweight
                crew T-shirts, and tailored Panjabi to seasonal winter wear,
                pleated trousers, minimalist timepieces, and athletic jerseys.
              </p>
              <div className="border border-[#D8CFC2] bg-[#FAF8F4] p-5 text-sm text-[#141414]">
                <p className="font-semibold">
                  Nationwide Cash on Delivery Across All 64 Districts
                </p>
                <p className="mt-1 text-[#5C574F]">
                  Every order is fulfilled directly from STYLEON with a flat{' '}
                  {formatBdt(deliveryChargeBdt)} delivery charge and responsive
                  support via WhatsApp ({STORE_CONFIG.whatsappDisplay}) and email
                  ({STORE_CONFIG.email}).
                </p>
              </div>
              <div className="flex flex-wrap gap-3 border-t border-[#EFE9DF] pt-5">
                <button
                  type="button"
                  onClick={() => onNavigate('shop')}
                  className="min-h-[44px] bg-[#141414] px-6 py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-[#FAF8F4] transition-colors hover:bg-[#2A2825]"
                >
                  Explore Collection
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('contact')}
                  className="min-h-[44px] border border-[#141414] bg-white px-6 py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-[#141414] transition-colors hover:bg-[#EFE9DF]"
                >
                  Contact Us
                </button>
              </div>
            </div>
          )}

          {page === 'delivery' && (
            <div className="space-y-5">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#8E6D35]">
                Shipping Policy
              </p>
              <h1 className="font-display text-3xl font-semibold text-[#141414] sm:text-4xl">
                Nationwide Shipping &amp; Cash on Delivery
              </h1>
              <div className="border border-[#D8CFC2] bg-[#FAF8F4] p-5 text-sm text-[#141414]">
                <p className="font-semibold">
                  Flat {formatBdt(deliveryChargeBdt)} Delivery Across All 64
                  Districts &amp; Upazilas in Bangladesh
                </p>
                <p className="mt-1 text-[#5C574F]">
                  Order directly on the STYLEON website and pay securely via Cash
                  on Delivery when your parcel arrives.
                </p>
              </div>
              <ul className="list-disc space-y-2.5 pl-5 text-sm leading-relaxed text-[#5C574F]">
                <li>
                  Your delivery charge is a transparent flat{' '}
                  {formatBdt(deliveryChargeBdt)} anywhere inside or outside
                  Dhaka.
                </li>
                <li>
                  Your Total Amount is calculated automatically as Product
                  Subtotal + {formatBdt(deliveryChargeBdt)}.
                </li>
                <li>
                  Need help with an active order? Contact customer support on
                  WhatsApp ({STORE_CONFIG.whatsappDisplay}) or email (
                  {STORE_CONFIG.email}).
                </li>
              </ul>
              <div className="border-t border-[#EFE9DF] pt-5">
                <button
                  type="button"
                  onClick={() => onNavigate('shop')}
                  className="min-h-[44px] bg-[#141414] px-6 py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-[#FAF8F4] transition-colors hover:bg-[#2A2825]"
                >
                  Browse Collection
                </button>
              </div>
            </div>
          )}

          {page === 'returns' && (
            <div className="space-y-5">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#8E6D35]">
                Return &amp; Refund Policy
              </p>
              <h1 className="font-display text-3xl font-semibold text-[#141414] sm:text-4xl">
                Return and Refund Policy
              </h1>
              <p className="text-sm leading-relaxed text-[#5C574F]">
                STYLEON encourages customers to inspect their order carefully
                upon courier handoff before completing Cash on Delivery payment.
              </p>
              <ul className="list-disc space-y-2.5 pl-5 text-sm leading-relaxed text-[#5C574F]">
                <li>
                  If an item arrives damaged, defective, or differs from your
                  order summary, notify our support team via WhatsApp (
                  {STORE_CONFIG.whatsappDisplay}) or email ({STORE_CONFIG.email}
                  ).
                </li>
                <li>
                  Returned or exchanged items must remain unworn, unwashed, and
                  in their original condition with tags and packaging intact.
                </li>
                <li>
                  Approved exchanges and returns are coordinated directly via our
                  customer care desk.
                </li>
              </ul>
            </div>
          )}

          {page === 'privacy' && (
            <div className="space-y-5">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#8E6D35]">
                Privacy Policy
              </p>
              <h1 className="font-display text-3xl font-semibold text-[#141414] sm:text-4xl">
                Privacy Policy
              </h1>
              <p className="text-sm leading-relaxed text-[#5C574F]">
                STYLEON respects your privacy. Delivery details submitted in our
                checkout form—such as your full name, mobile number, district,
                upazila, and delivery address—are used strictly to process your
                order and coordinate courier delivery.
              </p>
            </div>
          )}

          {page === 'terms' && (
            <div className="space-y-5">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#8E6D35]">
                Terms &amp; Conditions
              </p>
              <h1 className="font-display text-3xl font-semibold text-[#141414] sm:text-4xl">
                Terms and Conditions
              </h1>
              <ul className="list-disc space-y-2.5 pl-5 text-sm leading-relaxed text-[#5C574F]">
                <li>
                  All product prices are displayed in Bangladeshi Taka (BDT /
                  ৳).
                </li>
                <li>
                  Nationwide Cash on Delivery carries a flat{' '}
                  {formatBdt(deliveryChargeBdt)} delivery charge.
                </li>
                <li>
                  Payment is collected via Cash on Delivery upon parcel arrival.
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

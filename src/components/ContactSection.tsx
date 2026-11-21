import { ArrowLeft, Check, Copy, Mail, MapPin, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { buildWhatsAppUrl, STORE_CONFIG } from '../data/catalog';
import { SharePageButton } from './SharePageButton';

interface ContactSectionProps {
  onBackHome?: () => void;
}

export function ContactSection({ onBackHome }: ContactSectionProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [copiedInquiry, setCopiedInquiry] = useState(false);

  const composeInquiry = () => {
    const lines = [
      'Hello STYLEON,',
      subject ? `Subject: ${subject.trim()}` : '',
      name ? `Customer Name: ${name.trim()}` : '',
      email ? `Email Address: ${email.trim()}` : '',
      phone ? `Phone Number: ${phone.trim()}` : '',
      message ? `Message: ${message.trim()}` : 'I have an inquiry about your collection.',
    ].filter(Boolean);
    return lines.join('\n');
  };

  const buildMailtoUrl = () => {
    const mailSubject = encodeURIComponent(
      subject.trim() || `STYLEON Inquiry from ${name.trim() || 'Customer'}`,
    );
    const mailBody = encodeURIComponent(composeInquiry());
    return `mailto:${STORE_CONFIG.email}?subject=${mailSubject}&body=${mailBody}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !name.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !subject.trim() ||
      !message.trim()
    ) {
      setError(
        'Please complete your name, email address, phone number, subject, and message.',
      );
      return;
    }
    setError('');
    setSent(true);
  };

  const handleCopyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(composeInquiry());
      setCopiedInquiry(true);
      window.setTimeout(() => setCopiedInquiry(false), 2000);
    } catch {
      setCopiedInquiry(false);
    }
  };

  return (
    <section
      id="contact"
      className="bg-[#FAF8F4] py-10 md:py-16"
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          {onBackHome ? (
            <button
              type="button"
              onClick={onBackHome}
              className="inline-flex min-h-[42px] items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-[#5C574F] transition-colors hover:text-[#141414]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Back to Home</span>
            </button>
          ) : (
            <span />
          )}

          <SharePageButton label="Share Page" />
        </div>

        <div className="grid gap-8 lg:grid-cols-12 lg:items-stretch lg:gap-10">
          {/* Left Column: Contact Information & WhatsApp */}
          <div className="flex min-w-0 flex-col justify-between border border-[#E3DBD0] bg-[#EFE9DF]/65 p-5 sm:p-10 lg:col-span-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#8E6D35]">
                Client Concierge
              </p>
              <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight text-[#141414] sm:text-4xl">
                Contact STYLEON
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-[#5C574F]">
                Reach out directly on WhatsApp or email to verify measurements,
                check product availability, or follow up on a Cash on Delivery
                order anywhere in Bangladesh.
              </p>

              <dl className="mt-8 space-y-4 border-t border-[#D8CFC2] pt-6 text-sm">
                <div className="flex items-start gap-3">
                  <MessageCircle
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#15803D]"
                    aria-hidden="true"
                  />
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-[#5C574F]">
                      WhatsApp
                    </dt>
                    <dd className="mt-0.5 font-medium tabular-nums text-[#141414]">
                      {STORE_CONFIG.whatsappDisplay}
                    </dd>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#8E6D35]"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <dt className="text-xs font-medium uppercase tracking-wider text-[#5C574F]">
                      Email
                    </dt>
                    <dd className="mt-0.5 break-all font-medium text-[#141414]">
                      {STORE_CONFIG.email}
                    </dd>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#8E6D35]"
                    aria-hidden="true"
                  />
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-[#5C574F]">
                      Delivery Coverage
                    </dt>
                    <dd className="mt-0.5 text-[#141414]">
                      {STORE_CONFIG.location}
                    </dd>
                    <dd className="mt-0.5 text-xs text-[#5C574F]">
                      Flat Delivery Charge: ৳100 Across Bangladesh
                    </dd>
                  </div>
                </div>
              </dl>
            </div>

            <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
              <a
                href={buildWhatsAppUrl(composeInquiry())}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 bg-[#15803D] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-white transition-colors hover:bg-[#166534] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15803D]"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                <span>Chat on WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={handleCopyTemplate}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 border border-[#141414] px-4 py-3 text-xs font-medium text-[#141414] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352]"
              >
                {copiedInquiry ? (
                  <>
                    <Check
                      className="h-3.5 w-3.5 text-[#15803D]"
                      aria-hidden="true"
                    />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copy Inquiry</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Contact Form */}
          <div className="min-w-0 border border-[#E3DBD0] bg-white p-5 sm:p-10 lg:col-span-7">
            {sent ? (
              <div className="flex h-full flex-col justify-center py-6">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#8E6D35]">
                  Inquiry Prepared
                </p>
                <h2 className="font-display mt-2 text-3xl font-semibold text-[#141414]">
                  Ready to send, {name}
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-[#5C574F]">
                  Choose how you would like to send your message: open your
                  email app addressed to{' '}
                  <strong className="text-[#141414]">
                    {STORE_CONFIG.email}
                  </strong>{' '}
                  or send directly on WhatsApp.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href={buildMailtoUrl()}
                    className="inline-flex min-h-[46px] items-center justify-center gap-2 bg-[#141414] px-6 py-3 text-xs font-medium uppercase tracking-wide text-[#FAF8F4] transition-colors hover:bg-[#2A2825]"
                  >
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    <span>Send via Email App</span>
                  </a>

                  <a
                    href={buildWhatsAppUrl(composeInquiry())}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[46px] items-center justify-center gap-2 bg-[#15803D] px-6 py-3 text-xs font-semibold uppercase tracking-wide text-white transition-colors hover:bg-[#166534]"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    <span>Send via WhatsApp</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      setSent(false);
                      setName('');
                      setEmail('');
                      setPhone('');
                      setSubject('');
                      setMessage('');
                    }}
                    className="inline-flex min-h-[46px] items-center justify-center border border-[#E3DBD0] px-5 py-3 text-xs font-medium text-[#141414] transition-colors hover:border-[#141414]"
                  >
                    New Inquiry
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="font-display text-2xl font-semibold text-[#141414]">
                  Send an Inquiry
                </h2>
                <p className="text-sm text-[#5C574F]">
                  Have a question about sizing, fabric, or delivery? Fill in the
                  form below.
                </p>

                <div className="grid gap-4 pt-2 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="contact-name"
                      className="block text-xs font-medium text-[#141414]"
                    >
                      Customer Name *
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your full name"
                      className="mt-1 min-h-[44px] w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-sm text-[#141414] placeholder:text-[#9A9389] focus:border-[#141414] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="contact-email"
                      className="block text-xs font-medium text-[#141414]"
                    >
                      Email Address *
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="mt-1 min-h-[44px] w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-sm text-[#141414] placeholder:text-[#9A9389] focus:border-[#141414] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="contact-phone"
                      className="block text-xs font-medium text-[#141414]"
                    >
                      Phone Number *
                    </label>
                    <input
                      id="contact-phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="01XXXXXXXXX"
                      className="mt-1 min-h-[44px] w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-sm tabular-nums text-[#141414] placeholder:text-[#9A9389] focus:border-[#141414] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="contact-subject"
                      className="block text-xs font-medium text-[#141414]"
                    >
                      Subject *
                    </label>
                    <input
                      id="contact-subject"
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Sizing question / Order status"
                      className="mt-1 min-h-[44px] w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 text-sm text-[#141414] placeholder:text-[#9A9389] focus:border-[#141414] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="contact-message"
                    className="block text-xs font-medium text-[#141414]"
                  >
                    Message *
                  </label>
                  <textarea
                    id="contact-message"
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write your inquiry..."
                    className="mt-1 w-full border border-[#E3DBD0] bg-[#FAF8F4] px-3 py-2.5 text-sm text-[#141414] placeholder:text-[#9A9389] focus:border-[#141414] focus:outline-none"
                  />
                </div>

                {error && (
                  <p className="text-xs font-medium text-[#9B2C2C]" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="min-h-[46px] w-full bg-[#141414] px-6 py-3 text-xs font-medium uppercase tracking-wide text-[#FAF8F4] transition-colors hover:bg-[#2A2825] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352] sm:w-auto"
                >
                  Prepare &amp; Send Inquiry
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

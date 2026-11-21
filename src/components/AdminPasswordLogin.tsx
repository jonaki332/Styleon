import { ArrowLeft, Eye, EyeOff, Lock, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AdminApiError, loginAdmin } from '../utils/adminApi';

interface AdminPasswordLoginProps {
  variant: 'modal' | 'page';
  onSuccess: () => Promise<void> | void;
  onClose: () => void;
}

export function AdminPasswordLogin({
  variant,
  onSuccess,
  onClose,
}: AdminPasswordLoginProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && variant === 'modal') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [variant, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Incorrect Password. Please try again.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await loginAdmin(password);
      if (res.authenticated) {
        setPassword('');
        await onSuccess();
      } else {
        setError('Incorrect Password. Please try again.');
      }
    } catch (err) {
      if (err instanceof AdminApiError) {
        setError(err.message);
      } else if (err instanceof Error && err.message) {
        setError(err.message);
      } else {
        setError('Incorrect Password. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const card = (
    <div
      className="w-full max-w-md border border-[#D8CFC2] bg-[#FAF8F4] shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-[#E3DBD0] bg-white px-6 py-5 sm:px-8">
        <div>
          <span className="font-display text-2xl font-semibold tracking-[0.22em] text-[#141414]">
            STYLEON
          </span>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#8E6D35]">
            Protected Store Portal
          </p>
        </div>

        {variant === 'modal' && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Admin Login"
            className="inline-flex h-10 w-10 items-center justify-center border border-[#E3DBD0] bg-[#FAF8F4] text-[#141414] transition-colors hover:border-[#141414] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="space-y-5 bg-white p-6 sm:p-8">
        <div className="border-b border-[#EFE9DF] pb-4">
          <div className="inline-flex items-center gap-2 text-[#8E6D35]">
            <Lock className="h-4 w-4" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">
              Authorized Personnel Only
            </span>
          </div>
          <h1 className="font-display mt-2 text-2xl font-semibold tracking-[0.06em] text-[#141414] sm:text-3xl">
            ADMIN ACCESS
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-[#5C574F]">
            Enter the administrator password to access the STYLEON Admin Dashboard.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="border border-[#9B2C2C]/35 bg-[#FFF5F5] px-3.5 py-3 text-xs font-medium text-[#9B2C2C]"
          >
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="styleon-admin-password"
            className="block text-xs font-semibold uppercase tracking-wider text-[#141414]"
          >
            Admin Password
          </label>

          <div className="relative mt-2">
            <input
              ref={inputRef}
              id="styleon-admin-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              autoComplete="current-password"
              placeholder="Enter admin password"
              className="min-h-[48px] w-full border border-[#E3DBD0] bg-[#FAF8F4] pr-12 pl-3.5 text-sm text-[#141414] placeholder:text-[#9A9389] focus:border-[#141414] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute top-1/2 right-1.5 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center text-[#5C574F] transition-colors hover:text-[#141414] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352]"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-[48px] w-full items-center justify-center bg-[#141414] px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#FAF8F4] transition-colors hover:bg-[#2A2825] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352]"
        >
          {submitting ? 'Verifying...' : 'Login'}
        </button>

        {variant === 'page' && (
          <div className="border-t border-[#EFE9DF] pt-4 text-center">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[40px] items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-[#5C574F] transition-colors hover:text-[#141414]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Return to Storefront</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );

  if (variant === 'page') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF8F4] px-4 py-10">
        {card}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="STYLEON Admin Access"
      onClick={onClose}
    >
      {card}
    </div>
  );
}

import { useEffect, useState } from 'react';

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  label: string;
  className?: string;
  priority?: boolean;
}

export function ImageWithFallback({
  src,
  alt,
  label,
  className = '',
  priority = false,
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (hasError || !src) {
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#EFE9DF] via-[#FAF8F4] to-[#E3DBD0] p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <span className="font-display text-base tracking-[0.18em] text-[#141414]">
          STYLEON
        </span>
        <span className="mt-1 line-clamp-2 text-[11px] text-[#5C574F]">
          {label}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
}

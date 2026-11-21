import { Check, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { copyTextToClipboard } from '../utils/routes';

interface SharePageButtonProps {
  label?: string;
  copiedLabel?: string;
  copiedMessage?: string;
  shareUrl?: string;
  className?: string;
}

export function SharePageButton({
  label = 'Share Page',
  copiedLabel = 'Link Copied',
  copiedMessage = 'Page link copied to clipboard!',
  shareUrl,
  className = '',
}: SharePageButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    setStatus('idle');
  }, [shareUrl]);

  const handleShare = async () => {
    const targetUrl =
      shareUrl || (typeof window !== 'undefined' ? window.location.href : '');
    if (!targetUrl) return;

    const ok = await copyTextToClipboard(targetUrl);
    setStatus(ok ? 'copied' : 'error');
    window.setTimeout(() => setStatus('idle'), 2800);
  };

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {status === 'copied' && (
        <span
          role="status"
          aria-live="polite"
          className="text-xs font-medium text-[#15803D]"
        >
          {copiedMessage}
        </span>
      )}
      {status === 'error' && (
        <span
          role="status"
          aria-live="polite"
          className="text-xs font-medium text-[#9B2C2C]"
        >
          Could not copy link automatically. Copy from the address bar.
        </span>
      )}
      <button
        type="button"
        onClick={() => {
          void handleShare();
        }}
        className="inline-flex min-h-[42px] items-center gap-2 border border-[#E3DBD0] bg-white px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-[#141414] whitespace-nowrap transition-colors hover:border-[#141414] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89352]"
      >
        {status === 'copied' ? (
          <>
            <Check className="h-3.5 w-3.5 text-[#15803D]" aria-hidden="true" />
            <span>{copiedLabel}</span>
          </>
        ) : (
          <>
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{label}</span>
          </>
        )}
      </button>
    </div>
  );
}

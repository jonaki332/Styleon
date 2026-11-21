import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export interface LocationOption {
  value: string;
  labelEn: string;
  labelBn: string;
  meta?: string;
}

interface SearchableLocationSelectProps {
  id: string;
  value: string;
  options: LocationOption[];
  placeholder: string;
  searchPlaceholder: string;
  disabled?: boolean;
  hasError?: boolean;
  emptyMessage?: string;
  onChange: (value: string) => void;
}

export function SearchableLocationSelect({
  id,
  value,
  options,
  placeholder,
  searchPlaceholder,
  disabled = false,
  hasError = false,
  emptyMessage = 'No matching location found.',
  onChange,
}: SearchableLocationSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.labelEn.toLowerCase().includes(q) ||
        opt.labelBn.includes(query.trim()) ||
        (opt.meta && opt.meta.toLowerCase().includes(q)),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => searchInputRef.current?.focus(), 20);

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
      setQuery('');
    }
  }, [disabled]);

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          if (disabled) return;
          setQuery('');
          setOpen((prev) => !prev);
        }}
        className={`flex min-h-[46px] w-full items-center justify-between gap-2 border px-3 text-left text-sm transition-colors focus:outline-none disabled:cursor-not-allowed disabled:bg-[#EFE9DF] disabled:text-[#7A746B] ${
          hasError
            ? 'border-[#9B2C2C] bg-[#FFF5F5]'
            : 'border-[#E3DBD0] bg-[#FAF8F4] hover:border-[#141414] focus:border-[#141414]'
        }`}
      >
        <span className="min-w-0 flex-1 truncate">
          {selectedOption ? (
            <span className="text-[#141414]">
              {selectedOption.labelEn}{' '}
              <span className="text-xs text-[#5C574F]">
                ({selectedOption.labelBn})
              </span>
            </span>
          ) : (
            <span className="text-[#7A746B]">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#5C574F] transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {open && !disabled && (
        <div
          role="listbox"
          aria-labelledby={id}
          className="absolute right-0 left-0 z-50 mt-1 max-w-full border border-[#141414] bg-white shadow-xl"
        >
          <div className="relative border-b border-[#E3DBD0] bg-[#FAF8F4] p-2">
            <Search
              className="pointer-events-none absolute top-1/2 left-4.5 h-3.5 w-3.5 -translate-y-1/2 text-[#5C574F]"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="min-h-[40px] w-full border border-[#E3DBD0] bg-white pr-8 pl-8 text-sm text-[#141414] placeholder:text-[#9A9389] focus:border-[#141414] focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear filter"
                className="absolute top-1/2 right-3.5 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center text-[#5C574F] hover:text-[#141414]"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <ul className="max-h-52 divide-y divide-[#EFE9DF] overflow-y-auto sm:max-h-60">
            {filteredOptions.length === 0 ? (
              <li className="px-3.5 py-4 text-center text-xs text-[#5C574F]">
                {emptyMessage}
              </li>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                        setQuery('');
                      }}
                      className={`flex min-h-[42px] w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? 'bg-[#141414] text-[#FAF8F4]'
                          : 'text-[#141414] hover:bg-[#FAF8F4]'
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{opt.labelEn}</span>{' '}
                        <span
                          className={`text-xs ${
                            isSelected ? 'text-[#D4B882]' : 'text-[#5C574F]'
                          }`}
                        >
                          ({opt.labelBn})
                        </span>
                        {opt.meta && (
                          <span
                            className={`ml-1.5 text-[11px] ${
                              isSelected ? 'text-[#D6CFC4]' : 'text-[#8E6D35]'
                            }`}
                          >
                            · {opt.meta}
                          </span>
                        )}
                      </span>
                      {isSelected && (
                        <Check
                          className="h-4 w-4 shrink-0 text-[#D4B882]"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

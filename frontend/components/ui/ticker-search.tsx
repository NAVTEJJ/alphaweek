'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { searchTickers, type TickerSearchResult } from '@/lib/api';
import { cn } from '@/lib/utils';

interface TickerSearchProps {
  // Called when the user picks a suggestion. Receives the full result so
  // callers can populate both the ticker and the exchange in one go.
  onPick: (result: TickerSearchResult) => void;
  placeholder?: string;
  className?: string;
  // Constrain the suggestion set when the form only accepts one asset class
  // (e.g. price-alert dialog could pre-filter to CRYPTO).
  allowedExchanges?: string[];
  // Controlled value for the input — useful when the parent form is keeping
  // its own state (e.g. portfolio Add Holding row).
  value?: string;
  onValueChange?: (v: string) => void;
  inputId?: string;
  ariaLabel?: string;
}

// Debounced ticker autocomplete. Internals:
//   - 200ms debounce on keystrokes before firing /market/search
//   - results cached client-side via react-query (1-minute staleTime)
//   - dropdown closes on outside-click, Esc, or selection
//   - keyboard nav (↑ / ↓ / Enter / Esc) for accessibility
//
// Uncontrolled by default — the input owns its draft text. Pass `value` +
// `onValueChange` for controlled use.
export function TickerSearch({
  onPick,
  placeholder = 'Search ticker or company…',
  className,
  allowedExchanges,
  value: controlledValue,
  onValueChange,
  inputId,
  ariaLabel,
}: TickerSearchProps) {
  const [internalValue, setInternalValue] = useState('');
  const value = controlledValue ?? internalValue;
  const setValue = useCallback((v: string) => {
    if (onValueChange) onValueChange(v);
    else setInternalValue(v);
  }, [onValueChange]);

  const [debounced, setDebounced] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 200ms debounce on input → query
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), 200);
    return () => clearTimeout(t);
  }, [value]);

  const { data, isFetching } = useQuery({
    queryKey: ['ticker-search', debounced, allowedExchanges?.join(',')],
    queryFn: async () => {
      const results = await searchTickers(debounced);
      return allowedExchanges
        ? results.filter((r) => allowedExchanges.includes(r.exchange))
        : results;
    },
    enabled: debounced.trim().length > 0,
    staleTime: 60_000,
  });

  const results = data ?? [];

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', onClick);
      return () => document.removeEventListener('mousedown', onClick);
    }
  }, [open]);

  function pick(r: TickerSearchResult) {
    onPick(r);
    setValue(r.ticker);
    setOpen(false);
    setActiveIdx(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(-1, i - 1));
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0 && results[activeIdx]) {
        e.preventDefault();
        pick(results[activeIdx]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIdx(-1);
    }
  }

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
        <input
          id={inputId}
          type="text"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-label={ariaLabel ?? 'Search ticker'}
          aria-expanded={open}
          aria-autocomplete="list"
          value={value}
          onChange={(e) => { setValue(e.target.value); setOpen(true); setActiveIdx(-1); }}
          onFocus={() => value.trim() && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="w-full pl-9 pr-9 py-2 rounded-lg bg-surface-2 border border-border text-slate-100 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors font-mono uppercase"
        />
        {isFetching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted animate-spin" />
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-lg bg-surface border border-border shadow-2xl shadow-black/40"
        >
          {results.map((r, i) => (
            <li key={`${r.yahooSymbol}-${i}`} role="option" aria-selected={i === activeIdx}>
              <button
                type="button"
                onClick={() => pick(r)}
                onMouseEnter={() => setActiveIdx(i)}
                className={cn(
                  'w-full text-left px-3 py-2 flex items-center justify-between gap-3 transition-colors',
                  i === activeIdx ? 'bg-surface-3' : 'hover:bg-surface-2'
                )}
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm text-slate-100">{r.ticker}</p>
                  <p className="text-xs text-muted truncate">{r.name}</p>
                </div>
                <span className="text-[10px] font-mono text-muted shrink-0">{r.exchange}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && debounced.trim() && !isFetching && results.length === 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-lg bg-surface border border-border px-3 py-2 text-xs text-muted">
          No matches for &ldquo;{debounced}&rdquo;
        </div>
      )}
    </div>
  );
}

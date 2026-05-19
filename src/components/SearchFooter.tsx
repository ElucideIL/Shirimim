"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { SearchResult } from "@/lib/types";

interface Props {
  onGuess: (result: SearchResult) => void;
  onSkip: () => void;
  disabled: boolean;
}

function SearchFooterBase({ onGuess, onSkip, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Debounced server-side search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as SearchResult[];
        setResults(Array.isArray(data) ? data : []);
        setHighlight(0);
        setOpen(true);
      } catch {
        /* aborted or network error */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  // Close the dropdown on an outside click.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const choose = useCallback(
    (r: SearchResult) => {
      onGuess(r);
      setQuery("");
      setResults([]);
      setOpen(false);
    },
    [onGuess],
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="sticky bottom-0 z-20 bg-gradient-to-t from-black via-black to-transparent pt-6 pb-4">
      <div ref={wrapRef} className="relative">
        {open && (
          <ul className="absolute bottom-full mb-2 max-h-72 w-full overflow-y-auto rounded-xl border border-white/10 bg-neutral-900 shadow-2xl">
            {loading && results.length === 0 && (
              <li className="px-4 py-3 text-sm text-white/40">Searching…</li>
            )}
            {!loading && results.length === 0 && (
              <li className="px-4 py-3 text-sm text-white/40">No matches</li>
            )}
            {results.map((r, i) => (
              <li key={r.id}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => choose(r)}
                  className={`flex w-full flex-col items-start px-4 py-2 text-left transition-colors ${
                    i === highlight ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <span className="truncate text-sm text-white">{r.title}</span>
                  <span className="truncate text-xs text-white/45">{r.artist}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            disabled={disabled}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Know it? Search for the song…"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/30 disabled:opacity-40"
          />
          <button
            type="button"
            onClick={onSkip}
            disabled={disabled}
            className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 disabled:opacity-40"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

export const SearchFooter = memo(SearchFooterBase);

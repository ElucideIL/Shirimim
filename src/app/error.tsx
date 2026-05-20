"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Route-level error boundary — recovers gracefully instead of a hard crash. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("route error", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-lg font-extrabold tracking-tight">
        Shirimim<span className="text-emerald-400">.</span>
      </h1>
      <p className="text-sm font-semibold text-white/80">Something went wrong</p>
      <p className="text-sm text-white/45">
        This page hit an unexpected error. Try again, or head back to the daily
        game.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10"
        >
          Daily game
        </Link>
      </div>
    </main>
  );
}

"use client";

import { useEffect } from "react";
import "./globals.css";

/** Last-resort boundary — catches errors in the root layout itself. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("global error", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-lg font-extrabold tracking-tight">
            Shirimim<span className="text-emerald-400">.</span>
          </h1>
          <p className="text-sm font-semibold text-white/80">
            Something went wrong
          </p>
          <p className="text-sm text-white/45">
            The app hit an unexpected error. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}

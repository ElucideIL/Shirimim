"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createDuel } from "@/actions/duel";

export default function DuelEntryPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      const { id } = await createDuel();
      router.push(`/duel/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start a duel.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
      <header className="flex items-center justify-between py-5">
        <h1 className="text-lg font-extrabold tracking-tight">
          Shirimim<span className="text-emerald-400">.</span>{" "}
          <span className="text-white/40">Duel</span>
        </h1>
        <Link
          href="/"
          className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10"
        >
          Daily
        </Link>
      </header>

      <div className="flex flex-1 flex-col justify-center gap-5 pb-10 text-center">
        <p className="text-sm text-white/50">
          Start a duel on a random song, then share the link. You and your
          friend each get five guesses — fewest wins.
        </p>
        <button
          type="button"
          onClick={handleCreate}
          disabled={busy}
          className="w-full rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-30"
        >
          {busy ? "Starting…" : "Start a duel"}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </main>
  );
}

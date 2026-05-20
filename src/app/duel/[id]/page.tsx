import Link from "next/link";
import { getDuelTrack } from "@/actions/duel";
import { DuelGame } from "@/components/DuelGame";
import type { ClientTrack } from "@/lib/types";

// Each duel resolves its locked-in song per request.
export const dynamic = "force-dynamic";

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-lg font-extrabold tracking-tight">
        Shirimim<span className="text-emerald-400">.</span>
      </h1>
      <p className="text-sm font-semibold text-white/80">{title}</p>
      <p className="text-sm text-white/45">{body}</p>
      <Link href="/duel" className="text-xs text-emerald-400 hover:underline">
        Start a new duel
      </Link>
    </main>
  );
}

export default async function DuelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let track: ClientTrack | null = null;
  try {
    track = await getDuelTrack(id);
  } catch {
    return (
      <Notice
        title="Couldn't load that duel"
        body="Something went wrong — try again in a moment."
      />
    );
  }

  if (!track) {
    return (
      <Notice
        title="Duel not found"
        body="That challenge link is invalid or has expired."
      />
    );
  }

  return <DuelGame duelId={id} track={track} />;
}

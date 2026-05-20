import Link from "next/link";
import { Game } from "@/components/Game";
import { getDayNumber, getTrackForDay } from "@/lib/daily";
import type { ClientTrack } from "@/lib/types";

// Each archived day resolves its locked-in track per request.
export const dynamic = "force-dynamic";

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-lg font-extrabold tracking-tight">
        Shirimim<span className="text-emerald-400">.</span>
      </h1>
      <p className="text-sm font-semibold text-white/80">{title}</p>
      <p className="text-sm text-white/45">{body}</p>
      <Link href="/archive" className="text-xs text-emerald-400 hover:underline">
        Back to the archive
      </Link>
    </main>
  );
}

export default async function ArchiveDayPage({
  params,
}: {
  params: Promise<{ day: string }>;
}) {
  const { day } = await params;
  const dayNumber = Number(day);
  const today = getDayNumber();

  // The archive is strictly past puzzles — today lives on the home page.
  if (!Number.isInteger(dayNumber) || dayNumber < 0 || dayNumber >= today) {
    return (
      <Notice
        title="That puzzle isn't in the archive"
        body="Only past daily puzzles can be replayed here."
      />
    );
  }

  let track: ClientTrack | null = null;
  try {
    const full = await getTrackForDay(dayNumber);
    if (full) {
      track = {
        source: full.source,
        previewUrl: full.previewUrl,
        youtubeId: full.youtubeId,
      };
    }
  } catch {
    return (
      <Notice
        title="Couldn't load that puzzle"
        body="Something went wrong — try again in a moment."
      />
    );
  }

  if (!track) {
    return (
      <Notice
        title="That puzzle has no song"
        body="The library may have changed since it was set."
      />
    );
  }

  return <Game dayNumber={dayNumber} track={track} archived />;
}

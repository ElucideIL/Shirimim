import { Game } from "@/components/Game";
import { getDailyTrack } from "@/lib/daily";
import type { ClientTrack } from "@/lib/types";

// Resolve today's song per request — never statically prerendered.
export const dynamic = "force-dynamic";

function SetupNotice({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-lg font-extrabold tracking-tight">
        Shirimim<span className="text-emerald-400">.</span>
      </h1>
      <p className="text-sm font-semibold text-white/80">{title}</p>
      <p className="text-sm text-white/45">{body}</p>
    </main>
  );
}

export default async function Page() {
  let dayNumber: number;
  let track: ClientTrack | null = null;

  try {
    const daily = await getDailyTrack();
    dayNumber = daily.dayNumber;
    if (daily.track) {
      track = {
        source: daily.track.source,
        previewUrl: daily.track.previewUrl,
        youtubeId: daily.track.youtubeId,
      };
    }
  } catch {
    return (
      <SetupNotice
        title="Supabase is not configured"
        body="Copy .env.example to .env.local, fill in the Supabase values, and restart the dev server."
      />
    );
  }

  if (!track) {
    return (
      <SetupNotice
        title="The song library is empty"
        body="Run the ingestion script (see ingest/) to populate the tracks table, then refresh."
      />
    );
  }

  return <Game dayNumber={dayNumber} track={track} />;
}

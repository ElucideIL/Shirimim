import type { Metadata } from "next";
import { getDailyArchive } from "@/actions/archive";
import { ArchiveList } from "@/components/ArchiveList";

export const metadata: Metadata = {
  title: "Shirimim — Archive",
};

// The list of past puzzles changes daily — never statically prerendered.
export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const entries = await getDailyArchive().catch(() => []);
  return <ArchiveList entries={entries} />;
}

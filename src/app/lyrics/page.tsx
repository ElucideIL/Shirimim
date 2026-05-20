import type { Metadata } from "next";
import { LyricsGame } from "@/components/LyricsGame";

export const metadata: Metadata = {
  title: "Shirimim — Lyrics",
};

export default function LyricsPage() {
  return <LyricsGame />;
}

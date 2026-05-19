import type { Metadata } from "next";
import { EndlessGame } from "@/components/EndlessGame";

export const metadata: Metadata = {
  title: "Shirimim — Endless",
};

export default function EndlessPage() {
  return <EndlessGame />;
}

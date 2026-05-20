import type { Metadata } from "next";
import { StatsView } from "@/components/StatsView";

export const metadata: Metadata = {
  title: "Shirimim — Stats",
};

export default function StatsPage() {
  return <StatsView />;
}

import type { Metadata } from "next";
import { PartyRoom } from "@/components/party/PartyRoom";

export const metadata: Metadata = {
  title: "Shirimim — Party",
};

export default async function PartyRoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <PartyRoom code={code.toUpperCase()} />;
}

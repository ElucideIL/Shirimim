"use client";

import { useEffect, useState } from "react";
import { HostView } from "./HostView";
import { PlayerView } from "./PlayerView";

/**
 * Resolves whether the visitor is the host of this room (holds the secret host
 * token stored at room creation) or a player, and renders the matching view.
 */
export function PartyRoom({ code }: { code: string }) {
  const [hostId, setHostId] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    setHostId(sessionStorage.getItem(`party:${code}:host`));
    setResolved(true);
  }, [code]);

  if (!resolved) {
    return <main className="mx-auto min-h-dvh w-full max-w-md px-5" />;
  }

  return hostId ? (
    <HostView code={code} hostId={hostId} />
  ) : (
    <PlayerView code={code} />
  );
}

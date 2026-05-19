import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import type { SearchResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("q") ?? "").trim();
  // Strip LIKE wildcards so a literal % / _ can't match the whole library.
  const q = raw.replace(/[%_]/g, " ").replace(/\s+/g, " ").trim();

  if (q.length < 2) {
    return NextResponse.json([] as SearchResult[]);
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("search_tracks", { q });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data ?? []) as SearchResult[]);
}

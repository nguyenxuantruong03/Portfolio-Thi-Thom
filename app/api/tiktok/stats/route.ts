import { NextResponse } from "next/server";
import { getTikTokMetrics } from "@/lib/tiktok-stats";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const metrics = await getTikTokMetrics();
  return NextResponse.json(metrics, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createOAuthState, STATE_COOKIE, STATE_TTL_SECONDS, TIKTOK_CHANNELS } from "@/lib/tiktok-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ channel: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { channel } = await context.params;
  const selected = TIKTOK_CHANNELS.find((item) => item.key === channel);
  if (!selected) return NextResponse.json({ error: "UNKNOWN_TIKTOK_CHANNEL" }, { status: 404 });

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;
  if (!clientKey || !redirectUri || !process.env.TIKTOK_CLIENT_SECRET) {
    return NextResponse.json({ error: "TIKTOK_OAUTH_NOT_CONFIGURED" }, { status: 503 });
  }

  const state = createOAuthState(selected.key);
  const authorizeUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
  authorizeUrl.search = new URLSearchParams({
    client_key: clientKey,
    response_type: "code",
    scope: "user.info.basic,video.list",
    redirect_uri: redirectUri,
    state,
  }).toString();

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/tiktok/callback",
    maxAge: STATE_TTL_SECONDS,
  });
  return response;
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeAuthorizationCode, saveTikTokTokens, STATE_COOKIE, verifyOAuthState,
} from "@/lib/tiktok-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const cookieState = cookieStore.get(STATE_COOKIE)?.value;
  const queryState = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error_description") || url.searchParams.get("error");

  const clearCookie = (response: NextResponse) => {
    response.cookies.set(STATE_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/tiktok/callback", maxAge: 0 });
    return response;
  };

  if (error) return clearCookie(NextResponse.redirect(new URL(`/admin/content?tiktok=denied`, url.origin)));
  if (!cookieState || !queryState || cookieState !== queryState || !code) {
    return clearCookie(NextResponse.redirect(new URL("/admin/content?tiktok=invalid_state", url.origin)));
  }

  try {
    const channel = verifyOAuthState(queryState);
    const tokens = await exchangeAuthorizationCode(code);
    await saveTikTokTokens(channel, tokens);
    return clearCookie(NextResponse.redirect(new URL(`/admin/content?tiktok=connected&channel=${encodeURIComponent(channel)}`, url.origin)));
  } catch (cause) {
    console.error("TikTok OAuth callback failed:", cause);
    return clearCookie(NextResponse.redirect(new URL("/admin/content?tiktok=failed", url.origin)));
  }
}

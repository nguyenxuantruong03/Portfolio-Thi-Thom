import { NextResponse } from "next/server";
import { ADMIN_COOKIE, getAdminSessionValue, isAdminPasswordValid } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const text = await request.text();
    let body: unknown = {};
    if (text.trim()) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
      }
    }

    const password = typeof body === "object" && body !== null && "password" in body
      ? (body as { password?: unknown }).password
      : undefined;

    if (typeof password !== "string" || !isAdminPasswordValid(password)) {
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    const session = getAdminSessionValue();
    if (!session) {
      return NextResponse.json({ error: "ADMIN_AUTH_NOT_CONFIGURED" }, { status: 503 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return response;
  } catch (error) {
    console.error("POST /api/admin/login failed:", error);
    return NextResponse.json({ error: "LOGIN_FAILED" }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ADMIN_COOKIE);
  return response;
}

import { NextResponse } from "next/server";
import { getContactEnv } from "../contact-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { apiUrl, apiKey, from, to } = getContactEnv();

  return NextResponse.json({
    ok: Boolean(apiKey && from && to),
    providerConfigured: Boolean(apiKey),
    fromConfigured: Boolean(from),
    toConfigured: Boolean(to),
    apiUrlConfigured: Boolean(apiUrl),
    cwd: process.cwd(),
  });
}

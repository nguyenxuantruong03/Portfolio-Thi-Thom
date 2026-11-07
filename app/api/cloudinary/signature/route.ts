import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    let body: unknown = {};
    const text = await request.text();
    if (text.trim()) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
      }
    }

    const folder = typeof body === "object" && body !== null && "folder" in body
      ? (body as { folder?: unknown }).folder
      : undefined;
    const normalizedFolder = typeof folder === "string" && folder.trim()
      ? folder.trim()
      : "thom-portfolio/content";

    if (!/^[-a-zA-Z0-9_/.]+$/.test(normalizedFolder) || normalizedFolder.length > 200) {
      return NextResponse.json({ error: "INVALID_FOLDER" }, { status: 400 });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;

    if (!apiSecret || !cloudName || !apiKey) {
      return NextResponse.json({ error: "CLOUDINARY_NOT_CONFIGURED" }, { status: 503 });
    }

    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    const signature = cloudinary.utils.api_sign_request(
      { folder: normalizedFolder, timestamp },
      apiSecret,
    );

    return NextResponse.json({
      cloudName,
      apiKey,
      timestamp,
      signature,
      folder: normalizedFolder,
    });
  } catch (error) {
    console.error("POST /api/cloudinary/signature failed:", error);
    return NextResponse.json({ error: "CLOUDINARY_SIGNATURE_FAILED" }, { status: 500 });
  }
}

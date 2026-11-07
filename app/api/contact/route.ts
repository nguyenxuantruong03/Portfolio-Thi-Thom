import { NextResponse } from "next/server";
import { z } from "zod";
import { getContactEnv } from "./contact-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2),
  email: z.string().email(),
  message: z.string().trim().min(10),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  }

  const { apiUrl, apiKey, from, to } = getContactEnv();

  if (!apiKey || !from || !to) {
    console.error("Contact configuration is incomplete", {
      apiUrl: Boolean(apiUrl),
      apiKey: Boolean(apiKey),
      from: Boolean(from),
      to: Boolean(to),
      cwd: process.cwd(),
    });

    return NextResponse.json(
      {
        message:
          "Contact form chưa được cấu hình. Kiểm tra CONTACT_API_KEY/RESEND_API_KEY, CONTACT_FROM_EMAIL và CONTACT_TO_EMAIL trong .env.local rồi restart server.",
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Portfolio contact — ${parsed.data.name}`,
        reply_to: parsed.data.email,
        text: `Name: ${parsed.data.name}\nEmail: ${parsed.data.email}\n\n${parsed.data.message}`,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const providerError = await response.text().catch(() => "");
      console.error("Contact provider error", response.status, providerError);
      return NextResponse.json(
        { message: "Dịch vụ email trả về lỗi. Vui lòng thử lại sau." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Contact provider request failed", error);
    return NextResponse.json(
      { message: "Không thể kết nối dịch vụ email. Vui lòng thử lại sau." },
      { status: 502 },
    );
  }
}

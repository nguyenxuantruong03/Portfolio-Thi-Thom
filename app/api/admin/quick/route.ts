import { withRefresh } from "@/lib/revalidate";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  createQuickItem,
  deleteQuickItem,
  listQuickItems,
  reorderQuickItems,
  updateQuickItem,
} from "@/lib/content-repository";
import { quickDeleteSchema, quickPatchSchema, quickPostSchema } from "@/lib/admin-content-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: message, ...(details === undefined ? {} : { details }) }, { status });
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) throw new Error("EMPTY_REQUEST_BODY");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("INVALID_JSON");
  }
}

/** Quick-add sections: Professional Projects and 2D Graphic Design. */
export async function GET() {
  try {
    if (!(await requireAdmin())) return jsonError("UNAUTHORIZED", 401);
    return NextResponse.json({ items: await listQuickItems(undefined, true) });
  } catch (error) {
    console.error("GET /api/admin/quick failed:", error);
    return jsonError("CONTENT_LOAD_FAILED", 503);
  }
}

async function handlePOST(request: Request) {
  try {
    if (!(await requireAdmin())) return jsonError("UNAUTHORIZED", 401);
    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "INVALID_JSON", 400);
    }
    const parsed = quickPostSchema.safeParse(raw);
    if (!parsed.success) return jsonError("VALIDATION_FAILED", 422, parsed.error.flatten());
    const item = await createQuickItem({ ...parsed.data.item, linkUrl: parsed.data.item.linkUrl || undefined });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/quick failed:", error);
    const message = error instanceof Error ? error.message : "CREATE_FAILED";
    const isConflict = /duplicate|unique/i.test(message);
    return jsonError(isConflict ? "DUPLICATE_CONTENT" : "CREATE_FAILED", isConflict ? 409 : 500);
  }
}

async function handlePATCH(request: Request) {
  try {
    if (!(await requireAdmin())) return jsonError("UNAUTHORIZED", 401);
    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "INVALID_JSON", 400);
    }
    const parsed = quickPatchSchema.safeParse(raw);
    if (!parsed.success) return jsonError("VALIDATION_FAILED", 422, parsed.error.flatten());

    if (parsed.data.type === "reorder") {
      await reorderQuickItems(parsed.data.section, parsed.data.ids);
      return NextResponse.json({ ok: true });
    }
    const item = await updateQuickItem(parsed.data.id, parsed.data.patch);
    return item ? NextResponse.json({ item }) : jsonError("NOT_FOUND", 404);
  } catch (error) {
    console.error("PATCH /api/admin/quick failed:", error);
    return jsonError("UPDATE_FAILED", 500);
  }
}

async function handleDELETE(request: Request) {
  try {
    if (!(await requireAdmin())) return jsonError("UNAUTHORIZED", 401);
    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "INVALID_JSON", 400);
    }
    const parsed = quickDeleteSchema.safeParse(raw);
    if (!parsed.success) return jsonError("VALIDATION_FAILED", 422, parsed.error.flatten());
    return (await deleteQuickItem(parsed.data.id)) ? NextResponse.json({ ok: true }) : jsonError("NOT_FOUND", 404);
  } catch (error) {
    console.error("DELETE /api/admin/quick failed:", error);
    return jsonError("DELETE_FAILED", 500);
  }
}

// Each successful change also refreshes the cached public pages.
export const POST = withRefresh(handlePOST);
export const PATCH = withRefresh(handlePATCH);
export const DELETE = withRefresh(handleDELETE);

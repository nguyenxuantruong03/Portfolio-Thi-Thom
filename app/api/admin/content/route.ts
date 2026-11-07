import { withRefresh } from "@/lib/revalidate";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  createFeatured,
  createProject,
  deleteFeatured,
  deleteProject,
  listFeatured,
  listProjects,
  reorder,
  updateFeatured,
  updateProject,
} from "@/lib/content-repository";
import {
  adminContentDeleteSchema,
  adminContentPatchSchema,
  adminContentPostSchema,
} from "@/lib/admin-content-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { error: message, ...(details === undefined ? {} : { details }) },
    { status },
  );
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) {
    throw new Error("EMPTY_REQUEST_BODY");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("INVALID_JSON");
  }
}

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin())) return jsonError("UNAUTHORIZED", 401);

    const url = new URL(request.url);
    const type = url.searchParams.get("type");

    if (type === "featured") {
      return NextResponse.json({ items: await listFeatured(true) });
    }

    if (type === "projects") {
      return NextResponse.json({ items: await listProjects(true) });
    }

    return NextResponse.json({
      featured: await listFeatured(true),
      projects: await listProjects(true),
    });
  } catch (error) {
    console.error("GET /api/admin/content failed:", error);
    return jsonError(
      error instanceof Error && error.message === "EMPTY_REQUEST_BODY"
        ? error.message
        : "CONTENT_LOAD_FAILED",
      503,
    );
  }
}

async function handlePOST(request: Request) {
  try {
    if (!(await requireAdmin())) return jsonError("UNAUTHORIZED", 401);

    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch (error) {
      return jsonError(
        error instanceof Error ? error.message : "INVALID_JSON",
        400,
      );
    }

    const parsed = adminContentPostSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError("VALIDATION_FAILED", 422, parsed.error.flatten());
    }

    if (parsed.data.type === "featured") {
      const item = await createFeatured(parsed.data.item);
      return NextResponse.json({ item }, { status: 201 });
    }

    const item = await createProject(parsed.data.item);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/content failed:", error);
    const message = error instanceof Error ? error.message : "CREATE_FAILED";
    const isConflict = /duplicate|unique/i.test(message);
    return jsonError(
      isConflict ? "DUPLICATE_CONTENT" : "CREATE_FAILED",
      isConflict ? 409 : 500,
    );
  }
}

async function handlePATCH(request: Request) {
  try {
    if (!(await requireAdmin())) return jsonError("UNAUTHORIZED", 401);

    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch (error) {
      return jsonError(
        error instanceof Error ? error.message : "INVALID_JSON",
        400,
      );
    }

    const parsed = adminContentPatchSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError("VALIDATION_FAILED", 422, parsed.error.flatten());
    }

    if (parsed.data.type === "reorder") {
      await reorder(parsed.data.kind, parsed.data.ids);
      return NextResponse.json({ ok: true });
    }

    if (parsed.data.type === "featured") {
      const item = await updateFeatured(parsed.data.id, parsed.data.patch);
      return item ? NextResponse.json({ item }) : jsonError("NOT_FOUND", 404);
    }

    const item = await updateProject(parsed.data.id, parsed.data.patch);
    return item ? NextResponse.json({ item }) : jsonError("NOT_FOUND", 404);
  } catch (error) {
    console.error("PATCH /api/admin/content failed:", error);
    const message = error instanceof Error ? error.message : "UPDATE_FAILED";
    const isConflict = /duplicate|unique/i.test(message);
    return jsonError(
      isConflict ? "DUPLICATE_CONTENT" : "UPDATE_FAILED",
      isConflict ? 409 : 500,
    );
  }
}

async function handleDELETE(request: Request) {
  try {
    if (!(await requireAdmin())) return jsonError("UNAUTHORIZED", 401);

    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch (error) {
      return jsonError(
        error instanceof Error ? error.message : "INVALID_JSON",
        400,
      );
    }

    const parsed = adminContentDeleteSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError("VALIDATION_FAILED", 422, parsed.error.flatten());
    }

    const ok =
      parsed.data.type === "featured"
        ? await deleteFeatured(parsed.data.id)
        : await deleteProject(parsed.data.id);

    return ok ? NextResponse.json({ ok: true }) : jsonError("NOT_FOUND", 404);
  } catch (error) {
    console.error("DELETE /api/admin/content failed:", error);
    return jsonError("DELETE_FAILED", 500);
  }
}

// Each successful change also refreshes the cached public pages.
export const POST = withRefresh(handlePOST);
export const PATCH = withRefresh(handlePATCH);
export const DELETE = withRefresh(handleDELETE);

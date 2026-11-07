"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { RichEditor, uploadToCloudinary } from "./editor";
import { QuickSectionManager } from "./quick-section";
import { ProjectLayoutBuilder, ProjectLayoutContent } from "@/components/project-layout-builder";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { optimizedVideoUrl } from "@/lib/media";
import { ArrowDown, ArrowUp, GripVertical, Image as ImageIcon, LogOut, Pencil, Plus, Search, Trash2, Video } from "lucide-react";
import type {
  FeaturedContent,
  MediaAsset,
  ProjectCategory,
  ProjectContent,
  RichContent,
} from "@/lib/content-types";

const emptyDoc: RichContent = { type: "doc", content: [{ type: "paragraph" }] };

type Tab = "featured" | "projects";
/**
 * Projects are intentionally unified inside the CMS: one rich project model with
 * a `category` field that controls whether the project is Personal or Professional
 * on the public home page. 2D Graphic Design remains a separate quick-add section.
 */
type Section = "featured" | "personal" | "professional" | "design2d";
const SECTIONS: { id: Section; label: string }[] = [
  { id: "personal", label: "Personal Projects" },
  { id: "professional", label: "Professional Projects" },
  { id: "design2d", label: "2D Graphic Design" },
];

const LABEL_PRESETS: Record<Tab, string[]> = {
  featured: ["Featured Work", "Highlight", "Case Study", "Experiment"],
  projects: ["Project", "Personal Project", "Client Project", "Case Study", "Experiment"],
};

function createProjectSlug(title: string) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, (letter) => (letter === "Đ" ? "d" : "d"))
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type EditorItem = {
  kind: Tab;
  id: string;
  category?: ProjectCategory;
  clientName?: string;
  projectRole?: string;
  projectPeriod?: string;
  externalUrl?: string;
  label: string;
  topic?: string;
  title: string;
  excerpt?: string;
  slug?: string;
  eyebrow?: string;
  subtitle?: string;
  tags?: string[];
  content: RichContent;
  contentHtml: string;
  media: MediaAsset[];
  cardImage?: MediaAsset | null;
  published: boolean;
  sortOrder: number;
};

function getContentLabel(item: EditorItem) {
  return item.label.trim();
}


function getVideoPosterUrl(url: string) {
  if (!url.includes("/video/upload/")) return undefined;
  const transformed = url.replace("/video/upload/", "/video/upload/so_0/");
  return transformed.replace(/\.(mp4|webm|mov|m4v|ogv)(?:\?.*)?$/i, ".jpg");
}

function ListMediaPreview({ asset }: { asset?: MediaAsset }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovering, setHovering] = useState(false);

  if (!asset) {
    return <div className="flex aspect-[4/3] w-20 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-300"><ImageIcon className="size-5" /></div>;
  }

  if (asset.resourceType !== "video") {
    return <img src={asset.url} alt={asset.alt ?? ""} loading="lazy" className="aspect-[4/3] w-20 rounded-lg object-cover" />;
  }

  const poster = getVideoPosterUrl(asset.url);

  return (
    <div
      className="relative aspect-[4/3] w-20 overflow-hidden rounded-lg bg-slate-200"
      onMouseEnter={() => {
        setHovering(true);
        void videoRef.current?.play().catch(() => undefined);
      }}
      onMouseLeave={() => {
        setHovering(false);
        const video = videoRef.current;
        if (video) {
          video.pause();
          try { video.currentTime = 0; } catch { /* ignore */ }
        }
      }}
    >
      {poster ? <img src={poster} alt={asset.alt ?? "Video thumbnail"} className="absolute inset-0 h-full w-full object-cover" /> : null}
      <video
        ref={videoRef}
        src={optimizedVideoUrl(asset.url)}
        muted
        playsInline
        preload="metadata"
        poster={poster}
        className={`relative z-[1] h-full w-full object-cover transition-opacity duration-150 ${hovering ? "opacity-100" : "opacity-0"}`}
        aria-label={asset.alt ?? "Video"}
      />
      <span className="pointer-events-none absolute bottom-1 right-1 z-10 rounded bg-black/65 p-0.5 text-white">
        <Video className="size-3" />
      </span>
    </div>
  );
}

function PreviewMedia({ asset }: { asset: MediaAsset }) {
  if (asset.resourceType === "video") {
    return <video src={optimizedVideoUrl(asset.url)} controls autoPlay playsInline poster={getVideoPosterUrl(asset.url)} className="max-h-[70vh] w-full rounded-2xl bg-black object-contain" />;
  }
  return <img src={asset.url} alt={asset.alt ?? ""} className="max-h-[70vh] w-full rounded-2xl object-contain" />;
}

export default function ContentAdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [section, setSection] = useState<Section>("personal");
  const tab: Tab = section === "featured" ? "featured" : "projects";
  const isQuick = section === "design2d";
  const [featured, setFeatured] = useState<FeaturedContent[]>([]);
  const [projects, setProjects] = useState<ProjectContent[]>([]);
  // Personal and Professional are separate CMS lists. They still share the same
  // ProjectContent model/table, but ordering is scoped to the selected category.
  const sectionProjects = useMemo(() => {
    if (section === "professional") return projects.filter((project) => project.category === "professional");
    if (section === "personal") return projects.filter((project) => project.category !== "professional");
    return projects;
  }, [projects, section]);
  const [editing, setEditing] = useState<EditorItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyActionState, setBusyAction] = useState<string | null>(null);
  // True until the first load of the CMS data finishes.
  const [booting, setBooting] = useState(true);
  // While data is still loading every create / update / delete / reorder control is treated as busy,
  // so nothing can be changed or removed before the list it refers to has arrived.
  const busyAction = busyActionState ?? (booting ? "loading" : null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [listPreview, setListPreview] = useState<EditorItem | null>(null);
  const previewMedia = listPreview?.cardImage ?? listPreview?.media[0] ?? null;

  async function readJsonResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    if (!text.trim()) {
      throw new Error(`API trả về response rỗng. HTTP ${response.status}.`);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(
        `API trả về dữ liệu không phải JSON. HTTP ${response.status}. Response: ${text.slice(0, 500)}`,
      );
    }
  }

  async function load() {
    try {
      const response = await fetch("/api/admin/content", {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (response.status === 401) {
        setLoggedIn(false);
        return;
      }
      const data = await readJsonResponse<{
        featured?: FeaturedContent[];
        projects?: ProjectContent[];
        error?: string;
      }>(response);
      if (!response.ok) {
        throw new Error(
          data.error ?? `Không thể tải nội dung. HTTP ${response.status}`,
        );
      }
      setFeatured(Array.isArray(data.featured) ? data.featured : []);
      setProjects(Array.isArray(data.projects) ? data.projects : []);
      setLoggedIn(true);
    } catch (error) {
      console.error("Failed to load admin content:", error);
      setMessage(
        error instanceof Error ? error.message : "Không thể tải nội dung.",
      );
      setLoggedIn(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    async function initialize() {
      try {
        const response = await fetch("/api/admin/content", {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (response.status === 401) {
          setLoggedIn(false);
          return;
        }

        const data = await readJsonResponse<{
          featured?: FeaturedContent[];
          projects?: ProjectContent[];
          error?: string;
          details?: unknown;
        }>(response);

        if (!response.ok) {
          throw new Error(data.error ?? "CONTENT_LOAD_FAILED");
        }

        if (controller.signal.aborted) return;

        setFeatured(data.featured ?? []);
        setProjects(data.projects ?? []);
        setLoggedIn(true);
      } catch (error) {
        if (controller.signal.aborted) return;

        console.error("Failed to initialize CMS:", error);

        setMessage(
          error instanceof Error ? error.message : "CONTENT_LOAD_FAILED",
        );

        setLoggedIn(false);
      } finally {
        if (!controller.signal.aborted) setBooting(false);
      }
    }

    void initialize();

    return () => {
      controller.abort();
    };
  }, []);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!response.ok) {
      setMessage("Mật khẩu không đúng.");
      toast.error("Đăng nhập thất bại", { description: "Mật khẩu không chính xác." });
      return;
    }
    setPassword("");
    setMessage("");
    await load();
  }

  const handleQuickUnauthorized = useCallback(() => {
    setLoggedIn(false);
    setEditing(null);
  }, []);

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setLoggedIn(false);
    setEditing(null);
  }

  function newItem(kind: Tab) {
    setEditing({
      kind,
      id: crypto.randomUUID(),
      title: "",
      label: kind === "featured" ? "Featured" : "Project",
      topic: kind === "featured" ? "Featured Work" : undefined,
      slug: kind === "projects" ? "" : undefined,
      category:
        kind === "projects"
          ? section === "professional"
            ? "professional"
            : "personal"
          : undefined,
      clientName: "", projectRole: "", projectPeriod: "", externalUrl: "",
      eyebrow: kind === "projects" ? "" : undefined,
      subtitle: kind === "projects" ? "" : undefined,
      excerpt: "",
      tags: [],
      content: emptyDoc,
      contentHtml: "",
      media: [],
      cardImage: null,
      published: true,
      sortOrder:
        kind === "featured"
          ? featured.length
          : sectionProjects.length,
    });
  }

  async function persistMedia(kind: Tab, id: string, media: MediaAsset[]) {
    const response = await fetch("/api/admin/content", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        Accept: "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        type: kind === "projects" ? "projects" : "featured",
        id,
        patch: { media },
      }),
    });

    const raw = await response.text();
    let data: { error?: string } = {};
    try {
      data = raw ? (JSON.parse(raw) as { error?: string }) : {};
    } catch {
      throw new Error(
        `MEDIA_PERSIST_FAILED: API returned invalid JSON (${response.status}).`,
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error ?? `MEDIA_PERSIST_FAILED: HTTP ${response.status}`,
      );
    }
  }

  async function ensureDraftForMedia(item: EditorItem) {
    const exists =
      item.kind === "featured"
        ? featured.some((x) => x.id === item.id)
        : projects.some((x) => x.id === item.id);

    if (exists) return;

    const draft =
      item.kind === "featured"
        ? {
            id: item.id,
            label: item.label.trim() || "Featured",
            topic: item.topic?.trim() || "Draft",
            title: item.title.trim() || "Untitled draft",
            excerpt: item.excerpt?.trim() || undefined,
            content: item.content,
            contentHtml: item.contentHtml,
            media: [],
            published: false,
            sortOrder: item.sortOrder,
          }
        : {
            id: item.id,
            slug: createProjectSlug(item.title) || `draft-${item.id.slice(0, 8)}`,
            category: item.category ?? "personal",
            clientName: item.clientName ?? "", projectRole: item.projectRole ?? "", projectPeriod: item.projectPeriod ?? "", externalUrl: item.externalUrl ?? "",
            label: item.label.trim() || "Project",
            eyebrow: item.eyebrow?.trim() || "Draft",
            title: item.title.trim() || "Untitled draft",
            subtitle: item.subtitle?.trim() || "",
            excerpt: item.excerpt?.trim() || undefined,
            content: item.content,
            contentHtml: item.contentHtml,
            media: [],
            cardImage: item.cardImage ?? null,
            tags: item.tags ?? [],
            published: false,
            sortOrder: item.sortOrder,
          };

    const response = await fetch("/api/admin/content", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Accept: "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        type: item.kind === "projects" ? "projects" : "featured",
        item: draft,
      }),
    });

    const raw = await response.text();
    let data: { error?: string } = {};
    try {
      data = raw ? (JSON.parse(raw) as { error?: string }) : {};
    } catch {
      throw new Error(
        `DRAFT_CREATE_FAILED: API returned invalid JSON (${response.status}).`,
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error ?? `DRAFT_CREATE_FAILED: HTTP ${response.status}`,
      );
    }

    await load();
  }

  async function save() {
    if (!editing || busyAction) return;
    const displayLabel = getContentLabel(editing);
    if (!displayLabel) {
      toast.error("Thiếu Display Label", { description: "Nếu chọn Other, bạn bắt buộc phải nhập nhãn tùy chỉnh." });
      return;
    }
    setLoading(true);
    setBusyAction("save");
    setMessage("");
    try {
      const payload =
        editing.kind === "featured"
          ? {
              id: editing.id,
              label: editing.label.trim(),
              topic: editing.topic?.trim() || "Featured Work",
              title: editing.title.trim(),
              excerpt: editing.excerpt?.trim() || undefined,
              content: editing.content,
              contentHtml: editing.contentHtml,
              media: editing.media,
              published: editing.published,
              sortOrder: editing.sortOrder,
            }
          : {
              id: editing.id,
              slug: createProjectSlug(editing.title) || `project-${editing.id.slice(0, 8)}`,
              category: editing.category ?? "personal",
              clientName: editing.clientName ?? "", projectRole: editing.projectRole ?? "", projectPeriod: editing.projectPeriod ?? "", externalUrl: editing.externalUrl ?? "",
              label: editing.label.trim(),
              eyebrow: editing.eyebrow?.trim() ?? "",
              title: editing.title.trim(),
              subtitle: editing.subtitle?.trim() ?? "",
              excerpt: editing.excerpt?.trim() || undefined,
              content: editing.content,
              contentHtml: editing.contentHtml,
              media: editing.media,
              cardImage: editing.cardImage ?? null,
              tags: editing.tags ?? [],
              published: editing.published,
              sortOrder: editing.sortOrder,
            };

      const exists = editing.kind === "featured"
        ? featured.some((x) => x.id === editing.id)
        : projects.some((x) => x.id === editing.id);
      const response = await fetch("/api/admin/content", {
        method: exists ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(exists
          ? { type: editing.kind === "projects" ? "projects" : "featured", id: editing.id, patch: payload }
          : { type: editing.kind === "projects" ? "projects" : "featured", item: payload }),
      });
      const data = await readJsonResponse<{
        error?: string;
        details?: {
          formErrors?: string[];
          fieldErrors?: Record<string, string[]>;
        };
      }>(response);
      if (!response.ok) {
        const validationMessages = data.details
          ? [
              ...(data.details.formErrors ?? []),
              ...Object.entries(data.details.fieldErrors ?? {}).flatMap(
                ([field, errors]) => errors.map((detail) => `${field}: ${detail}`),
              ),
            ]
          : [];
        throw new Error(
          [data.error ?? "Không thể lưu nội dung.", ...validationMessages].join(" — "),
        );
      }
      setMessage("Đã lưu.");
      toast.success("Đã lưu nội dung", { description: "Nội dung portfolio đã được cập nhật." });
      setEditing(null);
      await load();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Không thể lưu nội dung.";
      setMessage(errorMessage);
      toast.error("Lưu nội dung thất bại", { description: errorMessage });
    } finally {
      setLoading(false);
      setBusyAction(null);
    }
  }

  async function remove(kind: Tab, id: string) {
    if (busyAction || !window.confirm("Xoá nội dung này?")) return;
    setBusyAction(`delete:${id}`);
    try {
      const response = await fetch("/api/admin/content", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: kind === "projects" ? "projects" : "featured", id }),
      });
      const data = response.ok ? {} : await readJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "Không thể xoá nội dung.");
      toast.success("Đã xoá nội dung");
      await load();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Không thể xoá.";
      setMessage(errorMessage);
      toast.error("Xoá nội dung thất bại", { description: errorMessage });
    } finally {
      setBusyAction(null);
    }
  }

  async function persistOrder(kind: Tab, subsetIds: string[], optimistic: boolean) {
    const previousFeatured = featured;
    const previousProjects = projects;
    // Projects are shown as two independent CMS lists. Reordering one category
    // must never move Personal items relative to Professional items (or vice versa).
    let ids = subsetIds;
    if (kind === "projects") {
      const wanted = new Set(subsetIds);
      let cursor = 0;
      ids = projects.map((item) => (wanted.has(item.id) ? subsetIds[cursor++] : item.id));
    }
    if (optimistic) {
      if (kind === "featured") {
        const next = ids.map((id) => featured.find((item) => item.id === id)).filter(Boolean) as FeaturedContent[];
        setFeatured(next);
      } else {
        const next = ids.map((id) => projects.find((item) => item.id === id)).filter(Boolean) as ProjectContent[];
        setProjects(next);
      }
    }
    setBusyAction("reorder");
    try {
      const response = await fetch("/api/admin/content", {
        method: "PATCH",
        headers: { "content-type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ type: "reorder", kind, ids }),
      });
      const data = response.ok ? {} : await readJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "Không thể sắp xếp.");
      toast.success("Đã cập nhật thứ tự hiển thị");
    } catch (error) {
      if (kind === "featured") setFeatured(previousFeatured);
      else setProjects(previousProjects);
      const errorMessage = error instanceof Error ? error.message : "Không thể sắp xếp.";
      setMessage(errorMessage);
      toast.error("Không thể thay đổi thứ tự", { description: errorMessage });
    } finally {
      setBusyAction(null);
      setDraggingId(null);
    }
  }

  async function move(kind: Tab, id: string, direction: -1 | 1) {
    if (busyAction) return;
    const source = kind === "featured" ? featured : sectionProjects;
    const index = source.findIndex((item) => item.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= source.length) return;
    const ids = source.map((item) => item.id);
    [ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]];
    await persistOrder(kind, ids, true);
  }

  async function moveTo(kind: Tab, id: string, targetIndex: number) {
    if (busyAction) return;
    const source = kind === "featured" ? featured : sectionProjects;
    const index = source.findIndex((item) => item.id === id);
    if (index < 0 || targetIndex < 0 || targetIndex >= source.length || index === targetIndex) return;
    const ids = source.map((item) => item.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(targetIndex, 0, moved);
    await persistOrder(kind, ids, true);
  }

  function handleDragStart(id: string) {
    if (search.trim() || statusFilter !== "all" || !!busyAction) return;
    setDraggingId(id);
  }

  async function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId || busyAction) return;
    const source = tab === "featured" ? featured : sectionProjects;
    const from = source.findIndex((item) => item.id === draggingId);
    const to = source.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const ids = source.map((item) => item.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    await persistOrder(tab, ids, true);
  }

  const sourceList = tab === "featured" ? featured : sectionProjects;
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sourceList.filter((item) => {
      const haystack =
        tab === "featured"
          ? [item.title, item.label, "topic" in item ? item.topic : "", item.excerpt ?? ""].join(" ")
          : [
              item.title,
              "slug" in item ? item.slug : "",
              item.label,
              "eyebrow" in item ? item.eyebrow : "",
              "subtitle" in item ? item.subtitle : "",
              item.excerpt ?? "",
              ...("tags" in item ? item.tags ?? [] : []),
            ].join(" ");
      const matchesSearch = !q || haystack.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "published" ? item.published : !item.published);
      return matchesSearch && matchesStatus;
    });
  }, [sourceList, search, statusFilter, tab]);

  if (booting) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <p role="status" aria-live="polite" className="text-sm font-medium text-slate-500">Đang tải dữ liệu…</p>
      </main>
    );
  }

  if (!loggedIn) {
    return (
      <main className="min-h-screen bg-slate-50 p-6 grid place-items-center">
        <form
          onSubmit={login}
          className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-sm border border-slate-200"
        >
          <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-600">
            Portfolio CMS
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Đăng nhập quản trị
          </h1>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Mật khẩu"
            className="mt-6 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400"
          />
          <button
            disabled={loading}
            className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Đang kiểm tra…" : "Đăng nhập"}
          </button>
          {message && <p className="mt-3 text-sm text-red-600">{message}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {editing && <div aria-hidden="true" className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm" />}
      <div className="mx-auto max-w-7xl p-5 sm:p-8">

        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-600">Portfolio CMS</p>
            <h1 className="mt-1 text-3xl font-bold">Portfolio Content</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Quản lý nội dung, media, trạng thái và thứ tự hiển thị. Kéo thả trực tiếp để đổi vị trí.
            </p>
          </div>
          <div className="flex gap-2">
            {!isQuick && (
              <Button disabled={!!busyAction || !!editing} onClick={() => newItem(tab)} size="sm">
                <Plus className="size-4" /> {section === "featured" ? "Create New" : `Thêm vào ${SECTIONS.find((entry) => entry.id === section)?.label}`}
              </Button>
            )}
            <Button disabled={!!busyAction} onClick={logout} variant="outline" size="sm">
              <LogOut className="size-4" /> Log Out
            </Button>
          </div>
        </header>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {SECTIONS.map((entry) => (
              <button key={entry.id} onClick={() => { setSection(entry.id); setSearch(""); }} className={cn("rounded-lg px-4 py-2 text-sm font-semibold", section === entry.id ? "bg-blue-600 text-white" : "text-slate-600")}>
                {entry.label}
                {(entry.id === "personal" || entry.id === "professional") && (
                  <span className="ml-1 opacity-70">
                    {entry.id === "professional"
                      ? projects.filter((project) => project.category === "professional").length
                      : projects.filter((project) => project.category !== "professional").length}
                  </span>
                )}
              </button>
            ))}
          </div>
          {!isQuick && <><div className="relative min-w-[240px] flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm project, category, tag, slug…" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400" />
          </div>
          <div className="flex rounded-xl border border-slate-200 bg-white p-1">
            {(["all", "published", "draft"] as const).map((status) => (
              <button key={status} onClick={() => setStatusFilter(status)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", statusFilter === status ? "bg-slate-900 text-white" : "text-slate-500")}>
                {status === "all" ? "All" : status === "published" ? "Published" : "Drafts"}
              </button>
            ))}
          </div></>}
        </div>

        {!isQuick && <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <p><span className="font-semibold text-slate-700">{list.length}</span> / {sourceList.length} items · {sourceList.filter((x) => x.published).length} published</p>
          <p className="inline-flex items-center gap-1.5"><GripVertical className="size-3.5" /> Drag the handle to reorder <span className="text-slate-300">·</span> order is saved automatically</p>
        </div>}

        {isQuick ? (
          <QuickSectionManager key={section} section={section} onUnauthorized={handleQuickUnauthorized} />
        ) : editing ? (
          <section role="dialog" aria-modal="true" aria-label={list.some((x) => x.id === editing.id) ? "Edit content" : "Create content"} className="fixed inset-3 z-50 mt-0 max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl ring-1 ring-black/5 sm:inset-6 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold">
                    {list.some((x) => x.id === editing.id) ? "Edit Content" : "Create Content"}
                  </h2>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-700">
                    {getContentLabel(editing) || "Chưa đặt nhãn"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {list.some((x) => x.id === editing.id) ? "Update your portfolio content." : "You are in a focused editor. The content lists are temporarily locked until you save or close this form."}
                </p>
              </div>
              <button
                disabled={!!busyAction}
                onClick={() => setEditing(null)}
                className="rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                Close
              </button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {editing.kind === "featured" ? (
                <Field label="Display Label">
                  {(() => {
                    const value = editing.label.trim();
                    const isPreset = LABEL_PRESETS.featured.includes(value);
                    return (
                      <div className="space-y-2">
                        <select
                          value={isPreset ? value : "__other__"}
                          onChange={(e) =>
                            setEditing({
                              ...editing,
                              label: e.target.value === "__other__" ? "" : e.target.value,
                            })
                          }
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        >
                          {LABEL_PRESETS.featured.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                          <option value="__other__">Other…</option>
                        </select>
                        {!isPreset && (
                          <input
                            autoFocus
                            value={editing.label}
                            placeholder="Nhập nhãn tùy chỉnh"
                            onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                            aria-required="true"
                          />
                        )}
                        <p className="text-xs text-slate-500">Chọn nhãn có sẵn hoặc chọn Other để nhập nhãn riêng. Other bắt buộc phải có nội dung.</p>
                      </div>
                    );
                  })()}
                </Field>
              ) : (
                <>
                  <Field label="Page URL">
                    <div className="flex min-h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                      <span className="mr-1 text-slate-400">/projects/</span>
                      <span className="break-all font-medium">
                        {createProjectSlug(editing.title) || "ten-du-an"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Automatically generated from the project title.
                    </p>
                  </Field>
                  <Field label="Display Label">
                    {(() => {
                      const value = editing.label.trim();
                      const isPreset = LABEL_PRESETS.projects.includes(value);
                      return (
                        <div className="space-y-2">
                          <select
                            value={isPreset ? value : "__other__"}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                label: e.target.value === "__other__" ? "" : e.target.value,
                              })
                            }
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                          >
                            {LABEL_PRESETS.projects.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                            <option value="__other__">Other…</option>
                          </select>
                          {!isPreset && (
                            <input
                              autoFocus
                              value={editing.label}
                              placeholder="Nhập nhãn tùy chỉnh"
                              onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                              aria-required="true"
                            />
                          )}
                          <p className="text-xs text-slate-500">Chọn nhãn có sẵn hoặc chọn Other để nhập nhãn riêng. Other bắt buộc phải có nội dung.</p>
                        </div>
                      );
                    })()}
                  </Field>
                </>
              )}
              <Field label="Title">
                <input
                  value={editing.title}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      title: e.target.value,
                      ...(editing.kind === "projects"
                        ? { slug: createProjectSlug(e.target.value) }
                        : {}),
                    })
                  }
                />
              </Field>
              {editing.kind === "projects" && (
                <Field label="Project Category">
                  <select value={editing.category ?? "personal"} onChange={(e) => setEditing({ ...editing, category: e.target.value as ProjectCategory })} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400">
                    <option value="personal">Personal Project</option>
                    <option value="professional">Professional Project</option>
                  </select>
                </Field>
              )}
              {editing.kind === "projects" && editing.category === "professional" && (
                <>
                  <Field label="Client / Organization"><input value={editing.clientName ?? ""} onChange={(e) => setEditing({ ...editing, clientName: e.target.value })} placeholder="Tên khách hàng / doanh nghiệp" /></Field>
                  <Field label="Role / Responsibility"><input value={editing.projectRole ?? ""} onChange={(e) => setEditing({ ...editing, projectRole: e.target.value })} placeholder="Vai trò đảm nhiệm" /></Field>
                  <Field label="Project Period"><input value={editing.projectPeriod ?? ""} onChange={(e) => setEditing({ ...editing, projectPeriod: e.target.value })} placeholder="MM/YYYY – MM/YYYY" /></Field>
                </>
              )}
              {editing.kind === "projects" && (
                <Field label="Subtitle">
                  <input
                    value={editing.subtitle}
                    onChange={(e) =>
                      setEditing({ ...editing, subtitle: e.target.value })
                    }
                  />
                </Field>
              )}
              <Field label="Short Description">
                <textarea
                  value={editing.excerpt}
                  onChange={(e) =>
                    setEditing({ ...editing, excerpt: e.target.value })
                  }
                />
              </Field>
              {editing.kind === "projects" && (
                <Field label="Tags (comma-separated)">
                  <input
                    value={(editing.tags ?? []).join(", ")}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        tags: e.target.value
                          .split(",")
                          .map((x) => x.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>
              )}
            </div>

            <div className="mt-5">
              <label className="mb-2 block text-sm font-semibold">
                Story & Details
              </label>
              {editing.kind === "projects" ? (
                <ProjectLayoutBuilder
                  key={editing.id}
                  value={editing.content}
                  cardImage={editing.cardImage ?? null}
                  detailMedia={editing.media}
                  title={editing.title}
                  eyebrow={editing.eyebrow ?? ""}
                  description={editing.excerpt ?? editing.subtitle ?? ""}
                  tags={editing.tags ?? []}
                  onCardImageChange={(cardImage) => setEditing(current => current ? { ...current, cardImage } : current)}
                  onChange={(content) => setEditing(current => current ? { ...current, content, contentHtml: "" } : current)}
                />
              ) : (
                <RichEditor
                  value={{ json: editing.content, html: editing.contentHtml }}
                  onChange={(value) => setEditing({ ...editing, content: value.json, contentHtml: value.html })}
                />
              )}
            </div>

            {editing.kind === "featured" && <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Photos & Videos</p>
                  <p className="text-xs text-slate-500">
                    Add the visuals that best tell the story of this project.
                  </p>
                </div>
                <label className={`rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white ${busyAction ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                  {busyAction === "upload" ? "Uploading…" : "+ Add Media"}
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    disabled={!!busyAction}
                    className="hidden"
                    onChange={async (e) => {
                      const input = e.currentTarget;
                      const files = Array.from(input.files ?? []);

                      if (files.length === 0) {
                        return;
                      }

                      // Clear trước khi await.
                      // Cho phép chọn lại đúng file vừa upload.
                      input.value = "";

                      setBusyAction("upload");
                      let uploadedCount = 0;
                      const failedFiles: string[] = [];
                      let workingMedia = editing?.media ?? [];
                      let mediaOwner = editing;
                      let draftEnsured = editing
                        ? editing.kind === "featured"
                          ? featured.some((item) => item.id === editing.id)
                          : projects.some((item) => item.id === editing.id)
                        : false;

                      for (const file of files) {
                        try {
                          setMessage(
                            `Đang chuẩn bị lưu bản nháp cho ${file.name}...`,
                          );
                          const currentEditing = mediaOwner;
                          if (!currentEditing) throw new Error("EDITOR_CLOSED");

                          // A new CMS item must exist in PostgreSQL before Cloudinary upload.
                          // This prevents successful Cloudinary uploads from becoming DB-orphaned.
                          if (!draftEnsured) {
                            await ensureDraftForMedia(currentEditing);
                            draftEnsured = true;
                          }

                          setMessage(`Đang upload ${file.name}...`);
                          const asset = await uploadToCloudinary(file);
                          workingMedia = [...workingMedia, asset];

                          setEditing((current) =>
                            current
                              ? { ...current, media: workingMedia }
                              : current,
                          );
                          await persistMedia(
                            currentEditing.kind,
                            currentEditing.id,
                            workingMedia,
                          );
                          mediaOwner = {
                            ...currentEditing,
                            media: workingMedia,
                          };
                          uploadedCount += 1;
                        } catch (error) {
                          failedFiles.push(
                            `${file.name}: ${error instanceof Error ? error.message : "Upload thất bại"}`,
                          );
                        }
                      }

                      if (failedFiles.length === 0) {
                        setMessage(
                          `${uploadedCount} media đã upload và lưu PostgreSQL thành công.`,
                        );
                      } else if (uploadedCount > 0) {
                        setMessage(
                          `${uploadedCount} media đã lưu thành công. ${failedFiles.join(" | ")}`,
                        );
                      } else {
                        setMessage(failedFiles.join(" | "));
                      }
                      await load();
                      if (failedFiles.length === 0) {
                        toast.success("Upload hoàn tất", { description: `${uploadedCount} media đã được lưu.` });
                      } else {
                        toast.error("Upload chưa hoàn tất", { description: failedFiles.join(" | ") });
                      }
                      setBusyAction(null);
                    }}
                  />
                </label>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {editing.media.map((asset) => (
                  <div
                    key={asset.id}
                    className="relative overflow-hidden rounded-xl border bg-slate-50"
                  >
                    <button
                      type="button"
                      disabled={!!busyAction}
                      onClick={async () => {
                        if (!editing || busyAction) return;
                        setBusyAction(`media-delete:${asset.id}`);
                        const nextMedia = editing.media.filter(
                          (x) => x.id !== asset.id,
                        );
                        setEditing({ ...editing, media: nextMedia });

                        const exists =
                          editing.kind === "featured"
                            ? featured.some((item) => item.id === editing.id)
                            : projects.some((item) => item.id === editing.id);

                        if (exists) {
                          try {
                            await persistMedia(
                              editing.kind,
                              editing.id,
                              nextMedia,
                            );
                            setMessage(
                              "Media đã được cập nhật trong PostgreSQL.",
                            );
                          } catch (error) {
                            setEditing({ ...editing, media: editing.media });
                            setMessage(
                              error instanceof Error
                                ? error.message
                                : "MEDIA_PERSIST_FAILED",
                            );
                            toast.error("Không thể cập nhật media", { description: error instanceof Error ? error.message : "MEDIA_PERSIST_FAILED" });
                          }
                        }
                        setBusyAction(null);
                      }}
                      className="absolute right-2 top-2 z-10 rounded-full bg-white px-2 py-1 text-xs shadow disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ×
                    </button>
                    {asset.resourceType === "video" ? (
                      <video
                        src={optimizedVideoUrl(asset.url)}
                        controls
                        className="aspect-video w-full object-cover"
                      />
                    ) : (
                      <img
                        src={asset.url}
                        alt=""
                        className="aspect-video w-full object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.published}
                  onChange={(e) =>
                    setEditing({ ...editing, published: e.target.checked })
                  }
                />{" "}
                Hiển thị trên portfolio
              </label>
              <div className="flex gap-2">
                <button
                  disabled={!!busyAction}
                  onClick={() => setEditing(null)}
                  className="rounded-xl border px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Huỷ
                </button>
                <button
                  disabled={loading || !!busyAction}
                  onClick={save}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {loading ? "Đang lưu…" : "Lưu nội dung"}
                </button>
              </div>
            </div>
            {message && (
              <p className="mt-3 text-sm text-slate-600">{message}</p>
            )}
          </section>
        ) : (
          <section className="mt-6 grid gap-3">
            {list.map((item, index) => {
              const isProject = tab === "projects";
              const project = isProject && "slug" in item ? item : null;
              const featuredItem = !isProject && "topic" in item ? item : null;
              const cover = isProject
                ? project?.cardImage ?? project?.media.find((asset) => asset.resourceType === "image") ?? project?.media.find((asset) => asset.resourceType === "video")
                : featuredItem?.media.find((asset) => asset.resourceType === "image") ?? featuredItem?.media.find((asset) => asset.resourceType === "video");
              const mediaCount = item.media.length;
              const displayIndex = sourceList.findIndex((source) => source.id === item.id);
              const editingItem = () => {
                const x = item as FeaturedContent | ProjectContent;
                setEditing({
                  kind: tab,
                  id: x.id,
                  title: x.title,
                  label: x.label,
                  topic: "topic" in x ? x.topic : undefined,
                  slug: "slug" in x ? x.slug : undefined,
                  category: "category" in x ? x.category : undefined,
                  clientName: "clientName" in x ? x.clientName : undefined,
                  projectRole: "projectRole" in x ? x.projectRole : undefined,
                  projectPeriod: "projectPeriod" in x ? x.projectPeriod : undefined,
                  externalUrl: "externalUrl" in x ? x.externalUrl : undefined,
                  eyebrow: "eyebrow" in x ? x.eyebrow : undefined,
                  subtitle: "subtitle" in x ? x.subtitle : undefined,
                  excerpt: x.excerpt,
                  tags: "tags" in x ? x.tags : undefined,
                  content: x.content,
                  contentHtml: x.contentHtml,
                  media: x.media,
                  cardImage: "cardImage" in x ? x.cardImage ?? x.media.find((asset) => asset.resourceType === "image") ?? x.media.find((asset) => asset.resourceType === "video") ?? null : x.media.find((asset) => asset.resourceType === "image") ?? x.media.find((asset) => asset.resourceType === "video") ?? null,
                  published: x.published,
                  sortOrder: x.sortOrder,
                });
              };
              return (
                <article
                  key={item.id}
                  onDragOver={(event) => {
                    if (draggingId && draggingId !== item.id) event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    void handleDrop(item.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  className={cn(
                    "group overflow-hidden rounded-2xl border bg-white shadow-sm transition",
                    draggingId === item.id ? "border-blue-400 opacity-60 ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-300 hover:shadow-md",
                  )}
                >
                  <div className="flex min-h-[112px] items-stretch">
                    <div className="flex w-14 shrink-0 items-center justify-center border-r border-slate-100 bg-slate-50">
                      <button
                        type="button"
                        draggable
                        disabled={!!busyAction || !!search.trim() || statusFilter !== "all"}
                        onDragStart={(event) => {
                          handleDragStart(item.id);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", item.id);
                          const card = event.currentTarget.closest("article");
                          if (card) event.dataTransfer.setDragImage(card, 24, 24);
                        }}
                        title={search.trim() || statusFilter !== "all" ? "Clear search/filter to drag" : "Drag to reorder"}
                        className="cursor-grab rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700 active:cursor-grabbing disabled:cursor-not-allowed"
                      >
                        <GripVertical className="size-5" />
                      </button>
                    </div>
                    <div className="flex w-16 shrink-0 items-center justify-center border-r border-slate-100 text-lg font-bold text-slate-300">
                      {String(displayIndex + 1).padStart(2, "0")}
                    </div>
                    <div className="hidden w-28 shrink-0 items-center justify-center border-r border-slate-100 bg-slate-50 sm:flex">
                      <ListMediaPreview asset={cover} />
                    </div>
                    <div
                      className="min-w-0 flex-1 cursor-pointer p-4 transition-colors hover:bg-slate-50/70"
                      onClick={() => {
                        const x = item as FeaturedContent | ProjectContent;
                        setListPreview({
                          kind: tab, id: x.id, title: x.title, label: x.label,
                          topic: "topic" in x ? x.topic : undefined,
                          slug: "slug" in x ? x.slug : undefined,
                          category: "category" in x ? x.category : undefined,
                          clientName: "clientName" in x ? x.clientName : undefined,
                          projectRole: "projectRole" in x ? x.projectRole : undefined,
                          projectPeriod: "projectPeriod" in x ? x.projectPeriod : undefined,
                          externalUrl: "externalUrl" in x ? x.externalUrl : undefined,
                          eyebrow: "eyebrow" in x ? x.eyebrow : undefined,
                          subtitle: "subtitle" in x ? x.subtitle : undefined,
                          excerpt: x.excerpt, tags: "tags" in x ? x.tags : undefined,
                          content: x.content, contentHtml: x.contentHtml, media: x.media,
                          cardImage: "cardImage" in x ? x.cardImage ?? null : null,
                          published: x.published, sortOrder: x.sortOrder,
                        });
                      }}
                      title="Click để xem preview"
                    >
                      <div className="flex flex-wrap items-start gap-2">
                        <span className={cn("mt-1 size-2 shrink-0 rounded-full", item.published ? "bg-emerald-500" : "bg-slate-300")} title={item.published ? "Published" : "Draft"} />
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-bold text-slate-900">{item.title || "Untitled"}</h3>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {isProject ? project?.eyebrow || project?.slug : featuredItem?.topic}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <Badge variant={item.published ? "success" : "secondary"}>{item.published ? "Published" : "Draft"}</Badge>
                        {isProject && project && (
                          <Badge variant={project.category === "professional" ? "blue" : "secondary"}>
                            {project.category === "professional" ? "Professional Project" : "Personal Project"}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="inline-flex items-center gap-1"><ImageIcon className="size-3" /> {mediaCount} media</Badge>
                        {isProject && project?.tags.slice(0, 3).map((tag) => <Badge key={tag} variant="blue">{tag}</Badge>)}
                        {isProject && project && project.tags.length > 3 && <Badge variant="secondary">+{project.tags.length - 3}</Badge>}
                        <span className="hidden md:inline">Updated {new Date(item.updatedAt).toLocaleDateString("vi-VN")}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 p-3">
                      <Button variant="outline" size="sm" disabled={displayIndex === 0 || !!busyAction} onClick={() => moveTo(tab, item.id, 0)} title="Move to top"><ArrowUp className="size-4" /><span className="hidden lg:inline">Top</span></Button>
                      <Button variant="outline" size="sm" disabled={displayIndex === 0 || !!busyAction} onClick={() => move(tab, item.id, -1)} title="Move up"><ArrowUp className="size-4" /></Button>
                      <Button variant="outline" size="sm" disabled={displayIndex === sourceList.length - 1 || !!busyAction} onClick={() => move(tab, item.id, 1)} title="Move down"><ArrowDown className="size-4" /></Button>
                      <Button variant="outline" size="sm" disabled={displayIndex === sourceList.length - 1 || !!busyAction} onClick={() => moveTo(tab, item.id, sourceList.length - 1)} title="Move to bottom"><ArrowDown className="size-4" /><span className="hidden lg:inline">Bottom</span></Button>
                      <Button variant="outline" size="sm" onClick={editingItem} disabled={!!busyAction}><Pencil className="size-4" /><span className="hidden xl:inline">Edit</span></Button>
                      <Button variant="outline" size="sm" onClick={() => remove(tab, item.id)} disabled={!!busyAction} className="border-red-200 text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></Button>
                    </div>
                  </div>
                </article>
              );
            })}
            {!list.length && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <p className="font-semibold text-slate-700">{sourceList.length ? "Không tìm thấy nội dung phù hợp." : "Chưa có dữ liệu."}</p>
                <p className="mt-1 text-sm text-slate-500">{sourceList.length ? "Thử xoá tìm kiếm hoặc bộ lọc." : "Hãy bấm “Create New” để bắt đầu."}</p>
              </div>
            )}
          </section>
        )}
      </div>

      {listPreview && (
        <div
          className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/75 p-3 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${listPreview.title || "content"}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setListPreview(null);
          }}
        >
          <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-[#fffaf3] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-indigo-600">CMS Preview</p>
                <h2 className="truncate text-lg font-bold text-slate-900">{listPreview.title || "Untitled"}</h2>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => { setEditing(listPreview); setListPreview(null); }} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Edit</button>
                <button type="button" onClick={() => setListPreview(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Đóng</button>
              </div>
            </div>
            <div className="p-5 sm:p-10">
              <div className="mb-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-600">{listPreview.eyebrow || listPreview.label}</p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">{listPreview.title || "Untitled"}</h1>
                  {listPreview.subtitle && <p className="mt-2 text-lg text-slate-600">{listPreview.subtitle}</p>}
                  {listPreview.excerpt && <p className="mt-4 text-sm leading-7 text-slate-600">{listPreview.excerpt}</p>}
                  {!!listPreview.tags?.length && <div className="mt-4 flex flex-wrap gap-2">{listPreview.tags.map(tag => <span key={tag} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">#{tag}</span>)}</div>}
                </div>
                {previewMedia && <PreviewMedia asset={previewMedia} />}
              </div>

              {listPreview.kind === "projects" ? (
                <ProjectLayoutContent content={listPreview.content} />
              ) : (
                <div className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: listPreview.contentHtml || "<p>Chưa có nội dung.</p>" }} />
              )}

              {listPreview.kind === "projects" && listPreview.media.filter(asset => asset.id !== previewMedia?.id).length > 0 && (
                <div className="mt-10 border-t border-slate-200 pt-8">
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">Media gallery</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {listPreview.media
                      .filter(asset => asset.id !== previewMedia?.id)
                      .map(asset => <PreviewMedia key={asset.id} asset={asset} />)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <div className="[&_input]:mt-2 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-slate-200 [&_input]:px-3 [&_input]:py-2.5 [&_input]:font-normal [&_input]:outline-none [&_textarea]:mt-2 [&_textarea]:min-h-24 [&_textarea]:w-full [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-slate-200 [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:font-normal [&_textarea]:outline-none">
        {children}
      </div>
    </label>
  );
}

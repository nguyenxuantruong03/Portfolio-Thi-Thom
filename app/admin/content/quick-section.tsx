"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, EyeOff, ImageIcon, Pencil, Plus, Star, Trash2, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DesignGrid, DesignLightbox, type DesignProject } from "@/components/design-gallery";
import { uploadToCloudinary } from "./editor";
import { optimizedVideoUrl } from "@/lib/media";
import { canonicalizeCategories, categoryKey, collectCategories, type CategoryOption } from "@/lib/design-categories";
import { cn } from "@/lib/utils";
import type { MediaAsset, QuickItem, QuickSection } from "@/lib/content-types";

/**
 * Quick-add manager for the two sections that do NOT use the full project editor:
 *  - professional: a plain list with a one-form "thêm nhanh"
 *  - design2d: a preview of the public gallery, plus the admin-only "More" tile to add a project in place
 */

type Draft = {
  id: string;
  isNew: boolean;
  section: QuickSection;
  title: string;
  label: string;
  subtitle: string;
  excerpt: string;
  linkUrl: string;
  /** Raw comma separated text, parsed on save so typing a comma never gets swallowed. */
  tagsText: string;
  media: MediaAsset[];
  published: boolean;
};

const LABEL_SUGGESTIONS = ["Client Project", "Brand Project", "Content Production", "Video Editing"];
/** Browser-only memory of the categories used on the last saved 2D project. */
const LAST_CATEGORIES_KEY = "portfolio:design2d:last-categories";

function parseTags(text: string) {
  return text
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** `defaultTags` pre-selects design categories (2D section) so a batch of similar projects needs no re-picking. */
function emptyDraft(section: QuickSection, defaultTags: string[] = []): Draft {
  return {
    id: crypto.randomUUID(),
    isNew: true,
    section,
    title: "",
    label: section === "professional" ? "Client Project" : "",
    subtitle: "",
    excerpt: "",
    linkUrl: "",
    tagsText: defaultTags.join(", "),
    media: [],
    published: true,
  };
}

function draftFromItem(item: QuickItem): Draft {
  return {
    id: item.id,
    isNew: false,
    section: item.section,
    title: item.title,
    label: item.label,
    subtitle: item.subtitle,
    excerpt: item.excerpt ?? "",
    linkUrl: item.linkUrl ?? "",
    tagsText: item.tags.join(", "),
    media: item.media,
    published: item.published,
  };
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw new Error(`API trả về dữ liệu không hợp lệ (HTTP ${response.status}).`);
  }
}

function coverOf(item: { media: MediaAsset[] }) {
  return item.media.find((asset) => asset.resourceType === "image") ?? item.media.find((asset) => asset.resourceType === "video");
}

export function QuickSectionManager({ section, onUnauthorized }: { section: QuickSection; onUnauthorized: () => void }) {
  const [items, setItems] = useState<QuickItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const closePreview = useCallback(() => setPreviewIndex(null), []);

  const sectionItems = useMemo(() => items.filter((item) => item.section === section), [items, section]);

  /** Same shape as the public gallery, so the preview (and its next / prev viewer) matches the website. */
  const designProjects = useMemo<DesignProject[]>(
    () =>
      sectionItems.map((item) => ({
        id: item.id,
        title: item.title,
        tags: item.tags,
        images: item.media
          .filter((asset) => asset.resourceType === "image")
          .map((asset) => ({ src: asset.url, alt: item.title, width: asset.width, height: asset.height, format: asset.format })),
      })),
    [sectionItems],
  );

  /** Every design category already used, matched ignoring case / accents, so the form can offer them as a pick list. */
  const categories = useMemo(
    () => (section === "design2d" ? collectCategories(sectionItems.map((item) => item.tags)) : []),
    [section, sectionItems],
  );

  /** Categories that a new design project starts with: the ones used on the last save, else those of the newest project. */
  function defaultCategoryTags(): string[] {
    let remembered: string[] = [];
    try {
      const raw = window.localStorage.getItem(LAST_CATEGORIES_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) remembered = parsed.filter((tag): tag is string => typeof tag === "string");
    } catch {
      // Storage can be blocked; the fallback below still works.
    }
    const known = new Set(categories.map((category) => category.key));
    const fromMemory = canonicalizeCategories(remembered, categories).filter((tag) => known.has(categoryKey(tag)));
    if (fromMemory.length) return fromMemory;
    const newest = sectionItems[sectionItems.length - 1];
    return newest ? canonicalizeCategories(newest.tags, categories) : [];
  }

  function rememberCategories(tags: string[]) {
    try {
      window.localStorage.setItem(LAST_CATEGORIES_KEY, JSON.stringify(tags));
    } catch {
      // Not critical.
    }
  }

  /** Fetches every quick item. Returns null when the session expired. */
  const fetchItems = useCallback(async (): Promise<QuickItem[] | null> => {
    const response = await fetch("/api/admin/quick", { cache: "no-store", headers: { Accept: "application/json" } });
    if (response.status === 401) return null;
    const data = await readJson<{ items?: QuickItem[]; error?: string }>(response);
    if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
    return data.items ?? [];
  }, []);

  const reportLoadError = useCallback((error: unknown) => {
    toast.error("Không thể tải nội dung", {
      description: `${error instanceof Error ? error.message : "CONTENT_LOAD_FAILED"}. Nếu vừa cập nhật code, hãy chạy "npm run db:migrate".`,
    });
  }, []);

  /** Reload after a change. */
  const load = useCallback(async () => {
    try {
      const next = await fetchItems();
      if (next === null) onUnauthorized();
      else setItems(next);
    } catch (error) {
      reportLoadError(error);
    }
  }, [fetchItems, onUnauthorized, reportLoadError]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const next = await fetchItems();
        if (!active) return;
        if (next === null) onUnauthorized();
        else setItems(next);
      } catch (error) {
        if (active) reportLoadError(error);
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [fetchItems, onUnauthorized, reportLoadError]);

  async function request(method: "POST" | "PATCH" | "DELETE", body: unknown) {
    const response = await fetch("/api/admin/quick", {
      method,
      headers: { "content-type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (response.status === 401) {
      onUnauthorized();
      throw new Error("Phiên đăng nhập đã hết hạn.");
    }
    const data = await readJson<{ error?: string; details?: { formErrors?: string[]; fieldErrors?: Record<string, string[]> } }>(response);
    if (!response.ok) {
      const details = data.details
        ? [...(data.details.formErrors ?? []), ...Object.entries(data.details.fieldErrors ?? {}).flatMap(([field, errors]) => errors.map((e) => `${field}: ${e}`))]
        : [];
      throw new Error([data.error ?? `HTTP ${response.status}`, ...details].join(" — "));
    }
  }

  async function save() {
    if (!draft || busy || !loaded) return;
    if (!draft.title.trim()) {
      toast.error("Thiếu tiêu đề", { description: "Hãy nhập tên dự án." });
      return;
    }
    setBusy("save");
    try {
      const fields = {
        title: draft.title.trim(),
        label: draft.label.trim(),
        subtitle: draft.subtitle.trim(),
        excerpt: draft.excerpt.trim(),
        linkUrl: draft.linkUrl.trim(),
        // Design categories are mapped to the spelling that already exists, so near-duplicates never split a category.
        tags: draft.section === "design2d" ? canonicalizeCategories(parseTags(draft.tagsText), categories) : parseTags(draft.tagsText),
        media: draft.media,
        published: draft.published,
      };
      if (draft.isNew) {
        await request("POST", { item: { id: draft.id, section: draft.section, ...fields } });
      } else {
        await request("PATCH", { type: "update", id: draft.id, patch: fields });
      }
      if (draft.section === "design2d") rememberCategories(fields.tags);
      toast.success(draft.isNew ? "Đã thêm dự án" : "Đã lưu thay đổi");
      setDraft(null);
      await load();
    } catch (error) {
      toast.error("Lưu thất bại", { description: error instanceof Error ? error.message : "UPDATE_FAILED" });
    } finally {
      setBusy(null);
    }
  }

  async function remove(item: QuickItem) {
    if (busy || !loaded || !window.confirm(`Xoá "${item.title}"?`)) return;
    setBusy(`delete:${item.id}`);
    try {
      await request("DELETE", { id: item.id });
      toast.success("Đã xoá");
      await load();
    } catch (error) {
      toast.error("Xoá thất bại", { description: error instanceof Error ? error.message : "DELETE_FAILED" });
    } finally {
      setBusy(null);
    }
  }

  async function move(id: string, direction: -1 | 1) {
    if (busy || !loaded) return;
    const ids = sectionItems.map((item) => item.id);
    const from = ids.indexOf(id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    const previous = items;
    const reordered = ids.map((itemId) => sectionItems.find((item) => item.id === itemId)!);
    setItems([...items.filter((item) => item.section !== section), ...reordered]);
    setBusy("reorder");
    try {
      await request("PATCH", { type: "reorder", section, ids });
    } catch (error) {
      setItems(previous);
      toast.error("Không thể đổi thứ tự", { description: error instanceof Error ? error.message : "UPDATE_FAILED" });
    } finally {
      setBusy(null);
    }
  }

  async function togglePublished(item: QuickItem) {
    if (busy || !loaded) return;
    setBusy(`publish:${item.id}`);
    try {
      await request("PATCH", { type: "update", id: item.id, patch: { published: !item.published } });
      toast.success(item.published ? "Đã ẩn khỏi website" : "Đã hiển thị trên website");
      await load();
    } catch (error) {
      toast.error("Không thể cập nhật", { description: error instanceof Error ? error.message : "UPDATE_FAILED" });
    } finally {
      setBusy(null);
    }
  }

  const sectionTitle = section === "professional" ? "Professional Projects" : "2D Graphic Design";
  // Until the list has loaded, adding / editing / deleting / reordering stays locked.
  const disabled = !loaded || !!busy || !!draft;

  return (
    <section className="mt-6" aria-busy={!loaded}>
      {!loaded && (
        <p role="status" aria-live="polite" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Đang tải dữ liệu… các nút thêm, sửa, xoá đang tạm khoá để tránh thao tác khi dữ liệu chưa về.
        </p>
      )}
      {section === "professional" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-800">Thêm nhanh</span> — chỉ cần tên dự án và hình ảnh. Mục này không có trang chi tiết riêng; có thể gắn link ngoài (không bắt buộc).
            </p>
            <Button size="sm" disabled={disabled} onClick={() => setDraft(emptyDraft(section))}>
              <Plus className="size-4" /> Thêm nhanh
            </Button>
          </div>

          <div className="mt-4 grid gap-3">
            {sectionItems.map((item, index) => {
              const cover = coverOf(item);
              return (
                <article key={item.id} className="flex items-stretch overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex w-12 shrink-0 items-center justify-center border-r border-slate-100 text-lg font-bold text-slate-300">{String(index + 1).padStart(2, "0")}</div>
                  <div className="hidden w-28 shrink-0 items-center justify-center border-r border-slate-100 bg-slate-50 p-2 sm:flex">
                    <Thumb asset={cover} />
                  </div>
                  <div className="min-w-0 flex-1 p-4">
                    <div className="flex items-start gap-2">
                      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.published ? "bg-emerald-500" : "bg-slate-300")} />
                      <div className="min-w-0">
                        <h3 className="truncate font-bold text-slate-900">{item.title}</h3>
                        <p className="truncate text-xs text-slate-500">{[item.label, item.subtitle].filter(Boolean).join(" · ") || "—"}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant={item.published ? "success" : "secondary"}>{item.published ? "Published" : "Đã ẩn"}</Badge>
                      <Badge variant="secondary" className="inline-flex items-center gap-1"><ImageIcon className="size-3" /> {item.media.length} media</Badge>
                      {item.tags.slice(0, 3).map((tag) => <Badge key={tag} variant="blue">{tag}</Badge>)}
                      {item.linkUrl && <Badge variant="outline">Có link</Badge>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 p-3">
                    <Button variant="outline" size="sm" disabled={disabled || index === 0} onClick={() => move(item.id, -1)} title="Lên"><ArrowUp className="size-4" /></Button>
                    <Button variant="outline" size="sm" disabled={disabled || index === sectionItems.length - 1} onClick={() => move(item.id, 1)} title="Xuống"><ArrowDown className="size-4" /></Button>
                    <Button variant="outline" size="sm" disabled={disabled} onClick={() => setDraft(draftFromItem(item))} title="Sửa"><Pencil className="size-4" /></Button>
                    <Button variant="outline" size="sm" disabled={disabled} onClick={() => remove(item)} className="border-red-200 text-red-600 hover:bg-red-50" title="Xoá"><Trash2 className="size-4" /></Button>
                  </div>
                </article>
              );
            })}
            {loaded && !sectionItems.length && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <p className="font-semibold text-slate-700">Chưa có dự án chuyên nghiệp nào.</p>
                <p className="mt-1 text-sm text-slate-500">Bấm “Thêm nhanh” để tạo dự án đầu tiên.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-900">
            <p>
              <span className="font-semibold">Xem trước trang chủ.</span> Đây là giao diện người xem sẽ thấy. Ô <span className="font-semibold">“More Creative Works”</span> ở cuối chỉ hiện trong CMS để bạn bấm thêm dự án mới — không hiện trên website.
            </p>
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-indigo-700">Admin only</span>
          </div>

          <div className="mt-5">
            <DesignGrid
              projects={designProjects}
              onOpen={setPreviewIndex}
              renderOverlay={(project, index) => {
                const item = sectionItems[index];
                if (!item) return null;
                return (
                  <>
                    {!item.published && (
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-slate-900/85 px-2.5 py-1 text-[11px] font-semibold text-white">
                        <EyeOff className="size-3" /> Đã ẩn
                      </span>
                    )}
                    <div className="absolute right-2 top-2 flex gap-1 opacity-100 transition focus-within:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      <OverlayButton label="Chuyển sang trái" disabled={disabled || index === 0} onClick={() => move(item.id, -1)}><ArrowLeft className="size-4" /></OverlayButton>
                      <OverlayButton label="Chuyển sang phải" disabled={disabled || index === sectionItems.length - 1} onClick={() => move(item.id, 1)}><ArrowRight className="size-4" /></OverlayButton>
                      <OverlayButton label={item.published ? "Ẩn khỏi website" : "Hiện trên website"} disabled={disabled} onClick={() => togglePublished(item)}><EyeOff className="size-4" /></OverlayButton>
                      <OverlayButton label={`Sửa ${project.title}`} disabled={disabled} onClick={() => setDraft(draftFromItem(item))}><Pencil className="size-4" /></OverlayButton>
                      <OverlayButton label={`Xoá ${project.title}`} disabled={disabled} onClick={() => remove(item)} danger><Trash2 className="size-4" /></OverlayButton>
                    </div>
                  </>
                );
              }}
              trailing={
                <div>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setDraft(emptyDraft(section, defaultCategoryTags()))}
                    className="grid aspect-[4/3] w-full place-items-center rounded-[18px] border-2 border-dashed border-[#17215f]/20 bg-[#fbf9f5] text-[#17215f]/50 transition hover:border-[#3548e6]/50 hover:bg-white hover:text-[#3548e6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#3548e6]/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="flex flex-col items-center gap-1.5 text-sm font-medium">
                      <Plus className="size-7" />
                      Future Projects
                    </span>
                  </button>
                  <p className="mt-3 text-[15px] font-bold leading-snug text-[#17215f]">
                    {String(sectionItems.length + 1).padStart(2, "0")}. More Creative Works
                  </p>
                  <p className="mt-0.5 text-xs text-[#17215f]/55">New design projects · bấm để thêm (chỉ admin thấy)</p>
                </div>
              }
            />
          </div>
          <DesignLightbox projects={designProjects} startIndex={previewIndex} onClose={closePreview} />
        </>
      )}

      {draft && <QuickForm draft={draft} setDraft={setDraft} busy={busy} onSave={save} sectionTitle={sectionTitle} categories={categories} />}
    </section>
  );
}

function OverlayButton({ children, label, onClick, disabled, danger }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-full bg-white/95 text-slate-700 shadow-md transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40",
        danger && "text-red-600 hover:bg-red-50",
      )}
    >
      {children}
    </button>
  );
}

function Thumb({ asset }: { asset?: MediaAsset }) {
  if (!asset) {
    return <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-300"><ImageIcon className="size-5" /></div>;
  }
  if (asset.resourceType === "video") {
    return (
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-slate-200">
        <video src={optimizedVideoUrl(asset.url)} muted playsInline preload="metadata" className="h-full w-full object-cover" aria-label={asset.alt ?? "Video"} />
        <span className="absolute bottom-1 right-1 rounded bg-black/65 p-0.5 text-white"><Video className="size-3" /></span>
      </div>
    );
  }
  return <img src={asset.url} alt={asset.alt ?? ""} loading="lazy" className="aspect-[4/3] w-full rounded-lg object-cover" />;
}

function QuickForm({ draft, setDraft, busy, onSave, sectionTitle, categories }: { draft: Draft; setDraft: Dispatch<SetStateAction<Draft | null>>; busy: string | null; onSave: () => void; sectionTitle: string; categories: CategoryOption[] }) {
  const [uploading, setUploading] = useState(false);
  const isDesign = draft.section === "design2d";
  const locked = !!busy || uploading;

  function patch(partial: Partial<Draft>) {
    setDraft((current) => (current ? { ...current, ...partial } : current));
  }

  async function upload(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    const failed: string[] = [];
    for (const file of files) {
      try {
        const asset = await uploadToCloudinary(file);
        // Show each picture as soon as it is uploaded (functional update keeps text typed meanwhile).
        setDraft((current) => (current ? { ...current, media: [...current.media, asset] } : current));
      } catch (error) {
        failed.push(`${file.name}: ${error instanceof Error ? error.message : "Upload thất bại"}`);
      }
    }
    setUploading(false);
    if (failed.length) toast.error("Một số file chưa upload được", { description: failed.join(" | ") });
    else toast.success(`Đã upload ${files.length} file`);
  }

  function makeCover(id: string) {
    setDraft((current) => {
      const picked = current?.media.find((asset) => asset.id === id);
      return current && picked ? { ...current, media: [picked, ...current.media.filter((asset) => asset.id !== id)] } : current;
    });
  }

  const hasImage = draft.media.some((asset) => asset.resourceType === "image");

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-8" role="dialog" aria-modal="true" aria-label={draft.isNew ? "Thêm nhanh" : "Sửa dự án"}>
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-blue-600">{sectionTitle}</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">{draft.isNew ? "Thêm nhanh" : "Sửa dự án"}</h2>
          </div>
          <button type="button" disabled={locked} onClick={() => setDraft(null)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Đóng</button>
        </div>

        <div className="mt-5 grid gap-4">
          <Field label="Tên dự án *">
            <input autoFocus value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder={isDesign ? "VD: Bánh Tráng Menu Design" : "VD: Video giới thiệu phòng khám"} />
          </Field>

          {isDesign ? (
            <CategoryPicker
              categories={categories}
              selected={parseTags(draft.tagsText)}
              disabled={locked}
              isNew={draft.isNew}
              onChange={(next) => patch({ tagsText: next.join(", ") })}
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nhãn (khách hàng / loại)">
                  <input list="quick-label-suggestions" value={draft.label} onChange={(e) => patch({ label: e.target.value })} />
                  <datalist id="quick-label-suggestions">{LABEL_SUGGESTIONS.map((label) => <option key={label} value={label} />)}</datalist>
                </Field>
                <Field label="Tags (cách nhau bằng dấu phẩy)">
                  <input value={draft.tagsText} onChange={(e) => patch({ tagsText: e.target.value })} placeholder="TikTok, Video" />
                </Field>
              </div>
              <Field label="Mô tả ngắn">
                <textarea value={draft.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} placeholder="Một dòng giới thiệu hiện trên thẻ dự án" />
              </Field>
              <Field label="Link ngoài (không bắt buộc)">
                <input type="url" value={draft.linkUrl} onChange={(e) => patch({ linkUrl: e.target.value })} placeholder="https://…" />
                <Hint>Nếu có link, nút “Xem” trên thẻ sẽ mở link này ở tab mới.</Hint>
              </Field>
            </>
          )}

          <div className="rounded-2xl border border-dashed border-slate-300 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">{isDesign ? "Hình ảnh" : "Hình ảnh / video"}</p>
                <p className="text-xs text-slate-500">
                  {isDesign ? "Có thể chọn nhiều ảnh cùng lúc. Ảnh đầu tiên là ảnh bìa; bấm vào dự án trên website sẽ xem được tất cả ảnh." : "Ảnh hoặc video đầu tiên là phần hiển thị trên thẻ."}
                </p>
              </div>
              <label className={cn("rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white", locked ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
                {uploading ? "Đang upload…" : "+ Thêm ảnh"}
                <input
                  type="file"
                  multiple
                  accept={isDesign ? "image/*" : "image/*,video/*"}
                  disabled={locked}
                  className="hidden"
                  onChange={(e) => {
                    const input = e.currentTarget;
                    const files = Array.from(input.files ?? []);
                    input.value = "";
                    void upload(files);
                  }}
                />
              </label>
            </div>
            {!!draft.media.length && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {draft.media.map((asset, index) => (
                  <div key={asset.id} className="group relative overflow-hidden rounded-xl border bg-slate-50">
                    <Thumb asset={asset} />
                    {index === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">Ảnh bìa</span>}
                    <div className="absolute right-1.5 top-1.5 flex gap-1">
                      {index !== 0 && (
                        <button type="button" disabled={locked} title="Đặt làm ảnh bìa" aria-label="Đặt làm ảnh bìa" onClick={() => makeCover(asset.id)} className="grid size-7 place-items-center rounded-full bg-white shadow disabled:opacity-40"><Star className="size-3.5" /></button>
                      )}
                      <button type="button" disabled={locked} title="Xoá ảnh" aria-label="Xoá ảnh" onClick={() => setDraft((current) => (current ? { ...current, media: current.media.filter((x) => x.id !== asset.id) } : current))} className="grid size-7 place-items-center rounded-full bg-white shadow disabled:opacity-40"><X className="size-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {isDesign && !hasImage && <p className="mt-3 text-xs text-amber-600">Dự án cần ít nhất 1 ảnh mới hiện trên website.</p>}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.published} onChange={(e) => patch({ published: e.target.checked })} /> Hiển thị trên portfolio
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={locked} onClick={() => setDraft(null)} className="rounded-xl border px-4 py-2.5 text-sm disabled:opacity-40">Huỷ</button>
            <button type="button" disabled={locked} onClick={onSave} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {busy === "save" ? "Đang lưu…" : draft.isNew ? "Thêm" : "Lưu"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Pick design categories from the ones already in use, or create a new one.
 * Because similar projects pick the same chip, they always end up in the same category
 * (a new name that only differs in case / accents is mapped to the existing one).
 */
function CategoryPicker({ categories, selected, disabled, isNew, onChange }: { categories: CategoryOption[]; selected: string[]; disabled: boolean; isNew: boolean; onChange: (next: string[]) => void }) {
  const [newName, setNewName] = useState("");
  const selectedKeys = new Set(selected.map(categoryKey));
  // Existing categories first, then any category created in this form that is not saved yet.
  const options = [
    ...categories.map((category) => category.name),
    ...selected.filter((tag) => !categories.some((category) => category.key === categoryKey(tag))),
  ];

  function toggle(name: string) {
    const key = categoryKey(name);
    onChange(selectedKeys.has(key) ? selected.filter((tag) => categoryKey(tag) !== key) : [...selected, name]);
  }

  function addNew() {
    const name = newName.trim().replace(/\s+/g, " ");
    if (!name) return;
    const existing = options.find((option) => categoryKey(option) === categoryKey(name));
    if (existing) {
      if (!selectedKeys.has(categoryKey(existing))) onChange([...selected, existing]);
      toast.info(`Loại “${existing}” đã có`, { description: "Đã chọn loại có sẵn thay vì tạo trùng." });
    } else {
      onChange([...selected, name]);
    }
    setNewName("");
  }

  return (
    <div className="block text-sm font-semibold text-slate-700">
      <p>Loại thiết kế</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((name) => {
          const on = selectedKeys.has(categoryKey(name));
          return (
            <button
              key={categoryKey(name)}
              type="button"
              disabled={disabled}
              aria-pressed={on}
              onClick={() => toggle(name)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
                on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600",
              )}
            >
              {name}
            </button>
          );
        })}
        {!options.length && <span className="text-xs font-normal text-slate-500">Chưa có loại nào — nhập tên bên dưới để tạo loại đầu tiên.</span>}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={newName}
          disabled={disabled}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addNew();
            }
          }}
          placeholder="Loại mới, VD: Menu Design"
          className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-blue-400"
        />
        <button type="button" disabled={disabled || !newName.trim()} onClick={addNew} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-600 disabled:opacity-40">
          <Plus className="size-3.5" /> Tạo loại mới
        </button>
      </div>
      <Hint>
        {isNew ? "Đã chọn sẵn loại của dự án trước — nếu dự án này khác, bỏ chọn và chọn loại khác hoặc tạo loại mới. " : ""}
        Dự án giống nhau nên chọn cùng một loại có sẵn để luôn nằm chung nhóm. Có thể chọn nhiều loại.
      </Hint>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs font-normal text-slate-500">{children}</p>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <div className="[&_input]:mt-2 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-slate-200 [&_input]:px-3 [&_input]:py-2.5 [&_input]:font-normal [&_input]:outline-none [&_input:focus]:border-blue-400 [&_textarea]:mt-2 [&_textarea]:min-h-20 [&_textarea]:w-full [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-slate-200 [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:font-normal [&_textarea]:outline-none [&_textarea:focus]:border-blue-400">
        {children}
      </div>
    </label>
  );
}

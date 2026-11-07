"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ImageIcon, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { categoryKey, collectCategories } from "@/lib/design-categories";
import { optimizedImageSrcSet, optimizedImageUrl } from "@/lib/media";

/** Image metadata is kept out of the public viewer; only the visual asset is shown. */
export type DesignImage = { src: string; alt: string };

/** One 2D design project: a cover (first image), a title, categories and the images shown in the lightbox. */
export type DesignProject = {
  id: string;
  title: string;
  tags: string[];
  images: DesignImage[];
};

type GridProps = {
  projects: DesignProject[];
  onOpen: (projectIndex: number) => void;
  /** Extra controls drawn on top of a card (used by the CMS preview). */
  renderOverlay?: (project: DesignProject, index: number) => ReactNode;
  /** Extra tile after the last card (the CMS-only "More" tile). */
  trailing?: ReactNode;
};

/**
 * The card grid. Shared by the public site and the CMS preview so both always look the same.
 * Columns are "auto-fill": a card keeps the same size whether there are 2 or 100 projects,
 * so a few projects no longer stretch across the whole row.
 */
export function DesignGrid({ projects, onOpen, renderOverlay, trailing }: GridProps) {
  const { t } = useLang();
  // The CMS draws five small control buttons on each card, so it needs wider cards than the public site.
  const columns = renderOverlay
    ? "grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]"
    : "grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]";

  return (
    <div className={`grid gap-2.5 sm:gap-3 ${columns}`}>
      {projects.map((project, index) => {
        const cover = project.images[0];
        return (
          <div key={project.id} className="group relative">
            <button
              type="button"
              onClick={() => cover && onOpen(index)}
              disabled={!cover}
              aria-label={project.title}
              className="relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded-[18px] bg-[#f4ebdd] text-left shadow-[0_6px_20px_rgba(31,43,92,.07)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(31,43,92,.14)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#3548e6]/40 disabled:cursor-default"
            >
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={optimizedImageUrl(cover.src, 600)}
                  srcSet={optimizedImageSrcSet(cover.src, [360, 600, 900])}
                  sizes="(max-width: 640px) 46vw, 240px"
                  alt={cover.alt}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                />
              ) : (
                <span className="grid h-full w-full place-items-center text-[#17215f]/30"><ImageIcon size={26} /></span>
              )}

              {/* Title sits on the picture, so the card needs no extra text rows underneath. */}
              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0b1236]/80 via-[#0b1236]/35 to-transparent px-3 pb-2.5 pt-8">
                <span className="block truncate text-[13px] font-bold leading-snug text-white">{project.title}</span>
                {!!project.tags.length && <span className="mt-0.5 block truncate text-[10px] font-medium text-white/75">{project.tags.join(" · ")}</span>}
                {!cover && <span className="mt-0.5 block truncate text-[10px] text-white/70">{t("design2d.noImage")}</span>}
              </span>

              {project.images.length > 1 && (
                <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-[#17215f] shadow">
                  <ImageIcon size={11} /> {project.images.length}
                </span>
              )}
            </button>
            {renderOverlay?.(project, index)}
          </div>
        );
      })}
      {trailing}
    </div>
  );
}

type Slide = { project: DesignProject; index: number };
type Position = { slide: number; image: number };

/**
 * Moves one image forward / back. At the end of a project it continues with the next project,
 * so a visitor can click through the whole list without closing the viewer.
 */
function stepPosition(slides: Slide[], from: Position, direction: 1 | -1): Position {
  const total = slides.length;
  if (!total) return from;
  const slide = Math.min(from.slide, total - 1);
  const count = slides[slide].project.images.length;
  const next = Math.min(from.image, count - 1) + direction;
  if (next >= 0 && next < count) return { slide, image: next };
  const nextSlide = (slide + direction + total) % total;
  return { slide: nextSlide, image: direction > 0 ? 0 : slides[nextSlide].project.images.length - 1 };
}

type LightboxProps = {
  /** The whole list the visitor can move through (not just the clicked project). */
  projects: DesignProject[];
  /** Index in `projects` of the project that was clicked, or null while closed. */
  startIndex: number | null;
  onClose: () => void;
};

/**
 * Full screen viewer. Left / right moves through every image of every project, and an info panel
 * shows the project name, categories and image details, so nothing needs closing to find them out.
 */
export function DesignLightbox({ projects, startIndex, onClose }: LightboxProps) {
  if (startIndex === null) return null;
  return <LightboxView projects={projects} startIndex={startIndex} onClose={onClose} />;
}

function LightboxView({ projects, startIndex, onClose }: { projects: DesignProject[]; startIndex: number; onClose: () => void }) {
  const { t } = useLang();
  // Projects without a picture cannot be shown, so they are skipped.
  const slides = useMemo<Slide[]>(
    () => projects.map((project, index) => ({ project, index })).filter(({ project }) => project.images.length > 0),
    [projects],
  );
  const [position, setPosition] = useState<Position>(() => ({ slide: Math.max(0, slides.findIndex((slide) => slide.index === startIndex)), image: 0 }));
  const touchStartX = useRef<number | null>(null);

  const step = useCallback((direction: 1 | -1) => setPosition((value) => stepPosition(slides, value, direction)), [slides]);
  const jumpProject = useCallback(
    (direction: 1 | -1) =>
      setPosition((value) => {
        if (!slides.length) return value;
        const slide = Math.min(value.slide, slides.length - 1);
        return { slide: (slide + direction + slides.length) % slides.length, image: 0 };
      }),
    [slides],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") step(1);
      else if (event.key === "ArrowLeft") step(-1);
      else if (event.key === "ArrowDown") { event.preventDefault(); jumpProject(1); }
      else if (event.key === "ArrowUp") { event.preventDefault(); jumpProject(-1); }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [step, jumpProject, onClose]);

  const slideIndex = Math.min(position.slide, slides.length - 1);
  const current = slides[slideIndex];
  const images = current?.project.images ?? [];
  const imageIndex = Math.min(position.image, images.length - 1);
  const image = images[imageIndex];

  // Load the neighbouring pictures in advance so next / prev feels instant, even with 100 items.
  useEffect(() => {
    if (!slides.length) return;
    for (const direction of [1, -1] as const) {
      const target = stepPosition(slides, position, direction);
      const src = slides[target.slide]?.project.images[target.image]?.src;
      if (src) new window.Image().src = optimizedImageUrl(src, 1800);
    }
  }, [slides, position]);

  if (!current || !image) return null;
  const { project } = current;
  const totalImages = slides.reduce((sum, slide) => sum + slide.project.images.length, 0);
  const hasMany = totalImages > 1;
  const arrow = "absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-[#17215f] shadow-xl transition hover:scale-105";

  return (
    <div role="dialog" aria-modal="true" aria-label={project.title} className="fixed inset-0 z-[100] flex flex-col bg-[#07102c]/95 lg:flex-row">
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center p-3 sm:p-6 lg:p-8"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
        onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
        onTouchEnd={(event) => {
          const start = touchStartX.current;
          touchStartX.current = null;
          const end = event.changedTouches[0]?.clientX;
          if (start === null || end === undefined || Math.abs(end - start) < 50) return;
          step(end < start ? 1 : -1);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={optimizedImageUrl(image.src, 1800)} alt={image.alt} decoding="async" draggable={false} className="max-h-full max-w-full select-none rounded-xl object-contain shadow-2xl" />
        <button type="button" onClick={onClose} aria-label={t("design2d.close")} className="absolute right-3 top-3 grid size-11 place-items-center rounded-full bg-white text-[#17215f] shadow-xl transition hover:scale-105 sm:right-5 sm:top-5">
          <X size={20} />
        </button>
        {hasMany && (
          <>
            <button type="button" onClick={() => step(-1)} aria-label={t("design2d.prev")} className={`${arrow} left-3 sm:left-5`}><ChevronLeft size={20} /></button>
            <button type="button" onClick={() => step(1)} aria-label={t("design2d.next")} className={`${arrow} right-3 sm:right-5`}><ChevronRight size={20} /></button>
          </>
        )}
      </div>

      <aside className="max-h-[40vh] shrink-0 overflow-y-auto bg-white p-5 lg:max-h-none lg:w-[340px] lg:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#3548e6]">
          {t("design2d.project")} {slideIndex + 1} / {slides.length}
        </p>
        <h2 className="mt-1.5 text-xl font-extrabold leading-snug text-[#17215f]">{project.title}</h2>

        <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-[#17215f]/50">{t("design2d.categories")}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {project.tags.length ? (
            project.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-[#eef0ff] px-2.5 py-1 text-[11px] font-semibold text-[#3548e6]">{tag}</span>
            ))
          ) : (
            <span className="text-xs text-[#17215f]/45">{t("design2d.uncategorized")}</span>
          )}
        </div>



        {images.length > 1 && (
          <div className="mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#17215f]/50">{t("design2d.thumbs")}</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {images.map((item, index) => (
                <button
                  key={`${item.src}-${index}`}
                  type="button"
                  onClick={() => setPosition({ slide: slideIndex, image: index })}
                  aria-label={`${t("design2d.image")} ${index + 1}`}
                  aria-current={index === imageIndex}
                  className={`aspect-square overflow-hidden rounded-lg border-2 transition ${index === imageIndex ? "border-[#3548e6]" : "border-transparent opacity-70 hover:opacity-100"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={optimizedImageUrl(item.src, 160)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {slides.length > 1 && (
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => jumpProject(-1)} className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#17215f]/15 px-3 py-2 text-xs font-bold text-[#17215f] transition hover:border-[#3548e6]/40 hover:text-[#3548e6]">
              <ChevronLeft size={14} /> {t("design2d.prevProject")}
            </button>
            <button type="button" onClick={() => jumpProject(1)} className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#17215f]/15 px-3 py-2 text-xs font-bold text-[#17215f] transition hover:border-[#3548e6]/40 hover:text-[#3548e6]">
              {t("design2d.nextProject")} <ChevronRight size={14} />
            </button>
          </div>
        )}

        <p className="mt-4 hidden text-[11px] text-[#17215f]/40 lg:block">← → · ↑ ↓ · Esc</p>
      </aside>
    </div>
  );
}

const INITIAL_VISIBLE = 12;
const MAX_FILTERS = 20;

/**
 * Public 2D Graphic Design section. The CMS-only "More" tile is deliberately not part of it.
 * No white box around the grid: with only a few projects a full-width white panel looked empty.
 * Categories are matched case/accent-insensitively, so "Menu Design" and "menu design" are one filter.
 */
export function DesignGallery({ projects }: { projects: DesignProject[] }) {
  const { t } = useLang();
  const [active, setActive] = useState<number | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const close = useCallback(() => setActive(null), []);

  const categories = useMemo(() => collectCategories(projects.map((project) => project.tags)).slice(0, MAX_FILTERS), [projects]);

  const filtered = useMemo(
    () => (filter ? projects.filter((project) => project.tags.some((tag) => categoryKey(tag) === filter)) : projects),
    [projects, filter],
  );
  const visible = expanded ? filtered : filtered.slice(0, INITIAL_VISIBLE);
  const hiddenCount = filtered.length - visible.length;

  if (!projects.length) {
    return <p className="mt-8 rounded-[24px] border border-dashed border-[#17215f]/15 bg-white/60 px-6 py-12 text-center text-sm text-[#17215f]/55">{t("design2d.empty")}</p>;
  }

  const chip = (selected: boolean) =>
    `shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${selected ? "border-[#17215f] bg-[#17215f] text-white" : "border-[#17215f]/12 bg-white text-[#17215f]/70 hover:border-[#3548e6]/40 hover:text-[#3548e6]"}`;

  return (
    <>
      <div className="mt-6">
        {categories.length > 1 && (
          <div role="group" aria-label={t("design2d.filter")} className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button type="button" aria-pressed={filter === null} onClick={() => { setFilter(null); setExpanded(false); }} className={chip(filter === null)}>
              {t("design2d.all")} · {projects.length}
            </button>
            {categories.map((category) => (
              <button key={category.key} type="button" aria-pressed={filter === category.key} onClick={() => { setFilter(category.key); setExpanded(false); }} className={chip(filter === category.key)}>
                {category.name}
              </button>
            ))}
          </div>
        )}

        <DesignGrid projects={visible} onOpen={setActive} />

        {(hiddenCount > 0 || expanded) && filtered.length > INITIAL_VISIBLE && (
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#17215f]/15 bg-white px-4 py-2 text-xs font-bold text-[#17215f] transition hover:border-[#3548e6]/40 hover:text-[#3548e6]"
            >
              {expanded ? <>{t("design2d.less")} <ChevronUp size={14} /></> : <>{t("design2d.more")} ({hiddenCount}) <ChevronDown size={14} /></>}
            </button>
          </div>
        )}
      </div>
      {/* The viewer walks through the whole filtered list, not only the cards that are visible. */}
      <DesignLightbox projects={filtered} startIndex={active} onClose={close} />
    </>
  );
}

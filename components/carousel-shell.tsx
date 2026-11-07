"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLang } from "@/lib/i18n";

const SCROLL_EPSILON = 2;

/** Horizontal snap track + prev/next arrows, shared by the Personal and Professional carousels. */
export function CarouselShell({ count, children }: { count: number; children: ReactNode }) {
  const { t } = useLang();
  const containerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  const updateNavigation = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
    setCanPrev(container.scrollLeft > SCROLL_EPSILON);
    setCanNext(maxScroll - container.scrollLeft > SCROLL_EPSILON);
    setHasOverflow(maxScroll > SCROLL_EPSILON);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(updateNavigation);
    container.addEventListener("scroll", updateNavigation, { passive: true });
    resizeObserver.observe(container);
    updateNavigation();
    return () => {
      container.removeEventListener("scroll", updateNavigation);
      resizeObserver.disconnect();
    };
  }, [count, updateNavigation]);

  const scroll = (direction: "prev" | "next") => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollBy({
      left: direction === "next" ? container.clientWidth * 0.82 : -container.clientWidth * 0.82,
      behavior: "smooth",
    });
  };

  if (!count) return null;

  const arrow =
    "absolute top-1/2 z-20 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-[#17215f]/10 bg-white text-[#17215f] shadow-[0_8px_24px_rgba(31,43,92,.12)] transition hover:scale-105 hover:text-[#3548e6] disabled:pointer-events-none disabled:opacity-30";

  return (
    <div className="relative mt-8">
      <div
        ref={containerRef}
        className="project-carousel-track flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth scroll-px-1 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4"
      >
        {children}
      </div>

      {count >= 2 && hasOverflow && (
        <>
          <button type="button" onClick={() => scroll("prev")} disabled={!canPrev} aria-label={t("projects.prev")} className={`${arrow} left-0 -translate-x-1/2`}>
            <ChevronLeft size={16} />
          </button>
          <button type="button" onClick={() => scroll("next")} disabled={!canNext} aria-label={t("projects.next")} className={`${arrow} right-0 translate-x-1/2`}>
            <ChevronRight size={16} />
          </button>
        </>
      )}
    </div>
  );
}

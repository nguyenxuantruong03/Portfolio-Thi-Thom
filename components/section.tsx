"use client";

import { useEffect, useRef } from "react";

/**
 * Fade/slide-in when a block scrolls into view.
 *
 * It used to be a framer-motion wrapper that rendered `opacity: 0` in the server HTML, so crawlers
 * and slow connections saw an empty page until JavaScript ran. Now the content is visible in the HTML;
 * only blocks that start below the fold are hidden by the browser and revealed on scroll.
 */
export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Already on screen (hero, anchor jump): never hide it.
    if (element.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    element.dataset.reveal = "pending";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        element.dataset.reveal = "done";
        observer.disconnect();
      },
      { threshold: 0.12 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}

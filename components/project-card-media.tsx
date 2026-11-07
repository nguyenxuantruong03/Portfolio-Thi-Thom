"use client";

import { useRef, useState } from "react";
import type { Project } from "@/lib/data";
import { ProjectMediaLightbox } from "@/components/project-media-lightbox";
import { useLang } from "@/lib/i18n";
import { optimizedImageSrcSet, optimizedImageUrl, videoPosterUrl } from "@/lib/media";

type Props = {
  project: Project;
  /** contain = show the whole picture (Personal). cover = fill the frame (Professional). */
  fit?: "contain" | "cover";
  /** Marks the first visible card so the browser fetches it early. */
  priority?: boolean;
  /** If present, the media itself redirects here instead of opening the lightbox. */
  link?: string;
};

const CARD_SIZES = "(max-width: 640px) 92vw, (max-width: 1024px) 40vw, 28vw";

/** Image or hover-to-play video of a project card, with a lazy full-screen viewer. */
export function ProjectCardMedia({ project, fit = "contain", priority = false, link }: Props) {
  const { t } = useLang();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [, setHovering] = useState(false);
  const objectFit = fit === "cover" ? "object-cover" : "object-contain";
  // cover: fills a frame that already has its own aspect ratio. contain: fills the half-card.
  const frame = fit === "cover" ? "absolute inset-0" : "relative h-full min-h-[220px] sm:min-h-0";
  const wrapper = `group/media ${frame} flex items-center justify-center overflow-hidden bg-transparent`;

  const poster = project.image ? optimizedImageUrl(project.image, 800) : project.videoUrl ? videoPosterUrl(project.videoUrl) : undefined;

  const handleEnter = async () => {
    setHovering(true);
    const video = videoRef.current;
    if (!video) return;
    // Hover preview must start without a click. Load first so metadata-only preload is ready for play().
    video.muted = true;
    video.playsInline = true;
    if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) video.load();
    try {
      await video.play();
    } catch {
      // Keep the poster visible if the browser blocks playback.
    }
  };

  const handleLeave = () => {
    setHovering(false);
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  };

  if (project.videoUrl) {
    return (
      <div className={wrapper} onPointerEnter={handleEnter} onPointerLeave={handleLeave}>
        <video
          ref={videoRef}
          className={`pointer-events-none h-full w-full ${objectFit} transition duration-500 group-hover:scale-[1.012]`}
          poster={poster}
          muted
          playsInline
          preload="none"
          aria-label={project.title}
        >
          <source src={project.videoUrl} />
        </video>
        {link ? (
          <a
            href={link}
            className="absolute inset-0 z-20 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-[#3548e6]/40"
            aria-label={`Open ${project.title}`}
          />
        ) : (
          <ProjectMediaLightbox src={project.image || poster || ""} alt={project.title} videoSrc={project.videoUrl} sourceVideoRef={videoRef} poster={poster} />
        )}
      </div>
    );
  }

  if (project.image) {
    return (
      <div className={wrapper}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={optimizedImageUrl(project.image, 800)}
          srcSet={optimizedImageSrcSet(project.image)}
          sizes={CARD_SIZES}
          alt={project.title}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          className={`h-full w-full ${objectFit} transition duration-500 group-hover:scale-[1.012]`}
        />
        {link ? (
          <a
            href={link}
            className="absolute inset-0 z-20 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-[#3548e6]/40"
            aria-label={`Open ${project.title}`}
          />
        ) : (
          <ProjectMediaLightbox src={project.image} alt={project.title} />
        )}
      </div>
    );
  }

  return <div className={`${frame} grid place-items-center bg-transparent text-xs font-medium text-[#17215f]/35`}>{t("projects.preview")}</div>;
}

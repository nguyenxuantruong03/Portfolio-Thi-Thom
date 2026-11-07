"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Maximize2, X } from "lucide-react";
import { optimizedImageUrl } from "@/lib/media";

type ProjectMediaLightboxProps = {
  src: string;
  alt: string;
  videoSrc?: string;
  sourceVideoRef?: RefObject<HTMLVideoElement | null>;
  /** Poster for the video (small image). */
  poster?: string;
};

/**
 * Full-screen viewer for a card's image or video.
 * The big file is only requested after the visitor opens it. Before, every card rendered a
 * priority full-size image/preload up front, which made the home page download all of them.
 */
export function ProjectMediaLightbox({ src, alt, videoSrc, sourceVideoRef, poster }: ProjectMediaLightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const [open, setOpen] = useState(false);
  const [startTime, setStartTime] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();

    const closeOnBackdrop = (event: MouseEvent) => {
      if (event.target === dialog) dialog.close();
    };
    const onClose = () => setOpen(false);

    dialog.addEventListener("click", closeOnBackdrop);
    dialog.addEventListener("close", onClose);
    return () => {
      dialog.removeEventListener("click", closeOnBackdrop);
      dialog.removeEventListener("close", onClose);
    };
  }, [open]);

  useEffect(() => {
    const video = previewVideoRef.current;
    if (!open || !video || !videoSrc) return;
    const sync = () => {
      try {
        const max = Number.isFinite(video.duration) ? video.duration : startTime;
        video.currentTime = Math.max(0, Math.min(startTime, max));
      } catch {
        // Metadata may still be unavailable; loadedmetadata retries.
      }
    };
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) sync();
    video.addEventListener("loadedmetadata", sync);
    return () => video.removeEventListener("loadedmetadata", sync);
  }, [open, startTime, videoSrc]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setStartTime(Math.max(0, sourceVideoRef?.current?.currentTime ?? 0));
          setOpen(true);
        }}
        className="absolute inset-0 z-20 cursor-zoom-in text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-[#3548e6]/40"
        aria-label={`Mở ${videoSrc ? "video" : "ảnh"} ${alt} toàn màn hình`}
      >
        <span className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-white/90 text-[#17215f] opacity-0 shadow-lg transition group-hover/media:opacity-100 group-focus-visible/media:opacity-100">
          <Maximize2 size={16} />
        </span>
      </button>

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-0 h-dvh w-dvw max-h-none max-w-none border-0 bg-transparent p-0 backdrop:bg-[#07102c]/92"
      >
        {open && (
          <div className="flex h-dvh w-dvw items-center justify-center p-4 sm:p-8">
            <div className="relative flex h-full w-full items-center justify-center">
              {videoSrc ? (
                <video ref={previewVideoRef} className="max-h-full max-w-full object-contain" controls autoPlay playsInline poster={poster}>
                  <source src={videoSrc} />
                </video>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={optimizedImageUrl(src, 1800)} alt={alt} decoding="async" className="max-h-full max-w-full object-contain" />
              )}

              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white text-[#17215f] shadow-xl transition hover:scale-105 sm:right-6 sm:top-6"
                aria-label="Đóng media"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}

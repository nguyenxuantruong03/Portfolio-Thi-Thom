"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Project } from "@/lib/data";
import { CarouselShell } from "@/components/carousel-shell";
import { ProjectCardMedia } from "@/components/project-card-media";
import { Badge } from "@/components/ui/badge";
import { useLang } from "@/lib/i18n";

const BODY_CLASS = "flex min-w-0 flex-col p-3.5 outline-none sm:p-4";
const BODY_LINK_CLASS = `${BODY_CLASS} transition-colors hover:bg-[#f8faff] focus-visible:bg-[#f8faff] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3548e6]`;

/** Both Personal and Professional projects use the same detail-page card. */
function ProjectCardBody({ project, children }: { project: Project; children: React.ReactNode }) {
  return (
    <Link
      href={`/projects/${encodeURIComponent(project.id)}`}
      aria-label={`Open project details for ${project.title}`}
      className={BODY_LINK_CLASS}
    >
      {children}
    </Link>
  );
}

/** Unified project cards: horizontal layout shared by Personal and Professional projects. */
export function ProjectsCarousel({ projects }: { projects: Project[] }) {
  const { t } = useLang();

  return (
    <CarouselShell count={projects.length}>
      {projects.map((project) => (
        <article
          key={project.id}
          className="project-carousel-card group snap-start overflow-hidden rounded-[22px] border border-[#17215f]/10 bg-white shadow-[0_8px_28px_rgba(31,43,92,.055)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-[#3548e6]/20 hover:shadow-[0_14px_36px_rgba(31,43,92,.09)]"
        >
          <div className="grid sm:grid-cols-[48%_52%]">
            <div className="relative min-h-[190px] overflow-hidden bg-transparent sm:min-h-[220px]">
              <ProjectCardMedia project={project} link={project.cardMediaLink || undefined} />
            </div>

            <ProjectCardBody project={project}>
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 truncate text-[9px] font-extrabold uppercase tracking-[.16em] text-[#3548e6]">{project.eyebrow || (project.category === "professional" ? "Professional Project" : "Personal Project")}</p>
                <span className="shrink-0 truncate text-[9px] font-semibold uppercase tracking-[.12em] text-[#17215f]/35">{project.label || t("projects.default")}</span>
              </div>

              <h3 className="mt-2 line-clamp-3 text-[17px] font-bold leading-[1.32] tracking-[-.02em] text-[#17215f] transition-colors group-hover:text-[#3548e6]">
                {project.title}
              </h3>
              <p className="mt-2 line-clamp-3 text-[11px] leading-[17px] text-[#17215f]/58">{project.subtitle || project.overview}</p>

              <div className="mt-3 min-h-6">
                {!!project.tags?.length && (
                  <div className="flex flex-wrap gap-1.5">
                    {project.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="blue" className="h-6 rounded-full px-2 text-[9px] font-bold">{tag}</Badge>
                    ))}
                    {project.tags.length > 3 && <Badge variant="outline" className="h-6 rounded-full px-2 text-[9px]">+{project.tags.length - 3}</Badge>}
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#17215f]/8 pt-2.5">
                <span className="text-[10px] font-semibold text-[#17215f]/35">{t("projects.selected")}</span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#17215f] px-3 py-2 text-[10px] font-bold text-white transition group-hover:bg-[#3548e6]">
                  <span>{t("projects.view")}</span> <ArrowUpRight size={12} />
                </span>
              </div>
            </ProjectCardBody>
          </div>
        </article>
      ))}
    </CarouselShell>
  );
}

import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { cache } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { notFound } from "next/navigation";

import { getPublishedProject as loadPublishedProject } from "@/lib/public-content";
import { listPublishedSlugs } from "@/lib/content-repository";
import { optimizedImageUrl, optimizedVideoUrl, videoPosterUrl } from "@/lib/media";
import { ProjectLayoutContent } from "@/components/project-layout-builder";
import { ExtraFonts, fontsUsedIn } from "@/components/extra-fonts";
import { SITE_NAME, SITE_URL } from "@/lib/site";

// Built once, cached, refreshed every minute (and instantly when the CMS saves).
export const revalidate = 60;

// One DB read per request even though both the page and its metadata need the project.
const getPublishedProject = cache(loadPublishedProject);

export async function generateStaticParams() {
  try {
    return (await listPublishedSlugs()).map(({ slug }) => ({ id: slug }));
  } catch {
    return []; // Database not reachable at build time: pages are generated on first visit instead.
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const project = await getPublishedProject(id);
  if (!project) return { title: "Không tìm thấy dự án", robots: { index: false } };

  const description = (project.subtitle || project.overview || `Dự án ${project.title} trong portfolio của ${SITE_NAME}.`).slice(0, 200);
  const cover = project.image ? optimizedImageUrl(project.image, 1200) : undefined;
  const path = `/projects/${encodeURIComponent(project.id)}`;

  return {
    title: project.title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "article", url: path, title: project.title, description, ...(cover ? { images: [{ url: cover }] } : {}) },
    twitter: { card: cover ? "summary_large_image" : "summary", title: project.title, description, ...(cover ? { images: [cover] } : {}) },
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await getPublishedProject(id);

  if (!project) {
    notFound();
  }

  const media = project.media ?? [];
  const usedFonts = fontsUsedIn(`${project.contentHtml ?? ""}${JSON.stringify(project.content ?? "")}`);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    description: project.subtitle || project.overview || undefined,
    image: project.image ? optimizedImageUrl(project.image, 1200) : undefined,
    keywords: project.tags?.join(", ") || undefined,
    author: { "@type": "Person", name: SITE_NAME, url: SITE_URL },
    url: `${SITE_URL}/projects/${encodeURIComponent(project.id)}`,
  };

  return (
    <main className="page-shell min-h-screen px-5 pb-16 pt-8 sm:px-8 lg:px-10">
      <ExtraFonts families={usedFonts} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <div className="mx-auto max-w-5xl">
        <Link
          href="/#projects"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#17215f]/65 transition hover:text-[#3548e6]"
        >
          <ArrowLeft size={15} />
          Back to Projects
        </Link>

        <div className="mt-8 overflow-hidden rounded-[32px] border border-[#17215f]/10 bg-white shadow-[0_16px_50px_rgba(31,43,92,.07)]">

          <div className="p-6 sm:p-10">
            {/* Eyebrow */}
            {project.eyebrow && (
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#3548e6]">
                {project.eyebrow}
              </p>
            )}

            {/* Title */}
            <h1 className="display-font mt-3 text-4xl font-bold italic leading-tight text-[#17215f] sm:text-5xl">
              {project.title}
            </h1>

            {/* Subtitle */}
            {project.subtitle && (
              <p className="mt-4 max-w-3xl text-sm leading-6 text-[#17215f]/60">
                {project.subtitle}
              </p>
            )}

            {project.category === "professional" && (project.clientName || project.projectRole || project.projectPeriod) && (
              <dl className="mt-5 grid gap-3 rounded-2xl border border-[#17215f]/10 bg-[#fffaf3] p-4 text-sm sm:grid-cols-3">
                {project.clientName && <div><dt className="text-[10px] font-bold uppercase tracking-wider text-[#17215f]/45">Client</dt><dd className="mt-1 font-semibold text-[#17215f]">{project.clientName}</dd></div>}
                {project.projectRole && <div><dt className="text-[10px] font-bold uppercase tracking-wider text-[#17215f]/45">Role</dt><dd className="mt-1 font-semibold text-[#17215f]">{project.projectRole}</dd></div>}
                {project.projectPeriod && <div><dt className="text-[10px] font-bold uppercase tracking-wider text-[#17215f]/45">Period</dt><dd className="mt-1 font-semibold text-[#17215f]">{project.projectPeriod}</dd></div>}
              </dl>
            )}

            {/* Tags */}
            {project.tags && project.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {project.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[#3548e6]/10 bg-[#3548e6]/5 px-3 py-1.5 text-[10px] font-semibold text-[#3548e6]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Rich content */}
            {project.content?.content?.some((node) => node.type === "projectLayout") ? (
              <ProjectLayoutContent content={project.content} />
            ) : project.contentHtml ? (
              <div className="prose mt-8 max-w-none prose-headings:text-[#17215f] prose-p:text-[#17215f]/70 prose-strong:text-[#17215f] prose-a:text-[#3548e6] prose-li:text-[#17215f]/70 prose-blockquote:text-[#17215f]/70 prose-table:w-full prose-table:border-collapse prose-th:border prose-th:border-[#17215f]/10 prose-th:bg-[#f8f7ff] prose-th:p-3 prose-td:border prose-td:border-[#17215f]/10 prose-td:p-3 prose-img:rounded-2xl" dangerouslySetInnerHTML={{ __html: project.contentHtml }} />
            ) : null}

            {/* Additional media */}
            {!project.content?.content?.some((node) => node.type === "projectLayout") && media.length > 0 && (
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {media.map((asset) => {
                  if (asset.resourceType === "video") {
                    return (
                      <div
                        key={asset.id}
                        className="overflow-hidden rounded-2xl border border-[#17215f]/10 bg-[#f8f7ff]"
                      >
                        <video
                          controls
                          playsInline
                          preload="none"
                          poster={videoPosterUrl(asset.url, 1000)}
                          className="h-full w-full object-cover"
                        >
                          <source src={optimizedVideoUrl(asset.url)} />
                        </video>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={asset.id}
                      className="overflow-hidden rounded-2xl border border-[#17215f]/10 bg-[#f8f7ff]"
                    >
                      <div className="relative aspect-video">
                        <Image
                          src={optimizedImageUrl(asset.url, 1000)}
                          alt={asset.alt ?? project.title}
                          fill
                          sizes="(max-width: 640px) 100vw, 50vw"
                          className="object-cover"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {project.externalUrl && /^https?:\/\//i.test(project.externalUrl) && (
              <a href={project.externalUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#17215f] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#3548e6]">View external project <ArrowUpRight size={14} /></a>
            )}

            {/* Contact CTA */}
            <div className="mt-10 border-t border-[#17215f]/10 pt-6">
              <Link
                href="/#contact"
                className="inline-flex items-center gap-2 rounded-full bg-[#173c84] px-5 py-3 text-xs font-bold text-white transition hover:bg-[#3548e6]"
              >
                <span className="text-white">Discuss This Project</span>
                <ArrowUpRight size={15} className="text-white" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

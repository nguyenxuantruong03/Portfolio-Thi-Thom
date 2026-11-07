"use client";

import { ArrowUpRight } from "lucide-react";
import type { PortfolioData, Project } from "@/lib/data";
import type { QuickItem } from "@/lib/content-types";
import { useLang } from "@/lib/i18n";
import { Navbar } from "@/components/navbar";
import { Reveal } from "@/components/section";
import { ContactForm } from "@/components/contact-form";
import { ProjectsCarousel } from "@/components/projects-carousel";
import { ExperienceTimeline } from "@/components/experience-timeline";
import { PortfolioMetrics } from "@/components/portfolio-metrics";
import { DesignGallery, type DesignProject } from "@/components/design-gallery";

type Props = {
  data: PortfolioData;
  projects: Project[];
  designItems: QuickItem[];
};

export function HomeContent({ data, projects, designItems }: Props) {
  const { t, lang } = useLang();

  // Personal and Professional are two distinct public sections.
  // They intentionally reuse the same project card/carousel component, while
  // the CMS keeps both types in one ProjectContent model via `category`.
  // The CMS is one Project collection; the homepage is two independent public
  // sections. Never merge Personal + Professional cards into one carousel.
  const personalProjects = projects.filter((project) => project.category === "personal");
  const professionalProjects = projects.filter((project) => project.category === "professional");
  const designProjects: DesignProject[] = designItems
    .map((item) => ({
      id: item.id,
      title: item.title,
      tags: item.tags,
      images: item.media
        .filter((asset) => asset.resourceType === "image")
        .map((asset) => ({ src: asset.url, alt: item.title })),
    }))
    .filter((project) => project.images.length > 0);
  const detailProjects = projects;

  const vi = lang === "vi";

  return (
    <main className="page-shell min-h-screen">
      <Navbar />

      {/* Hero / introduction */}
      <section id="home" className="relative mx-auto max-w-6xl scroll-mt-24 px-5 pb-14 pt-28 sm:px-8 lg:px-10">
        <div className="relative overflow-hidden rounded-[36px] border border-[#f0e4d4] bg-[#fffaf3] px-6 py-10 shadow-[0_18px_50px_rgba(31,43,92,.06)] sm:px-10 sm:py-12 lg:px-14">
          <div>
            <div className="grid items-center gap-10 lg:grid-cols-[1.25fr_.75fr]">
              <div className="max-w-3xl">
                <h1 className="display-font mt-2 text-4xl font-bold leading-tight tracking-[-.03em] text-[#17215f] sm:text-5xl lg:mt-8 lg:text-[3.35rem]">
                  {t("hero.title")}
                </h1>
                <h2 className="mt-5 text-2xl font-bold leading-tight tracking-[-.025em] text-[#17215f] sm:text-3xl lg:text-[1.9rem]">
                  {t("hero.subtitle")}
                </h2>
                <p className="mt-7 text-base font-medium text-[#17215f]/70 sm:text-lg">{vi ? data.headline : t("hero.headline")}</p>
                <p className="mt-4 text-sm leading-7 text-[#17215f]/70 sm:text-[15px] sm:leading-7">
                  {vi ? data.heroDescription : t("hero.description")}
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <a href="#projects" className="inline-flex h-11 items-center gap-2 rounded-full bg-[#173c84] px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#3548e6]">
                    <span className="text-white">{t("hero.cta.work")}</span> <ArrowUpRight size={16} className="text-white" />
                  </a>
                  <a href="#contact" className="inline-flex h-11 items-center gap-2 rounded-full border border-transparent px-2 text-sm font-semibold text-[#17215f] transition hover:text-[#3548e6]">
                    {t("hero.cta.contact")} <ArrowUpRight size={16} />
                  </a>
                </div>
              </div>

              <div className="mx-auto w-full max-w-[320px] lg:max-w-none lg:justify-self-end">
                <div className="relative">
                  <div aria-hidden className="absolute -right-3 -top-3 h-full w-full rounded-[32px] bg-gradient-to-br from-[#59c9ee]/40 to-[#3548e6]/25" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/anh_dai_dien.webp"
                    width={960}
                    height={1439}
                    fetchPriority="high"
                    decoding="async"
                    alt={t("hero.photoAlt")}
                    className="relative aspect-[4/5] w-full rounded-[32px] border-4 border-white object-cover object-top shadow-[0_18px_44px_rgba(31,43,92,.18)]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <PortfolioMetrics projects={detailProjects.map((project) => ({ id: project.id, title: project.title }))} />

      {/* About */}
      <section id="about" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-12 sm:px-8 lg:px-10">
        <Reveal>
          <div className="overflow-hidden rounded-[28px] border border-[#17215f]/10 bg-white/75 shadow-[0_12px_35px_rgba(31,43,92,.05)]">
            <div className="grid lg:grid-cols-[1.15fr_.85fr]">
              <div className="p-6 sm:p-8 lg:p-9">
                <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#3548e6]">{t("about.eyebrow")}</p>
                <h2 className="mt-2 text-3xl font-bold tracking-[-.03em] text-[#17215f] sm:text-4xl">{t("about.title")}</h2>
                <div className="mt-5 max-w-2xl space-y-2.5 text-sm leading-6 text-[#17215f]/72 sm:text-[15px]">
                  <p dangerouslySetInnerHTML={{ __html: t("about.p1") }} />
                  <p>{t("about.p2")}</p>
                  <p>{t("about.p3")}</p>
                </div>
              </div>

              <div className="border-t border-[#17215f]/10 bg-gradient-to-br from-[#fffaf3] to-[#f8f7ff] p-4 sm:p-6 lg:border-l lg:border-t-0 lg:p-6">
                <div className="flex flex-col gap-2.5">
                  <ProfileItem title={t("about.education")} value={data.education} />
                  <ProfileItem title={t("about.major")} value={vi ? data.educationMajor : t("about.majorValue")} />
                  <ProfileItem title={t("about.period")} value={data.educationPeriod} />
                  <ProfileItem title={t("about.location")} value={t("about.locationValue")} />
                  <div className="profile-info-card">
                    <p className="profile-info-label">{t("about.certificates")}</p>
                    <ul className="mt-1.5 space-y-1">
                      {["about.cert.toeic", "about.cert.photoshop", "about.cert.slide"].map((key) => (
                        <li key={key} className="profile-info-value flex items-start gap-2" style={{ marginTop: 0, whiteSpace: "normal" }}>
                          <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[#59c9ee]" />
                          <span>{t(key)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Experience */}
      <section id="experience" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16 sm:px-8 lg:px-10">
        <Reveal>
          <SectionHeading eyebrow={t("exp.eyebrow")} title={t("exp.title")} />
          <ExperienceTimeline experiences={data.experiences} />
        </Reveal>
      </section>


      {/* Personal projects — separate public section, shared card design */}
      <section id="projects" className="scroll-mt-24 px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading eyebrow={t("personal.eyebrow")} title={t("personal.title")} desc={t("personal.desc")} />
          </Reveal>
          {personalProjects.length ? <ProjectsCarousel projects={personalProjects} /> : <EmptyNote text={t("projects.empty")} />}
        </div>
      </section>

      {/* Professional projects — separate public section, same card component */}
      <section id="professional-projects" className="scroll-mt-24 px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading eyebrow={t("professional.eyebrow")} title={t("professional.title")} desc={t("professional.desc")} />
          </Reveal>
          {professionalProjects.length ? <ProjectsCarousel projects={professionalProjects} /> : <EmptyNote text={t("projects.empty")} />}
        </div>
      </section>

      {/* 2D graphic design (cover cards + lightbox; the "More" tile only exists in the CMS) */}
      <section id="design2d" className="scroll-mt-24 px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading eyebrow={t("design2d.eyebrow")} title={t("design2d.title")} desc={t("design2d.desc")} />
          </Reveal>
          <DesignGallery projects={designProjects} />
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="scroll-mt-24 px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="grid gap-8 overflow-hidden rounded-[36px] bg-[#3548e6] p-7 text-white sm:p-10 lg:grid-cols-[1fr_.85fr]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.2em] text-[#b9efff]">{t("contact.eyebrow")}</p>
                <h2 className="display-font mt-3 max-w-lg text-5xl font-bold italic leading-[.95]">{t("contact.title")}</h2>
                <p className="mt-6 max-w-xl text-sm leading-7 text-white/75">{t("contact.desc")}</p>
                <div className="mt-8 space-y-3 text-sm">
                  <a href={`mailto:${data.email}`} className="block hover:underline">{data.email}</a>
                  <a href={`tel:${data.phone.replaceAll(" ", "")}`} className="block hover:underline">{data.phone}</a>
                  <span className="block">{data.location}</span>
                </div>
              </div>
              <div className="rounded-[28px] bg-[#fffaf3] p-5 text-[#17215f] sm:p-7"><ContactForm /></div>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 pb-10 pt-4 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-3 border-t border-[#17215f]/10 pt-6 text-xs text-[#17215f]/55 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 {data.name}. {t("footer.rights")}</span>
          <span className="display-font text-base italic">Thị Thơm.</span>
          <span>{t("footer.tagline")}</span>
        </div>
      </footer>
    </main>
  );
}

function SectionHeading({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) {
  return (
    <>
      <div className="flex items-end justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#3548e6]">{eyebrow}</p>
          <h2 className="display-font mt-2 text-4xl font-bold italic sm:text-5xl">{title}</h2>
        </div>
      </div>
      {desc && <p className="mt-4 max-w-2xl text-sm leading-7 text-[#17215f]/60">{desc}</p>}
    </>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="mt-8 rounded-[24px] border border-dashed border-[#17215f]/15 bg-white/60 px-6 py-12 text-center text-sm text-[#17215f]/55">{text}</p>;
}

function ProfileItem({ title, value }: { title: string; value: string }) {
  return (
    <div className="profile-info-card group">
      <p className="profile-info-label">{title}</p>
      <p className="profile-info-value">{value}</p>
    </div>
  );
}

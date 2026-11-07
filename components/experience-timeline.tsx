"use client";

import { Reveal } from "@/components/section";
import { useMemo } from "react";
import type { PortfolioData } from "@/lib/data";
import { experienceEn, useLang } from "@/lib/i18n";

type Experience = PortfolioData["experiences"][number];

export function ExperienceTimeline({ experiences: source }: { experiences: Experience[] }) {
  const { lang } = useLang();
  const experiences = useMemo(
    () => source.map((item) => (lang === "en" && experienceEn[item.company] ? { ...item, ...experienceEn[item.company] } : item)),
    [source, lang],
  );
  const sortedExperiences = useMemo(() => {
    return [...experiences].sort((a, b) => {
      const getStart = (period: string) => {
        const match = period.match(/(\d{1,2})\/(\d{4})/);
        if (!match) return Number.MAX_SAFE_INTEGER;
        return Number(match[2]) * 100 + Number(match[1]);
      };
      return getStart(a.period) - getStart(b.period);
    });
  }, [experiences]);

  return (
    <div className="relative mt-10 ml-3 border-l border-[#3548e6]/20 pl-7 sm:ml-4 sm:pl-10">
      <div className="space-y-10">
        {sortedExperiences.map((item, i) => (
          <Reveal key={`${item.company}-${item.title}-${i}`} delay={Math.min(i, 3) * 80} className="relative">
            <span className="absolute left-[calc(-1.75rem-0.4375rem)] top-[8px] z-10 size-3.5 rounded-full sm:left-[calc(-2.5rem-0.4375rem)] border-[3px] border-[#f8f2e9] bg-[#3548e6] shadow-[0_0_0_3px_rgba(53,72,230,.12)]" />
            <div className="rounded-[24px] border border-[#17215f]/8 bg-[#fffaf3] p-5 shadow-[0_8px_24px_rgba(31,43,92,.07)] transition hover:-translate-y-1 hover:shadow-xl sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#3548e6]">{item.company}</p>
                  <h3 className="mt-1 text-lg font-bold">{item.title}</h3>
                </div>
                <span className="w-fit rounded-full bg-[#3548e6]/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#3548e6]">
                  {item.period}
                </span>
              </div>
              {item.detail.length > 0 && (
                <ul className="mt-4 space-y-2 text-xs leading-6 text-[#17215f]/68">
                  {item.detail.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#59c9ee]" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

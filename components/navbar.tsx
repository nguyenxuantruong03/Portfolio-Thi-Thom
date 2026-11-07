"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { useLang, type Lang } from "@/lib/i18n";

const links = [
  ["nav.home", "home"],
  ["nav.metrics", "metrics"],
  ["nav.about", "about"],
  ["nav.experience", "experience"],
  ["nav.personal", "projects"],
  ["nav.professional", "professional-projects"],
  ["nav.design2d", "design2d"],
  ["nav.contact", "contact"],
] as const;

type SectionId = (typeof links)[number][1];

function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useLang();
  const options: Lang[] = ["vi", "en"];
  return (
    <div role="group" aria-label={t("nav.language")} className={`inline-flex items-center rounded-full border border-[#17215f]/10 bg-white p-0.5 ${compact ? "" : "ml-1"}`}>
      {options.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition ${lang === code ? "bg-[#17215f] text-white" : "text-[#17215f]/60 hover:text-[#3548e6]"}`}
        >
          {code === "vi" ? "VI" : "EN"}
        </button>
      ))}
    </div>
  );
}

export function Navbar() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<SectionId>("home");
  const programmaticTarget = useRef<SectionId | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncActiveSection = useCallback(() => {
    if (programmaticTarget.current) return;

    const contact = document.getElementById("contact");
    const atPageEnd =
      window.scrollY + window.innerHeight >=
      document.documentElement.scrollHeight - 24;

    // The contact section can be taller than the remaining scroll range.
    // Treat reaching the page end as reaching Contact, even if its top
    // cannot physically align with the navbar.
    if (atPageEnd || (contact && contact.getBoundingClientRect().bottom <= window.innerHeight + 24)) {
      setActive("contact");
      return;
    }

    const activationLine = 125;
    let current: SectionId = "home";
    for (const [, id] of links) {
      const section = document.getElementById(id);
      if (section && section.getBoundingClientRect().top <= activationLine) current = id;
    }
    setActive(current);
  }, []);

  const go = (id: SectionId) => {
    const section = document.getElementById(id);
    if (!section) return;

    if (settleTimer.current) clearTimeout(settleTimer.current);
    programmaticTarget.current = id;
    setActive(id);
    setOpen(false);

    const navbarOffset = 112;
    const top = section.getBoundingClientRect().top + window.scrollY - navbarOffset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });

    // Keep the clicked item active throughout smooth scrolling. Then hand
    // control back to scroll-position tracking (including the Contact edge case).
    const finishProgrammaticScroll = () => {
      programmaticTarget.current = null;
      setActive(id);
      requestAnimationFrame(syncActiveSection);
    };
    const onScrollEnd = () => {
      window.removeEventListener("scrollend", onScrollEnd);
      if (settleTimer.current) clearTimeout(settleTimer.current);
      finishProgrammaticScroll();
    };
    window.addEventListener("scrollend", onScrollEnd, { once: true });
    settleTimer.current = setTimeout(() => {
      window.removeEventListener("scrollend", onScrollEnd);
      finishProgrammaticScroll();
    }, 1800);
  };

  useEffect(() => {
    syncActiveSection();
    window.addEventListener("scroll", syncActiveSection, { passive: true });
    window.addEventListener("resize", syncActiveSection);
    return () => {
      window.removeEventListener("scroll", syncActiveSection);
      window.removeEventListener("resize", syncActiveSection);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [syncActiveSection]);

  return (
    <header className="fixed left-1/2 top-4 z-50 w-[calc(100%-24px)] max-w-6xl -translate-x-1/2">
      <div className="rounded-2xl border border-white/70 bg-[#fffaf3]/88 px-3 py-2 shadow-[0_10px_35px_rgba(31,43,92,.10)] backdrop-blur-xl">
        <div className="flex h-12 items-center justify-between px-2">
          <button onClick={() => go("home")} className="display-font text-xl font-bold italic tracking-tight text-[#3548e6]">Thị Thơm.</button>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
            {links.map(([label, id]) => (
              <button
                key={id}
                onClick={() => go(id)}
                aria-current={active === id ? "location" : undefined}
                className={`rounded-full px-2.5 py-2 text-[11px] font-semibold transition lg:px-3 ${active === id ? "bg-[#3548e6] text-white shadow-[0_5px_14px_rgba(53,72,230,.20)]" : "text-[#17215f]/70 hover:bg-[#3548e6]/8 hover:text-[#3548e6]"}`}
              >
                {t(label)}
              </button>
            ))}
            <LanguageSwitch />
          </nav>
          <div className="flex items-center gap-2 md:hidden">
            <LanguageSwitch compact />
            <button aria-label={t("nav.menu")} onClick={() => setOpen(v => !v)} className="grid size-10 place-items-center rounded-full bg-[#3548e6] text-white">{open ? <X size={18}/> : <Menu size={18}/>}</button>
          </div>
        </div>
        <nav
          aria-label="Mobile navigation"
          inert={!open}
          className={`grid transition-[grid-template-rows,opacity] duration-300 md:hidden ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        >
          <div className="overflow-hidden">
            <div className="grid gap-1 border-t border-[#17215f]/10 px-2 pb-2 pt-2">
              {links.map(([label, id]) => (
                <button key={id} onClick={() => go(id)} aria-current={active === id ? "location" : undefined} className={`rounded-xl px-4 py-3 text-left text-sm font-semibold ${active === id ? "bg-[#3548e6] text-white" : "hover:bg-[#3548e6]/8"}`}>{t(label)}</button>
              ))}
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}

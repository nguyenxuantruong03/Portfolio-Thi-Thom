"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ExternalLink, RefreshCw, X } from "lucide-react";
import type { TikTokMetrics } from "@/lib/tiktok-stats";
import { useLang } from "@/lib/i18n";

type ProjectSummary = { id: string; title: string };
type Props = { projects: ProjectSummary[] };
type MetricKey = "followers" | "likes" | "topFollowers" | "topLikes" | "projects";

const number = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const compact = (value: number | null | undefined) => value == null ? "—" : new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);

export function PortfolioMetrics({ projects }: Props) {
  const { t, lang } = useLang();
  const [metrics, setMetrics] = useState<TikTokMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<MetricKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/tiktok/stats", { cache: "no-store" });
      if (!response.ok) throw new Error("Không thể cập nhật dữ liệu TikTok.");
      setMetrics(await response.json() as TikTokMetrics);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 15 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setActive(null); };
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [active]);

  const cards = useMemo(() => {
    const channels = metrics?.channels ?? [];
    const totalFollowers = channels.reduce((sum, channel) => sum + channel.followerCount, 0);
    const totalLikes = channels.reduce((sum, channel) => sum + channel.likesCount, 0);
    const topFollowers = [...channels].sort((a, b) => b.followerCount - a.followerCount)[0];
    const topLikes = [...channels].sort((a, b) => b.likesCount - a.likesCount)[0];

    return [
      { key: "followers" as const, value: compact(totalFollowers), label: t("metrics.followers"), detail: t("metrics.accounts") },
      { key: "likes" as const, value: compact(totalLikes), label: t("metrics.likes"), detail: t("metrics.accounts") },
      { key: "topFollowers" as const, value: topFollowers ? compact(topFollowers.followerCount) : "—", label: t("metrics.topFollowers"), detail: topFollowers?.handle ?? "TikTok data" },
      { key: "topLikes" as const, value: topLikes ? compact(topLikes.likesCount) : "—", label: t("metrics.topLikes"), detail: topLikes?.handle ?? "TikTok data" },
      { key: "projects" as const, value: number(projects.length), label: t("metrics.projects"), detail: t("metrics.published") },
    ];
  }, [metrics, projects.length, t]);

  return (
    <>
      <section id="metrics" aria-label="Portfolio statistics" className="mx-auto max-w-6xl px-5 pb-6 sm:px-8 lg:px-10">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {cards.map((card) => (
            <button key={card.key} type="button" onClick={() => setActive(card.key)} className="metric-card metric-card-interactive group" aria-label={`Open ${card.label} details`}>
              <span className="metric-value">{card.value}</span>
              <span className="metric-meta"><span className="metric-label">{card.label}</span></span>
              <span className="metric-detail">{card.detail}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-end gap-2 text-[10px] text-[#17215f]/45">
          <span>{metrics?.usingStaticFallback ? t("metrics.snapshot") : t("metrics.tiktokData")}</span>
          {metrics?.updatedAt && <span>· {t("metrics.updated")} {new Date(metrics.updatedAt).toLocaleString(lang === "vi" ? "vi-VN" : "en-US")}</span>}
          {loading && <span className="inline-flex items-center gap-1"><RefreshCw size={11} className="animate-spin" /> {t("metrics.updating")}</span>}
          <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold text-[#3548e6] hover:bg-white disabled:opacity-50"><RefreshCw size={11} /> {t("metrics.refresh")}</button>
        </div>
        {error && <p role="status" className="mt-1 text-right text-xs text-red-600">{error}</p>}
      </section>

      {active && (
        <div className="metric-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setActive(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="metric-dialog-title" className="metric-dialog">
            <div className="flex items-start justify-between gap-4 border-b border-[#17215f]/10 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#3548e6]">Portfolio Insights</p>
                <h3 id="metric-dialog-title" className="mt-1 text-xl font-bold text-[#17215f]">{dialogTitle(active)}</h3>
              </div>
              <button type="button" onClick={() => setActive(null)} aria-label="Close" className="rounded-full p-2 text-[#17215f]/60 hover:bg-[#17215f]/5"><X size={18} /></button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-5 py-5 sm:px-6">
              {active === "followers" && <ChannelDetails metrics={metrics} field="followers" />}
              {active === "likes" && <ChannelDetails metrics={metrics} field="likes" />}
              {active === "topFollowers" && <TopChannelDetails metrics={metrics} field="followers" />}
              {active === "topLikes" && <TopChannelDetails metrics={metrics} field="likes" />}
              {active === "projects" && <ProjectsDetails projects={projects} />}
            </div>
            <div className="flex items-center justify-between border-t border-[#17215f]/10 px-5 py-3 sm:px-6">
              <span className="text-[10px] text-[#17215f]/45">TikTok API is preferred; the supplied account snapshot is used only until official data is available.</span>
              {active !== "projects" && <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-1 text-xs font-semibold text-[#3548e6] disabled:opacity-50"><RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Update now</button>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function dialogTitle(key: MetricKey) {
  return ({ followers: "TikTok Followers", likes: "TikTok Likes", topFollowers: "Top Account by Followers", topLikes: "Top Account by Likes", projects: "Selected Projects" })[key];
}

function ChannelDetails({ metrics, field }: { metrics: TikTokMetrics | null; field: "followers" | "likes" }) {
  const channels = metrics?.channels ?? [];
  return <div className="grid gap-3 sm:grid-cols-2">{channels.map((channel) => (
    <article key={channel.handle} className="rounded-2xl border border-[#17215f]/10 bg-[#fffaf3] p-4">
      <div className="flex items-center gap-3">
        <img src={channel.image} alt="" className="h-12 w-12 rounded-full object-cover" />
        <div className="min-w-0"><p className="font-bold text-[#17215f]">{channel.handle}</p><p className="mt-1 text-xs text-[#17215f]/55">{field === "followers" ? `${number(channel.followerCount)} Followers` : `${compact(channel.likesCount)} Lượt thích`} · {channel.source === "tiktok" ? "TikTok" : "Snapshot"}</p></div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3"><strong className="text-xl text-[#3548e6]">{field === "followers" ? number(channel.followerCount) : compact(channel.likesCount)}</strong><a href={channel.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#3548e6]">Open TikTok <ExternalLink size={12} /></a></div>
    </article>
  ))}</div>;
}

function TopChannelDetails({ metrics, field }: { metrics: TikTokMetrics | null; field: "followers" | "likes" }) {
  const channels = metrics?.channels ?? [];
  const top = [...channels].sort((a, b) => (field === "followers" ? b.followerCount - a.followerCount : b.likesCount - a.likesCount))[0];
  if (!top) return <p className="text-sm text-[#17215f]/60">TikTok data is not available yet.</p>;
  const value = field === "followers" ? number(top.followerCount) : compact(top.likesCount);
  return <div className="rounded-2xl bg-[#f1f3ff] p-5"><div className="flex items-center gap-4"><img src={top.image} alt="" className="h-16 w-16 rounded-full object-cover" /><div><p className="text-xs font-semibold uppercase tracking-wider text-[#3548e6]">{field === "followers" ? "Highest followers" : "Highest likes"}</p><p className="mt-1 text-2xl font-bold text-[#17215f]">{top.handle}</p><p className="mt-1 text-3xl font-bold text-[#3548e6]">{value}</p></div></div><a href={top.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#3548e6]">Open TikTok <ArrowUpRight size={13} /></a></div>;
}

function ProjectsDetails({ projects }: { projects: ProjectSummary[] }) {
  if (!projects.length) return <p className="text-sm text-[#17215f]/60">Chưa có dự án nào được publish.</p>;
  return <div><p className="mb-3 text-sm text-[#17215f]/60">{projects.length} published {projects.length === 1 ? "project" : "projects"} đang được lấy trực tiếp từ CMS.</p><div className="space-y-2">{projects.map((project, index) => <a key={project.id} href={`/projects/${encodeURIComponent(project.id)}`} className="flex items-center justify-between gap-3 rounded-xl border border-[#17215f]/10 px-4 py-3 text-sm font-semibold hover:border-[#3548e6]/40 hover:bg-[#f7f8ff]"><span>{String(index + 1).padStart(2, "0")} · {project.title}</span><ArrowUpRight size={15} className="shrink-0 text-[#3548e6]" /></a>)}</div></div>;
}

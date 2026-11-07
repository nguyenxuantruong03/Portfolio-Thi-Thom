import type { MetadataRoute } from "next";
import { listPublishedSlugs } from "@/lib/content-repository";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [{ url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 }];
  try {
    for (const { slug, updatedAt } of await listPublishedSlugs()) {
      entries.push({ url: `${SITE_URL}/projects/${encodeURIComponent(slug)}`, lastModified: updatedAt, changeFrequency: "monthly", priority: 0.7 });
    }
  } catch {
    // Database unavailable: still serve the home page entry.
  }
  return entries;
}

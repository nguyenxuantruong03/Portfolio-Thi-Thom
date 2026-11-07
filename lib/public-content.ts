import { getProjectBySlug, listPublicFeatured, listPublicProjectCards, listQuickItems } from "@/lib/content-repository";
import type {
  FeaturedContent,
  MediaAsset,
  ProjectContent,
  QuickItem,
  QuickSection,
} from "@/lib/content-types";
import type { Project } from "@/lib/data";
import { optimizedVideoUrl } from "@/lib/media";

export type PublishedProject = Project & {
  media: MediaAsset[];
  contentHtml?: string;
  content?: ProjectContent["content"];
};

export async function getPublishedFeatured(): Promise<FeaturedContent[]> {
  try {
    return await listPublicFeatured();
  } catch {
    return [];
  }
}

export async function getPublishedProjects(): Promise<Project[]> {
  try {
    return (await listPublicProjectCards()).map(toProject);
  } catch {
    return [];
  }
}

export async function getPublishedQuickItems(section: QuickSection): Promise<QuickItem[]> {
  try {
    return await listQuickItems(section, false);
  } catch {
    return [];
  }
}

/** One project by slug, with a single indexed query instead of loading the whole list. */
export async function getPublishedProject(slug: string): Promise<PublishedProject | null> {
  try {
    const row = await getProjectBySlug(slug);
    return row ? toPublishedProject(row) : null;
  } catch {
    return null;
  }
}

function toProject(row: ProjectContent): Project {
  // Normalize category at the public boundary so legacy/null values never make
  // Professional projects disappear from the Professional section.
  const category = row.category === "professional" ? "professional" : "personal";
  const selectedCardMedia = row.cardImage ?? null;
  const firstImage = selectedCardMedia?.resourceType === "image"
    ? selectedCardMedia
    : row.media.find((asset) => asset.resourceType === "image") ?? null;

  const firstVideo = selectedCardMedia?.resourceType === "video"
    ? selectedCardMedia
    : row.media.find((asset) => asset.resourceType === "video") ?? null;

  return {
    id: row.slug,
    category,
    clientName: row.clientName,
    projectRole: row.projectRole,
    projectPeriod: row.projectPeriod,
    externalUrl: row.externalUrl,
    cardMediaLink: row.cardImage?.link || undefined,
    link: row.externalUrl || undefined,
    label: row.label,
    eyebrow: row.eyebrow,
    title: row.title,
    subtitle: row.subtitle,
    overview: row.excerpt ?? "",
    tags: row.tags,
    image: firstImage?.url ?? "",
    videoUrl: firstVideo ? optimizedVideoUrl(firstVideo.url) : undefined,
  };
}

function toPublishedProject(row: ProjectContent): PublishedProject {
  return {
    ...toProject(row),
    media: row.media,
    content: row.content,
    contentHtml: row.contentHtml ?? "",
  };
}

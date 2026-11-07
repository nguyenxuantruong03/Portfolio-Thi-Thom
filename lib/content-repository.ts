import { query, withTransaction } from "@/lib/db";
import type { FeaturedContent, ProjectCategory, ProjectContent, QuickItem, QuickSection, RichContent } from "@/lib/content-types";

export type { FeaturedContent, ProjectContent, QuickItem, RichContent } from "@/lib/content-types";

type FeaturedRow = {
  id: string;
  label: string;
  topic: string;
  title: string;
  excerpt: string | null;
  content: RichContent;
  content_html: string;
  media: ProjectContent["media"];
  sort_order: number;
  published: boolean;
  created_at: Date;
  updated_at: Date;
};

type ProjectRow = {
  id: string;
  category: ProjectCategory | null;
  client_name: string | null;
  project_role: string | null;
  project_period: string | null;
  external_url: string | null;
  slug: string;
  label: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  excerpt: string | null;
  content: RichContent;
  content_html: string;
  media: ProjectContent["media"];
  card_image: ProjectContent["cardImage"];
  tags: string[];
  sort_order: number;
  published: boolean;
  created_at: Date;
  updated_at: Date;
};

function date(value: Date) {
  return value.toISOString();
}

function featured(row: FeaturedRow): FeaturedContent {
  return {
    id: row.id,
    label: row.label,
    topic: row.topic,
    title: row.title,
    excerpt: row.excerpt ?? undefined,
    content: row.content,
    contentHtml: row.content_html,
    media: row.media ?? [],
    sortOrder: row.sort_order,
    published: row.published,
    createdAt: date(row.created_at),
    updatedAt: date(row.updated_at),
  };
}

function project(row: ProjectRow): ProjectContent {
  return {
    id: row.id,
    category: row.category ?? "personal",
    clientName: row.client_name ?? "",
    projectRole: row.project_role ?? "",
    projectPeriod: row.project_period ?? "",
    externalUrl: row.external_url ?? "",
    slug: row.slug,
    label: row.label,
    eyebrow: row.eyebrow,
    title: row.title,
    subtitle: row.subtitle,
    excerpt: row.excerpt ?? undefined,
    content: row.content,
    contentHtml: row.content_html,
    media: row.media ?? [],
    cardImage: row.card_image ?? null,
    tags: row.tags ?? [],
    sortOrder: row.sort_order,
    published: row.published,
    createdAt: date(row.created_at),
    updatedAt: date(row.updated_at),
  };
}

export async function listFeatured(includeUnpublished = false) {
  const where = includeUnpublished ? "" : "WHERE published = true";
  const result = await query<FeaturedRow>(
    `SELECT * FROM portfolio_featured ${where} ORDER BY sort_order ASC, created_at ASC`,
  );
  return result.rows.map(featured);
}

export async function listProjects(includeUnpublished = false) {
  const where = includeUnpublished ? "" : "WHERE published = true";
  const result = await query<ProjectRow>(
    `SELECT * FROM portfolio_projects ${where} ORDER BY sort_order ASC, created_at ASC`,
  );
  return result.rows.map(project);
}

/**
 * Public list queries.
 * The home page only needs card fields. `content` / `content_html` (full rich text) can be large and
 * would otherwise be serialized into the page for every visitor, so they are not selected here.
 */
type FeaturedCardRow = Pick<FeaturedRow, "id" | "label" | "topic" | "title" | "excerpt" | "media" | "sort_order" | "published" | "created_at" | "updated_at">;
type ProjectCardRow = Pick<ProjectRow, "id" | "category" | "client_name" | "project_role" | "project_period" | "external_url" | "slug" | "label" | "eyebrow" | "title" | "subtitle" | "excerpt" | "media" | "card_image" | "tags" | "sort_order" | "published" | "created_at" | "updated_at">;

const EMPTY_DOC = { type: "doc", content: [] } as RichContent;

export async function listPublicFeatured(): Promise<FeaturedContent[]> {
  const result = await query<FeaturedCardRow>(
    `SELECT id, label, topic, title, excerpt, media, sort_order, published, created_at, updated_at
     FROM portfolio_featured WHERE published = true ORDER BY sort_order ASC, created_at ASC`,
  );
  return result.rows.map((row) => featured({ ...row, content: EMPTY_DOC, content_html: "" }));
}

export async function listPublicProjectCards(): Promise<ProjectContent[]> {
  const result = await query<ProjectCardRow>(
    `SELECT id, category, client_name, project_role, project_period, external_url, slug, label, eyebrow, title, subtitle, excerpt, media, card_image, tags, sort_order, published, created_at, updated_at
     FROM portfolio_projects
     WHERE published = true
     ORDER BY sort_order ASC, created_at ASC`,
  );
  return result.rows.map((row) => project({ ...row, content: EMPTY_DOC, content_html: "" }));
}

/** Slugs for the sitemap and static generation (no payload). */
export async function listPublishedSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const result = await query<{ slug: string; updated_at: Date }>(
    "SELECT slug, updated_at FROM portfolio_projects WHERE published = true ORDER BY sort_order ASC",
  );
  return result.rows.map((row) => ({ slug: row.slug, updatedAt: date(row.updated_at) }));
}

export async function getProjectBySlug(slug: string) {
  const result = await query<ProjectRow>(
    "SELECT * FROM portfolio_projects WHERE slug = $1 AND published = true LIMIT 1",
    [slug],
  );
  return result.rows[0] ? project(result.rows[0]) : null;
}

export async function createFeatured(
  input: Omit<FeaturedContent, "createdAt" | "updatedAt">,
) {
  const result = await query<FeaturedRow>(
    `INSERT INTO portfolio_featured (id, label, topic, title, excerpt, content, content_html, media, sort_order, published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      input.id,
      input.label,
      input.topic,
      input.title,
      input.excerpt ?? null,
      JSON.stringify(input.content),
      input.contentHtml,
      JSON.stringify(input.media),
      input.sortOrder,
      input.published,
    ],
  );
  return featured(result.rows[0]);
}

const FEATURED_UPDATE_COLUMNS: Record<string, string> = {
  label: "label",
  topic: "topic",
  title: "title",
  excerpt: "excerpt",
  content: "content",
  contentHtml: "content_html",
  media: "media",
  sortOrder: "sort_order",
  published: "published",
};

const PROJECT_UPDATE_COLUMNS: Record<string, string> = {
  slug: "slug",
  category: "category",
  clientName: "client_name",
  projectRole: "project_role",
  projectPeriod: "project_period",
  externalUrl: "external_url",
  label: "label",
  eyebrow: "eyebrow",
  title: "title",
  subtitle: "subtitle",
  excerpt: "excerpt",
  content: "content",
  contentHtml: "content_html",
  media: "media",
  cardImage: "card_image",
  tags: "tags",
  sortOrder: "sort_order",
  published: "published",
};

function buildUpdate(
  input: Record<string, unknown>,
  allowed: Record<string, string>,
) {
  const keys = Object.keys(input).filter((key) =>
    Object.prototype.hasOwnProperty.call(allowed, key),
  );
  const values: unknown[] = [];
  const sets = keys.map((key, index) => {
    const value = input[key];
    values.push(
      key === "content" || key === "media" || key === "cardImage" ? JSON.stringify(value) : value,
    );
    return `${allowed[key]} = $${index + 1}`;
  });
  return { keys, values, sets };
}

export async function updateFeatured(
  id: string,
  input: Partial<Omit<FeaturedContent, "id" | "createdAt" | "updatedAt">>,
) {
  const { keys, values, sets } = buildUpdate(
    input as Record<string, unknown>,
    FEATURED_UPDATE_COLUMNS,
  );
  if (!keys.length) {
    const result = await query<FeaturedRow>(
      "SELECT * FROM portfolio_featured WHERE id=$1",
      [id],
    );
    return result.rows[0] ? featured(result.rows[0]) : null;
  }
  values.push(id);
  const result = await query<FeaturedRow>(
    `UPDATE portfolio_featured SET ${sets.join(", ")}, updated_at = now() WHERE id=$${values.length} RETURNING *`,
    values,
  );
  return result.rows[0] ? featured(result.rows[0]) : null;
}

export async function deleteFeatured(id: string) {
  return (
    (await query("DELETE FROM portfolio_featured WHERE id=$1", [id]))
      .rowCount === 1
  );
}

export async function createProject(
  input: Omit<ProjectContent, "createdAt" | "updatedAt">,
) {
  const result = await query<ProjectRow>(
    `INSERT INTO portfolio_projects (id,slug,label,eyebrow,title,subtitle,excerpt,content,content_html,media,card_image,tags,sort_order,published,category,client_name,project_role,project_period,external_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
    [
      input.id,
      input.slug,
      input.label,
      input.eyebrow,
      input.title,
      input.subtitle,
      input.excerpt ?? null,
      JSON.stringify(input.content),
      input.contentHtml,
      JSON.stringify(input.media),
      JSON.stringify(input.cardImage ?? null),
      input.tags,
      input.sortOrder,
      input.published,
      input.category ?? "personal",
      input.clientName ?? "",
      input.projectRole ?? "",
      input.projectPeriod ?? "",
      input.externalUrl ?? null,
    ],
  );
  return project(result.rows[0]);
}

export async function updateProject(
  id: string,
  input: Partial<Omit<ProjectContent, "id" | "createdAt" | "updatedAt">>,
) {
  const { keys, values, sets } = buildUpdate(
    input as Record<string, unknown>,
    PROJECT_UPDATE_COLUMNS,
  );
  if (!keys.length) {
    const result = await query<ProjectRow>(
      "SELECT * FROM portfolio_projects WHERE id=$1",
      [id],
    );
    return result.rows[0] ? project(result.rows[0]) : null;
  }
  values.push(id);
  const result = await query<ProjectRow>(
    `UPDATE portfolio_projects SET ${sets.join(", ")}, updated_at=now() WHERE id=$${values.length} RETURNING *`,
    values,
  );
  return result.rows[0] ? project(result.rows[0]) : null;
}

export async function deleteProject(id: string) {
  return (
    (await query("DELETE FROM portfolio_projects WHERE id=$1", [id]))
      .rowCount === 1
  );
}

export async function reorder(kind: "featured" | "projects", ids: string[]) {
  const table =
    kind === "featured" ? "portfolio_featured" : "portfolio_projects";
  return withTransaction(async (client) => {
    for (const [index, id] of ids.entries()) {
      await client.query(
        `UPDATE ${table} SET sort_order=$1, updated_at=now() WHERE id=$2`,
        [index, id],
      );
    }
  });
}


/* ---------- Quick-add sections: Professional Projects & 2D Graphic Design ---------- */

type QuickRow = {
  id: string;
  section: QuickSection;
  title: string;
  label: string;
  subtitle: string;
  excerpt: string | null;
  link_url: string | null;
  tags: string[];
  media: QuickItem["media"];
  sort_order: number;
  published: boolean;
  created_at: Date;
  updated_at: Date;
};

function quick(row: QuickRow): QuickItem {
  return {
    id: row.id,
    section: row.section,
    title: row.title,
    label: row.label,
    subtitle: row.subtitle,
    excerpt: row.excerpt ?? undefined,
    linkUrl: row.link_url ?? undefined,
    tags: row.tags ?? [],
    media: row.media ?? [],
    sortOrder: row.sort_order,
    published: row.published,
    createdAt: date(row.created_at),
    updatedAt: date(row.updated_at),
  };
}

export async function listQuickItems(section?: QuickSection, includeUnpublished = false) {
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (section) {
    values.push(section);
    conditions.push(`section = $${values.length}`);
  }
  if (!includeUnpublished) conditions.push("published = true");
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await query<QuickRow>(
    `SELECT * FROM portfolio_quick_items ${where} ORDER BY sort_order ASC, created_at ASC`,
    values,
  );
  return result.rows.map(quick);
}

export async function createQuickItem(
  input: Omit<QuickItem, "createdAt" | "updatedAt" | "sortOrder"> & { sortOrder?: number },
) {
  const result = await query<QuickRow>(
    `INSERT INTO portfolio_quick_items (id, section, title, label, subtitle, excerpt, link_url, tags, media, sort_order, published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
       COALESCE($10::integer, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM portfolio_quick_items WHERE section = $2)),
       $11)
     RETURNING *`,
    [
      input.id,
      input.section,
      input.title,
      input.label,
      input.subtitle,
      input.excerpt?.trim() || null,
      input.linkUrl?.trim() || null,
      input.tags,
      JSON.stringify(input.media),
      input.sortOrder ?? null,
      input.published,
    ],
  );
  return quick(result.rows[0]);
}

const QUICK_UPDATE_COLUMNS: Record<string, string> = {
  title: "title",
  label: "label",
  subtitle: "subtitle",
  excerpt: "excerpt",
  linkUrl: "link_url",
  tags: "tags",
  media: "media",
  sortOrder: "sort_order",
  published: "published",
};

export async function updateQuickItem(
  id: string,
  input: Partial<Omit<QuickItem, "id" | "section" | "createdAt" | "updatedAt">>,
) {
  const normalized: Record<string, unknown> = { ...input };
  if ("excerpt" in normalized) normalized.excerpt = (input.excerpt ?? "").trim() || null;
  if ("linkUrl" in normalized) normalized.linkUrl = (input.linkUrl ?? "").trim() || null;
  const { keys, values, sets } = buildUpdate(normalized, QUICK_UPDATE_COLUMNS);
  if (!keys.length) {
    const result = await query<QuickRow>("SELECT * FROM portfolio_quick_items WHERE id=$1", [id]);
    return result.rows[0] ? quick(result.rows[0]) : null;
  }
  // buildUpdate JSON-encodes content/media/cardImage already; media is the only JSON column here.
  values.push(id);
  const result = await query<QuickRow>(
    `UPDATE portfolio_quick_items SET ${sets.join(", ")}, updated_at=now() WHERE id=$${values.length} RETURNING *`,
    values,
  );
  return result.rows[0] ? quick(result.rows[0]) : null;
}

export async function deleteQuickItem(id: string) {
  return (await query("DELETE FROM portfolio_quick_items WHERE id=$1", [id])).rowCount === 1;
}

export async function reorderQuickItems(section: QuickSection, ids: string[]) {
  return withTransaction(async (client) => {
    for (const [index, id] of ids.entries()) {
      await client.query(
        "UPDATE portfolio_quick_items SET sort_order=$1, updated_at=now() WHERE id=$2 AND section=$3",
        [index, id, section],
      );
    }
  });
}

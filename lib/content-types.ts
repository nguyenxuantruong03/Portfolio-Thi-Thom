import type { JSONContent } from "@tiptap/core";

export type MediaAsset = {
  id: string;
  url: string;
  publicId: string;
  resourceType: "image" | "video" | "raw";
  format?: string;
  width?: number;
  height?: number;
  duration?: number;
  alt?: string;
  /** Optional click-through URL when this asset is used as a project card media. */
  link?: string;
};

export type RichContent = JSONContent;

export type FeaturedContent = {
  id: string;
  label: string;
  topic: string;
  title: string;
  excerpt?: string;
  content: RichContent;
  contentHtml: string;
  media: MediaAsset[];
  sortOrder: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Personal and Professional projects share one rich-content model and detail page. */
export type ProjectCategory = "personal" | "professional";

export type ProjectContent = {
  id: string;
  category: ProjectCategory;
  clientName?: string;
  projectRole?: string;
  projectPeriod?: string;
  externalUrl?: string;
  slug: string;
  label: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  excerpt?: string;
  content: RichContent;
  contentHtml: string;
  media: MediaAsset[];
  cardImage?: MediaAsset | null;
  tags: string[];
  sortOrder: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

/** The 2D image gallery remains a quick-add section; Professional projects use ProjectContent. */
export type QuickSection = "professional" | "design2d";

export type QuickItem = {
  id: string;
  section: QuickSection;
  title: string;
  /** professional: client / type badge. design2d: unused. */
  label: string;
  /** professional: one-line subtitle. design2d: unused. */
  subtitle: string;
  excerpt?: string;
  /** Optional external link (professional only). */
  linkUrl?: string;
  /** professional: tags. design2d: design categories shown as "Menu Design · Print Design". */
  tags: string[];
  /** The first image is the cover. design2d: every image is shown in the lightbox. */
  media: MediaAsset[];
  sortOrder: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

import { z } from "zod";

const JSONPrimitiveSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const JSONContentSchema: z.ZodType<import("@tiptap/core").JSONContent> =
  z.lazy(() =>
    z.object({
      type: z.string().optional(),
      attrs: z.record(z.string(), z.unknown()).optional(),
      content: z.array(JSONContentSchema).optional(),
      marks: z
        .array(
          z.object({
            type: z.string(),
            attrs: z.record(z.string(), z.unknown()).optional(),
          }),
        )
        .optional(),
      text: z.string().optional(),
      ...{},
    }),
  );

export const RichContentSchema = JSONContentSchema.refine(
  (value) => value.type === "doc",
  {
    message: "CONTENT_ROOT_MUST_BE_DOC",
  },
);

export const ContentMediaSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  publicId: z.string().min(1),
  resourceType: z.enum(["image", "video", "raw"]),
  format: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  duration: z.number().optional(),
  alt: z.string().optional(),
  link: z.string().url().or(z.literal("")).optional(),
});

const featuredItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  topic: z.string().min(1),
  title: z.string().min(1),
  excerpt: z.string().optional(),
  content: RichContentSchema,
  contentHtml: z.string(),
  media: z.array(ContentMediaSchema).default([]),
  sortOrder: z.number().int(),
  published: z.boolean(),
});

const projectItemSchema = z.object({
  id: z.string().min(1),
  category: z.enum(["personal", "professional"]).default("personal"),
  clientName: z.string().optional(),
  projectRole: z.string().optional(),
  projectPeriod: z.string().optional(),
  externalUrl: z.string().url().or(z.literal("")).optional(),
  slug: z.string().min(1),
  label: z.string().min(1),
  eyebrow: z.string().default(""),
  title: z.string().min(1),
  subtitle: z.string().default(""),
  excerpt: z.string().optional(),
  content: RichContentSchema,
  contentHtml: z.string(),
  media: z.array(ContentMediaSchema).default([]),
  cardImage: ContentMediaSchema.nullable().optional(),
  tags: z.array(z.string()).default([]),
  sortOrder: z.number().int(),
  published: z.boolean(),
});

export const adminContentPostSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("featured"),
    item: featuredItemSchema,
  }),
  z.object({
    type: z.literal("projects"),
    item: projectItemSchema,
  }),
]);

const featuredPatchSchema = featuredItemSchema.omit({ id: true }).partial();

const projectPatchSchema = projectItemSchema.omit({ id: true }).partial();

export const adminContentPatchSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("featured"),
    id: z.string().min(1),
    patch: featuredPatchSchema,
  }),
  z.object({
    type: z.literal("projects"),
    id: z.string().min(1),
    patch: projectPatchSchema,
  }),
  z.object({
    type: z.literal("reorder"),
    kind: z.enum(["featured", "projects"]),
    ids: z.array(z.string().min(1)),
  }),
]);

export const adminContentDeleteSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("featured"),
    id: z.string().min(1),
  }),
  z.object({
    type: z.literal("projects"),
    id: z.string().min(1),
  }),
]);

const optionalUrl = z
  .string()
  .trim()
  .refine((value) => value === "" || /^https?:\/\//i.test(value), { message: "LINK_MUST_START_WITH_HTTP" })
  .optional();

const quickItemSchema = z.object({
  id: z.string().min(1),
  section: z.enum(["professional", "design2d"]),
  title: z.string().trim().min(1),
  label: z.string().trim().default(""),
  subtitle: z.string().trim().default(""),
  excerpt: z.string().optional(),
  linkUrl: optionalUrl,
  tags: z.array(z.string()).default([]),
  media: z.array(ContentMediaSchema).default([]),
  sortOrder: z.number().int().optional(),
  published: z.boolean().default(true),
});

export const quickPostSchema = z.object({ item: quickItemSchema });

export const quickPatchSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("update"),
    id: z.string().min(1),
    patch: quickItemSchema.omit({ id: true, section: true }).partial(),
  }),
  z.object({
    type: z.literal("reorder"),
    section: z.enum(["professional", "design2d"]),
    ids: z.array(z.string().min(1)),
  }),
]);

export const quickDeleteSchema = z.object({ id: z.string().min(1) });

# Thị Thơm Portfolio

Next.js 16.4 · TypeScript · Tailwind CSS 4 · PostgreSQL (Neon) · Cloudinary.

## Sections

Hero · About · Experience · Featured · Personal Projects · Professional Projects · 2D Graphic Design · Contact.
Content is managed in the CMS at `/admin/content`.

## Run

```bash
npm install
npm run db:migrate   # create / update tables
npm run dev
```

Copy your own `.env` (never commit it). Needed: `DATABASE_URL`, `PORTFOLIO_ADMIN_PASSWORD`,
`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `NEXT_PUBLIC_SITE_URL`
(used for canonical URLs, Open Graph and the sitemap), plus the contact and TikTok variables.

## Performance and SEO notes

- Home and project pages are cached (`revalidate = 60`) and are also refreshed right after every CMS save.
- Fonts: The public site uses local/system font fallbacks so production builds do not depend on Google Fonts at build time. The extra editor fonts
  (Inter, Roboto, Lora …) load only in the CMS and on project pages that actually use them.
- Cloudinary images are requested as `f_auto,q_auto,w_<size>` (see `lib/media.ts`); the full-size file is only
  loaded when a visitor opens the lightbox.
- Public queries select only card fields; full rich text is read only on the project detail page.
- SEO: page metadata, Open Graph / Twitter cards, canonical URLs, `sitemap.xml`, `robots.txt` and JSON-LD
  (`Person` on the home page, `CreativeWork` on project pages). `/admin` is `noindex`.
- Upload: photos are lightly compressed in the browser before going to Cloudinary (`compressImage` in
  `app/admin/content/editor.tsx`): long edge ≤ 2200 px, JPEG kept as JPEG, PNG/WebP → high-quality WebP, small files untouched.
- CMS: create / edit / delete / reorder buttons stay disabled until the data has finished loading.

## Project categories

Personal and Professional Projects are managed together in the CMS under **All Projects**. Choose the category in each project editor. Professional projects additionally support client/organization, role, period, and an external project URL. Run `npm run db:migrate` to apply migration `008_unified_project_categories.sql`; the migration preserves existing Professional Project quick items while moving them into the shared rich project model. The 2D Graphic Design gallery remains separate.

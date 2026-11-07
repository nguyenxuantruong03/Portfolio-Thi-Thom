-- 2D Graphic Design remains a quick-add gallery (images only).
-- Professional Projects now share portfolio_projects with Personal Projects and must never be
-- moved out of that table by a repeated migration run.
CREATE TABLE IF NOT EXISTS portfolio_quick_items (
  id text PRIMARY KEY,
  section text NOT NULL CHECK (section IN ('professional', 'design2d')),
  title text NOT NULL,
  label text NOT NULL DEFAULT '',
  subtitle text NOT NULL DEFAULT '',
  excerpt text,
  link_url text,
  tags text[] NOT NULL DEFAULT '{}',
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portfolio_quick_items_section_sort_idx
  ON portfolio_quick_items(section, sort_order);

-- Only 2D gallery entries are moved. Professional entries are managed in portfolio_projects.
INSERT INTO portfolio_quick_items (id, section, title, label, subtitle, excerpt, tags, media, sort_order, published, created_at, updated_at)
SELECT
  id,
  'design2d',
  title,
  '',
  '',
  NULL,
  tags,
  CASE
    WHEN card_image IS NOT NULL
      AND jsonb_typeof(card_image) = 'object'
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(media) AS m WHERE m ->> 'id' = card_image ->> 'id'
      )
    THEN jsonb_build_array(card_image) || media
    ELSE media
  END,
  sort_order,
  published,
  created_at,
  updated_at
FROM portfolio_projects
WHERE category = 'design2d'
ON CONFLICT (id) DO NOTHING;

DELETE FROM portfolio_projects WHERE category = 'design2d';

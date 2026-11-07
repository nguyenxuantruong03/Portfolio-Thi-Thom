-- Unify Personal and Professional Projects in portfolio_projects.
ALTER TABLE portfolio_projects ADD COLUMN IF NOT EXISTS client_name text NOT NULL DEFAULT '';
ALTER TABLE portfolio_projects ADD COLUMN IF NOT EXISTS project_role text NOT NULL DEFAULT '';
ALTER TABLE portfolio_projects ADD COLUMN IF NOT EXISTS project_period text NOT NULL DEFAULT '';
ALTER TABLE portfolio_projects ADD COLUMN IF NOT EXISTS external_url text;

-- Bring legacy Professional Project quick items back into the shared rich project model.
INSERT INTO portfolio_projects (
  id, slug, label, eyebrow, title, subtitle, excerpt, content, content_html,
  media, card_image, tags, sort_order, published, category,
  client_name, project_role, external_url, created_at, updated_at
)
SELECT
  q.id,
  'professional-' || left(md5(q.id), 12),
  COALESCE(NULLIF(q.label, ''), 'Professional Project'),
  '',
  q.title,
  q.subtitle,
  q.excerpt,
  jsonb_build_object('type','doc','content', CASE WHEN COALESCE(q.excerpt, '') <> '' THEN jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text',q.excerpt)))) ELSE '[]'::jsonb END),
  '',
  q.media,
  CASE WHEN jsonb_typeof(q.media) = 'array' AND jsonb_array_length(q.media) > 0 THEN q.media->0 ELSE NULL END,
  q.tags,
  q.sort_order,
  q.published,
  'professional',
  q.label,
  q.subtitle,
  q.link_url,
  q.created_at,
  q.updated_at
FROM portfolio_quick_items q
WHERE q.section = 'professional'
ON CONFLICT (id) DO NOTHING;

DELETE FROM portfolio_quick_items WHERE section = 'professional';

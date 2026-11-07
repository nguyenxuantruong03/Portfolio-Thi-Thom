CREATE TABLE IF NOT EXISTS portfolio_featured (
  id text PRIMARY KEY,
  topic text NOT NULL,
  title text NOT NULL,
  excerpt text,
  content jsonb NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
  content_html text NOT NULL DEFAULT '',
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portfolio_projects (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  eyebrow text NOT NULL,
  title text NOT NULL,
  subtitle text NOT NULL,
  excerpt text,
  content jsonb NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
  content_html text NOT NULL DEFAULT '',
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portfolio_featured_sort_idx ON portfolio_featured(sort_order);
CREATE INDEX IF NOT EXISTS portfolio_projects_sort_idx ON portfolio_projects(sort_order);
CREATE INDEX IF NOT EXISTS portfolio_projects_published_idx ON portfolio_projects(published);

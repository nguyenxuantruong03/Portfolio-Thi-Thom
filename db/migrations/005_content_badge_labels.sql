-- Customizable public badge labels for Featured and Project cards.
ALTER TABLE portfolio_featured
  ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT 'Featured';

ALTER TABLE portfolio_projects
  ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT 'Project';

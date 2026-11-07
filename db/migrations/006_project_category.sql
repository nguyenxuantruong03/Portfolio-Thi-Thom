-- Project categories: personal and professional share portfolio_projects; design2d stays in quick items.
ALTER TABLE portfolio_projects
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'personal';

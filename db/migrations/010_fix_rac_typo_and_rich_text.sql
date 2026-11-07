-- Fix the known Personal Project typo: "Rấ c" / "Rấ  c" -> "Rấc".
-- Also normalize newline characters in stored HTML where possible.
UPDATE portfolio_projects
SET
  title = regexp_replace(title, 'Rấ\s+c', 'Rấc', 'gi'),
  subtitle = regexp_replace(subtitle, 'Rấ\s+c', 'Rấc', 'gi'),
  excerpt = regexp_replace(excerpt, 'Rấ\s+c', 'Rấc', 'gi'),
  content_html = regexp_replace(content_html, 'Rấ\s+c', 'Rấc', 'gi'),
  content = regexp_replace(content::text, 'Rấ\s+c', 'Rấc', 'gi')::jsonb,
  updated_at = now()
WHERE title ~* 'Rấ\s+c'
   OR subtitle ~* 'Rấ\s+c'
   OR excerpt ~* 'Rấ\s+c'
   OR content_html ~* 'Rấ\s+c'
   OR content::text ~* 'Rấ\s+c';

-- Editorial polish: use concise English category labels across the portfolio.
-- Only category labels are updated; project titles, stories and uploaded media stay untouched.
UPDATE portfolio_projects SET eyebrow = CASE id
  WHEN 'expert-branding' THEN 'Client Project · Personal Branding'
  WHEN 'filmer' THEN 'Client Project · Video Editing'
  WHEN 'tiktok' THEN 'Personal Project · TikTok · THITHOMM'
  WHEN 'food' THEN 'Personal Project · Food & Lifestyle'
  WHEN 'fly' THEN 'Personal Project · Travel Content'
  WHEN 'hotel' THEN 'Personal Project · Hospitality'
  WHEN 'yacht' THEN 'Personal Project · Luxury Lifestyle'
  ELSE eyebrow END
WHERE id IN ('expert-branding','filmer','tiktok','food','fly','hotel','yacht');

UPDATE portfolio_featured SET topic = CASE id
  WHEN 'featured-01' THEN 'Personal TikTok'
  WHEN 'featured-02' THEN 'Personal Branding'
  WHEN 'featured-03' THEN 'Video Editing'
  WHEN 'featured-04' THEN 'Food & Lifestyle'
  WHEN 'featured-05' THEN 'Creative Process'
  ELSE topic END
WHERE id IN ('featured-01','featured-02','featured-03','featured-04','featured-05');

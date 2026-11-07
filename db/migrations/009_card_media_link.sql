-- Move legacy project external URLs onto the project card media itself.
-- The card media link is now the only public click-through source for the card image/video.
UPDATE portfolio_projects
SET card_image =
  CASE
    WHEN jsonb_typeof(card_image) = 'object'
      THEN card_image || jsonb_build_object('link', external_url)
    WHEN jsonb_typeof(media) = 'array' AND jsonb_array_length(media) > 0
      THEN (media->0) || jsonb_build_object('link', external_url)
    ELSE card_image
  END
WHERE external_url IS NOT NULL
  AND btrim(external_url) <> ''
  AND (
    card_image IS NULL
    OR jsonb_typeof(card_image) <> 'object'
    OR COALESCE(card_image->>'link', '') = ''
  );

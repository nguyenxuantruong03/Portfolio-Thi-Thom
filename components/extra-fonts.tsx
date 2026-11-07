/**
 * Fonts that only the rich-text editor can apply (Inter, Roboto, Lora …).
 * They are NOT loaded on the home page any more (that saved nine render-blocking font families).
 * Pages that can contain them load only the families they actually use.
 */
const FAMILIES: Record<string, string> = {
  "Be Vietnam Pro": "Be+Vietnam+Pro:wght@400;500;600;700",
  "Playfair Display": "Playfair+Display:ital,wght@0,400;0,700;1,400;1,700",
  Inter: "Inter:wght@400;500;600;700",
  Roboto: "Roboto:wght@400;500;700",
  "Open Sans": "Open+Sans:wght@400;600;700",
  Montserrat: "Montserrat:wght@400;500;600;700",
  Nunito: "Nunito:wght@400;600;700",
  Quicksand: "Quicksand:wght@400;500;600;700",
  Lora: "Lora:wght@400;500;600;700",
  Merriweather: "Merriweather:wght@400;700",
};

/** Which of the editor fonts appear inside saved rich-text HTML. */
export function fontsUsedIn(html: string | undefined | null): string[] {
  if (!html) return [];
  return Object.keys(FAMILIES).filter((name) => html.includes(name));
}

export function ExtraFonts({ families }: { families: string[] }) {
  const query = families.map((name) => FAMILIES[name]).filter(Boolean);
  if (!query.length) return null;
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${query.map((entry) => `family=${entry}`).join("&")}&display=swap`} />
    </>
  );
}

export const ALL_EDITOR_FONTS = Object.keys(FAMILIES);

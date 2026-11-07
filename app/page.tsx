import { getPortfolioData } from "@/lib/data";
import { getPublishedProjects, getPublishedQuickItems } from "@/lib/public-content";
import { HomeContent } from "@/components/home-content";
import { SITE_DESCRIPTION, SITE_IMAGE, SITE_NAME, SITE_URL } from "@/lib/site";

// The page is built once and served from cache (fast + crawlable), then refreshed at most once a minute.
// Saving in the CMS also refreshes it immediately (see revalidatePath in /api/admin/*).
export const revalidate = 60;

export default async function Home() {
  const data = await getPortfolioData();
  const [projects, design] = await Promise.all([
    getPublishedProjects(),
    getPublishedQuickItems("design2d"),
  ]);

  const tiktok = process.env.NEXT_PUBLIC_TIKTOK_URL;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: SITE_NAME,
    url: SITE_URL,
    image: `${SITE_URL}${SITE_IMAGE}`,
    jobTitle: "Content Creator",
    description: SITE_DESCRIPTION,
    alumniOf: { "@type": "CollegeOrUniversity", name: data.education },
    knowsAbout: ["TikTok", "Short-form video", "Content creation", "Graphic design"],
    ...(tiktok ? { sameAs: [tiktok] } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // "<" is escaped so the JSON can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <HomeContent data={data} projects={projects} designItems={design} />
    </>
  );
}

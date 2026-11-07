import type { Metadata } from "next";
import { ALL_EDITOR_FONTS, ExtraFonts } from "@/components/extra-fonts";

// The CMS is private: keep it out of search results and load the editor fonts only here.
export const metadata: Metadata = {
  title: "Portfolio CMS",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ExtraFonts families={ALL_EDITOR_FONTS} />
      {children}
    </>
  );
}

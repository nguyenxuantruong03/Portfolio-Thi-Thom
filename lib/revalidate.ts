import { revalidatePath } from "next/cache";

/** Make the cached public pages pick up CMS changes on the next visit. */
export function refreshPublicPages() {
  try {
    revalidatePath("/");
    revalidatePath("/projects/[id]", "page");
    revalidatePath("/sitemap.xml");
  } catch (error) {
    console.error("refreshPublicPages failed:", error);
  }
}

/** Wraps a mutating route handler: after a successful (2xx) response the public pages are refreshed. */
export function withRefresh(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    const response = await handler(request);
    if (response.ok) refreshPublicPages();
    return response;
  };
}

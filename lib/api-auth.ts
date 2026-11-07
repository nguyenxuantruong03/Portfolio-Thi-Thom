import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminSessionValid } from "@/lib/admin-auth";

export async function requireAdmin() {
  const cookie = (await cookies()).get(ADMIN_COOKIE)?.value;
  return isAdminSessionValid(cookie);
}

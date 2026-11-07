import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "portfolio_admin";

function configuredToken() {
  return process.env.FEATURED_CONTENT_ADMIN_TOKEN ?? process.env.PORTFOLIO_ADMIN_TOKEN ?? process.env.PORTFOLIO_ADMIN_PASSWORD ?? "";
}

export function isAdminPasswordValid(password: string) {
  const configured = process.env.PORTFOLIO_ADMIN_PASSWORD ?? "";
  if (!configured || !password) return false;
  const expected = Buffer.from(configured);
  const actual = Buffer.from(password);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function getAdminSessionValue() {
  const token = configuredToken();
  if (!token) return "";
  return createHmac("sha256", token).update("portfolio-admin-session-v1").digest("hex");
}

export function isAdminSessionValid(value: string | undefined) {
  const expected = getAdminSessionValue();
  if (!expected || !value) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(value);
  return a.length === b.length && timingSafeEqual(a, b);
}

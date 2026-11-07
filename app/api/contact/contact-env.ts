import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

let loaded = false;

export function getContactEnv() {
  if (!loaded) {
    // Explicitly load .env.local/.env.* for this API route. Next normally does
    // this automatically, but doing it here makes the server-side contact
    // endpoint deterministic when the app is started from an unusual cwd.
    loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
    loaded = true;
  }

  return {
    apiUrl: process.env.CONTACT_API_URL || "https://api.resend.com/emails",
    apiKey: process.env.RESEND_API_KEY || process.env.CONTACT_API_KEY || "",
    from: process.env.CONTACT_FROM_EMAIL || "",
    to: process.env.CONTACT_TO_EMAIL || "",
  };
}

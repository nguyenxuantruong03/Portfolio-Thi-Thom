import { createHmac, randomBytes, timingSafeEqual, createCipheriv } from "node:crypto";
import { withTransaction } from "@/lib/db";

const STATE_COOKIE = "tiktok_oauth_state";
const STATE_TTL_SECONDS = 10 * 60;

export const TIKTOK_CHANNELS = [
  { key: "racxalo", handle: "@racxalo_", label: "Racxalo" },
  { key: "didouquaydo", handle: "@didouquaydo", label: "Didouquaydo" },
  { key: "thom-thuii", handle: "@thom.thuii", label: "Thom Thuii" },
  { key: "bcs-dr-nguyn", handle: "@bc.s.dr..nguyn", label: "BCS Dr Nguyen" },
] as const;

export type TikTokChannelKey = (typeof TIKTOK_CHANNELS)[number]["key"];
export { STATE_COOKIE, STATE_TTL_SECONDS };

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function sign(value: string) {
  return createHmac("sha256", requiredEnv("TIKTOK_CLIENT_SECRET")).update(value).digest("base64url");
}

export function createOAuthState(channel: TikTokChannelKey) {
  const payload = Buffer.from(JSON.stringify({
    channel,
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
    nonce: randomBytes(16).toString("hex"),
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyOAuthState(state: string) {
  const [payload, signature, extra] = state.split(".");
  if (!payload || !signature || extra) throw new Error("Invalid OAuth state.");
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("Invalid OAuth state signature.");
  }
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    channel?: string; exp?: number; nonce?: string;
  };
  if (!TIKTOK_CHANNELS.some((item) => item.key === decoded.channel)
      || !decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)
      || !decoded.nonce) throw new Error("OAuth state expired or invalid.");
  return decoded.channel as TikTokChannelKey;
}

function encryptToken(value: string) {
  const key = Buffer.from(requiredEnv("TIKTOK_TOKEN_ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) throw new Error("TIKTOK_TOKEN_ENCRYPTION_KEY must decode to 32 bytes.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}

type TikTokTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  open_id?: string;
  error?: string;
  error_description?: string;
};

export async function exchangeAuthorizationCode(code: string) {
  const redirectUri = requiredEnv("TIKTOK_REDIRECT_URI");
  const body = new URLSearchParams({
    client_key: requiredEnv("TIKTOK_CLIENT_KEY"),
    client_secret: requiredEnv("TIKTOK_CLIENT_SECRET"),
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json() as TikTokTokenResponse;
  if (!response.ok || !result.access_token || !result.refresh_token
      || !result.expires_in || !result.refresh_expires_in) {
    throw new Error(result.error_description || result.error || `TikTok token exchange failed (${response.status}).`);
  }
  return result;
}

export async function saveTikTokTokens(channel: TikTokChannelKey, token: TikTokTokenResponse) {
  if (!token.access_token || !token.refresh_token || !token.expires_in || !token.refresh_expires_in) {
    throw new Error("TikTok did not return a complete token response.");
  }
  // Copy narrowed values before entering the callback: TypeScript does not
  // preserve optional-property narrowing across the async closure.
  const accessToken = token.access_token;
  const refreshToken = token.refresh_token;
  const accessExpiresAt = new Date(Date.now() + token.expires_in * 1000);
  const refreshExpiresAt = new Date(Date.now() + token.refresh_expires_in * 1000);
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO portfolio_tiktok_tokens
        (channel_key, access_token_encrypted, refresh_token_encrypted, access_expires_at, refresh_expires_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,now())
       ON CONFLICT (channel_key) DO UPDATE SET
        access_token_encrypted=EXCLUDED.access_token_encrypted,
        refresh_token_encrypted=EXCLUDED.refresh_token_encrypted,
        access_expires_at=EXCLUDED.access_expires_at,
        refresh_expires_at=EXCLUDED.refresh_expires_at,
        updated_at=now()`,
      [channel, encryptToken(accessToken), encryptToken(refreshToken), accessExpiresAt, refreshExpiresAt],
    );
  });
}

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { withTransaction } from "@/lib/db";

export type TikTokVideoMetric = {
  id: string;
  title: string;
  url: string;
  views: number;
  createdAt?: number;
};

export type TikTokChannelMetric = {
  handle: string;
  url: string;
  status: "connected" | "partial" | "not_connected" | "error";
  source: "tiktok" | "snapshot";
  image: string;
  followingCount: number;
  followerCount: number;
  likesCount: number;
  totalViews: number | null;
  videoCount: number;
  videos: TikTokVideoMetric[];
  error?: string;
};

export type TikTokMetrics = {
  channels: TikTokChannelMetric[];
  allConnected: boolean;
  totalViews: number | null;
  highestChannel: TikTokChannelMetric | null;
  highestVideo: (TikTokVideoMetric & { handle: string }) | null;
  updatedAt: string;
  usingStaticFallback: boolean;
};

const CHANNELS = [
  { key: "racxalo", handle: "@racxalo_", url: "https://www.tiktok.com/@racxalo_", image: "/images/racxalo.webp", refreshEnv: "TIKTOK_REFRESH_TOKEN_RACXALO", snapshot: { followingCount: 1108, followerCount: 2422, likesCount: 110000 } },
  { key: "didouquaydo", handle: "@didouquaydo", url: "https://www.tiktok.com/@didouquaydo", image: "/images/didouquaydo.webp", refreshEnv: "TIKTOK_REFRESH_TOKEN_DIDOUQUAYDO", snapshot: { followingCount: 18, followerCount: 519, likesCount: 15700 } },
  { key: "thom-thuii", handle: "@thom.thuii", url: "https://www.tiktok.com/@thom.thuii", image: "/images/thom-thuii.webp", refreshEnv: "TIKTOK_REFRESH_TOKEN_THOM_THUII", snapshot: { followingCount: 135, followerCount: 353, likesCount: 21400 } },
  { key: "bcs-dr-nguyn", handle: "@bc.s.dr..nguyn", url: "https://www.tiktok.com/@bc.s.dr..nguyn", image: "/images/bcs-dr-nguyn.webp", refreshEnv: "TIKTOK_REFRESH_TOKEN_BCS_DR_NGUYN", snapshot: { followingCount: 1, followerCount: 11, likesCount: 229 } },
] as const;

const VIDEO_FIELDS = "id,title,video_description,create_time,view_count,share_url";
const USER_FIELDS = "display_name,username,follower_count,following_count,likes_count,video_count,avatar_url";
const MAX_PAGES_PER_CHANNEL = 100;
const REFRESH_EARLY_MS = 10 * 60 * 1000;

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  error?: string;
  error_description?: string;
};

function encryptionKey() {
  const encoded = process.env.TIKTOK_TOKEN_ENCRYPTION_KEY;
  if (!encoded) throw new Error("Thiếu TIKTOK_TOKEN_ENCRYPTION_KEY để mã hóa token TikTok.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("TIKTOK_TOKEN_ENCRYPTION_KEY phải là base64 của đúng 32 bytes.");
  return key;
}

function encryptToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}

function decryptToken(value: string) {
  const [ivPart, tagPart, encryptedPart] = value.split(".");
  if (!ivPart || !tagPart || !encryptedPart) throw new Error("Token TikTok được lưu không hợp lệ.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedPart, "base64")), decipher.final()]).toString("utf8");
}

async function refreshTikTokToken(refreshToken: string) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) throw new Error("Thiếu TIKTOK_CLIENT_KEY hoặc TIKTOK_CLIENT_SECRET.");

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  const payload = await response.json() as TokenResponse;
  if (!response.ok || !payload.access_token || !payload.refresh_token || !payload.expires_in || !payload.refresh_expires_in) {
    throw new Error(payload.error_description || payload.error || `TikTok token refresh failed (${response.status}).`);
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    accessExpiresAt: new Date(Date.now() + payload.expires_in * 1000),
    refreshExpiresAt: new Date(Date.now() + payload.refresh_expires_in * 1000),
  };
}

async function getChannelAccessToken(channel: (typeof CHANNELS)[number]) {
  const initialRefreshToken = process.env[channel.refreshEnv];
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`portfolio-tiktok:${channel.key}`]);
    const result = await client.query<{
      access_token_encrypted: string;
      refresh_token_encrypted: string;
      access_expires_at: Date;
      refresh_expires_at: Date;
    }>("SELECT access_token_encrypted, refresh_token_encrypted, access_expires_at, refresh_expires_at FROM portfolio_tiktok_tokens WHERE channel_key=$1 FOR UPDATE", [channel.key]);
    const stored = result.rows[0];

    if (stored && new Date(stored.access_expires_at).getTime() > Date.now() + REFRESH_EARLY_MS) {
      return decryptToken(stored.access_token_encrypted);
    }

    const refreshToken = stored ? decryptToken(stored.refresh_token_encrypted) : initialRefreshToken;
    if (!refreshToken) return null;
    if (stored && new Date(stored.refresh_expires_at).getTime() <= Date.now()) {
      throw new Error("Refresh token đã hết hạn. Cần kết nối lại tài khoản TikTok.");
    }

    const renewed = await refreshTikTokToken(refreshToken);
    await client.query(
      `INSERT INTO portfolio_tiktok_tokens (channel_key, access_token_encrypted, refresh_token_encrypted, access_expires_at, refresh_expires_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,now())
       ON CONFLICT (channel_key) DO UPDATE SET access_token_encrypted=EXCLUDED.access_token_encrypted, refresh_token_encrypted=EXCLUDED.refresh_token_encrypted, access_expires_at=EXCLUDED.access_expires_at, refresh_expires_at=EXCLUDED.refresh_expires_at, updated_at=now()`,
      [channel.key, encryptToken(renewed.accessToken), encryptToken(renewed.refreshToken), renewed.accessExpiresAt, renewed.refreshExpiresAt],
    );
    return renewed.accessToken;
  });
}

async function fetchChannel(channel: (typeof CHANNELS)[number]): Promise<TikTokChannelMetric> {
  const fallback = {
    followingCount: channel.snapshot.followingCount,
    followerCount: channel.snapshot.followerCount,
    likesCount: channel.snapshot.likesCount,
  };

  let accessToken: string | null = null;
  try {
    accessToken = await getChannelAccessToken(channel);
  } catch (error) {
    return { ...channelBase(channel, "snapshot", fallback), status: "error", totalViews: null, videoCount: 0, videos: [], error: error instanceof Error ? error.message : "Không thể làm mới quyền truy cập TikTok." };
  }
  if (!accessToken) {
    return { ...channelBase(channel, "snapshot", fallback), status: "not_connected", totalViews: null, videoCount: 0, videos: [], error: "Chưa có dữ liệu TikTok chính thức; đang hiển thị snapshot tài khoản." };
  }

  try {
    const userEndpoint = new URL("https://open.tiktokapis.com/v2/user/info/");
    userEndpoint.searchParams.set("fields", USER_FIELDS);
    const userResponse = await fetch(userEndpoint, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(12000) });
    const userPayload = await userResponse.json() as { data?: { user?: { follower_count?: number; following_count?: number; likes_count?: number; video_count?: number; avatar_url?: string } }; error?: { code?: string; message?: string } };
    if (!userResponse.ok || (userPayload.error?.code && userPayload.error.code !== "ok")) throw new Error(userPayload.error?.message || `TikTok user info failed (${userResponse.status}).`);
    const user = userPayload.data?.user;
    const live = {
      followingCount: Number(user?.following_count ?? fallback.followingCount),
      followerCount: Number(user?.follower_count ?? fallback.followerCount),
      likesCount: Number(user?.likes_count ?? fallback.likesCount),
    };

    let cursor: number | undefined;
    let hasMore = true;
    let page = 0;
    const videos: TikTokVideoMetric[] = [];
    while (hasMore && page < MAX_PAGES_PER_CHANNEL) {
      const endpoint = new URL("https://open.tiktokapis.com/v2/video/list/");
      endpoint.searchParams.set("fields", VIDEO_FIELDS);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ max_count: 20, ...(cursor ? { cursor } : {}) }),
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error(`TikTok API trả về HTTP ${response.status}.`);
      const payload = await response.json() as { data?: { videos?: Array<{ id?: string; title?: string; video_description?: string; create_time?: number; view_count?: number; share_url?: string }>; cursor?: number; has_more?: boolean }; error?: { code?: string; message?: string } };
      if (payload.error?.code && payload.error.code !== "ok") throw new Error(payload.error.message || payload.error.code);
      for (const video of payload.data?.videos ?? []) {
        if (!video.id) continue;
        videos.push({ id: video.id, title: video.title?.trim() || video.video_description?.trim() || "TikTok video", url: video.share_url || `${channel.url}/video/${video.id}`, views: Math.max(0, Number(video.view_count ?? 0)), createdAt: video.create_time });
      }
      cursor = payload.data?.cursor;
      hasMore = Boolean(payload.data?.has_more && cursor);
      page += 1;
    }
    return { ...channelBase(channel, "tiktok", live), status: hasMore ? "partial" : "connected", totalViews: videos.reduce((sum, video) => sum + video.views, 0), videoCount: Number(user?.video_count ?? videos.length), videos: videos.sort((a, b) => b.views - a.views).slice(0, 10), ...(hasMore ? { error: "Đã đạt giới hạn phân trang; lượt xem video là một phần dữ liệu công khai gần đây." } : {}) };
  } catch (error) {
    return { ...channelBase(channel, "snapshot", fallback), status: "error", totalViews: null, videoCount: 0, videos: [], error: error instanceof Error ? error.message : "Không thể đọc dữ liệu TikTok; đang dùng snapshot." };
  }
}

function channelBase(channel: (typeof CHANNELS)[number], source: "tiktok" | "snapshot", counts: { followingCount: number; followerCount: number; likesCount: number }): Omit<TikTokChannelMetric, "status" | "totalViews" | "videoCount" | "videos"> {
  return { handle: channel.handle, url: channel.url, image: channel.image, source, ...counts };
}

type TikTokMetricsCache = {
  expiresAt: number;
  value?: TikTokMetrics;
  pending?: Promise<TikTokMetrics>;
};

declare global {
  // eslint-disable-next-line no-var
  var __portfolioTikTokMetricsCache: TikTokMetricsCache | undefined;
}

async function loadTikTokMetrics(): Promise<TikTokMetrics> {
  const channels = await Promise.all(CHANNELS.map(fetchChannel));
  const allConnected = channels.every((channel) => channel.status === "connected");
  const totalViews = allConnected ? channels.reduce((sum, channel) => sum + (channel.totalViews ?? 0), 0) : null;
  const highestChannel = allConnected ? [...channels].sort((a, b) => (b.totalViews ?? 0) - (a.totalViews ?? 0))[0] ?? null : null;
  const highestVideo = channels.flatMap((channel) => channel.videos.map((video) => ({ ...video, handle: channel.handle }))).sort((a, b) => b.views - a.views)[0] ?? null;
  return { channels, allConnected, totalViews, highestChannel, highestVideo, usingStaticFallback: channels.some((channel) => channel.source === "snapshot"), updatedAt: new Date().toISOString() };
}

export async function getTikTokMetrics(): Promise<TikTokMetrics> {
  const cache = globalThis.__portfolioTikTokMetricsCache ??= { expiresAt: 0 };
  if (cache.value && cache.expiresAt > Date.now()) return cache.value;
  if (cache.pending) return cache.pending;

  cache.pending = loadTikTokMetrics();
  try {
    const value = await cache.pending;
    cache.value = value;
    cache.expiresAt = Date.now() + 5 * 60 * 1000;
    return value;
  } finally {
    cache.pending = undefined;
  }
}

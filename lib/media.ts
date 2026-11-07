/**
 * Cloudinary delivery helpers.
 *
 * Videos recorded on phones are often HEVC/H.265 (.mov). Chrome/Firefox and many
 * Android devices can play the audio of such files but show no picture. Asking
 * Cloudinary to deliver H.264 MP4 fixes that and, together with q_auto and a size
 * cap, makes the video much lighter to load.
 */
// vc_h264:main:4.0 forces plain 8-bit 4:2:0 H.264. Without an explicit profile Cloudinary can keep the
// 10-bit/HDR format of iPhone clips, which browsers play as sound only (no picture).
const VIDEO_TRANSFORM = "f_mp4,vc_h264:main:4.0,ac_aac,q_auto:good,c_limit,w_1280,h_1280";
// Transforms written by earlier versions of this helper (saved in the database) start like this.
const OWN_TRANSFORM_PREFIX = /^f_mp4,vc_h264[^/]*\//;

export function optimizedVideoUrl(url: string | undefined): string {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com") || !url.includes("/video/upload/")) return url;
  const marker = "/video/upload/";
  const index = url.indexOf(marker) + marker.length;
  let rest = url.slice(index);
  if (rest.startsWith(`${VIDEO_TRANSFORM}/`)) return url; // already current (idempotent)
  // Replace an older transform of ours so videos saved before this fix also get the new settings.
  rest = rest.replace(OWN_TRANSFORM_PREFIX, "");
  const withMp4 = rest.replace(/\.(mov|mp4|webm|m4v)(\?.*)?$/i, ".mp4$2");
  return `${url.slice(0, index)}${VIDEO_TRANSFORM}/${withMp4}`;
}

export function isCloudinaryVideo(url: string | undefined) {
  return !!url && url.includes("res.cloudinary.com") && url.includes("/video/upload/");
}

/**
 * Image delivery (Cloudinary).
 *
 * The original upload can be several MB. Asking Cloudinary for `f_auto,q_auto` gives each browser
 * AVIF/WebP at a sensible quality, and `w_<n>,c_limit` stops phones from downloading a 2000px
 * picture for a 400px card. The look stays the same, only the bytes shrink.
 * Non-Cloudinary URLs (local /images/*, external) are returned untouched.
 */
const IMAGE_MARKER = "/image/upload/";
// Versions look like "v1712345678/". Anything else after /upload/ is already a transformation.
const HAS_VERSION_FIRST = /^v\d+\//;

export function isCloudinaryImage(url: string | undefined) {
  return !!url && url.includes("res.cloudinary.com") && url.includes(IMAGE_MARKER);
}

export function optimizedImageUrl(url: string | undefined, width = 800): string {
  if (!url) return "";
  if (!isCloudinaryImage(url)) return url;
  const index = url.indexOf(IMAGE_MARKER) + IMAGE_MARKER.length;
  const rest = url.slice(index);
  // Respect a transformation somebody already chose (also keeps this function idempotent).
  if (!HAS_VERSION_FIRST.test(rest)) return url;
  return `${url.slice(0, index)}f_auto,q_auto:good,c_limit,w_${width}/${rest}`;
}

/** `srcset` with a few widths so the browser picks the smallest sharp file for the card size. */
export function optimizedImageSrcSet(url: string | undefined, widths: number[] = [480, 800, 1200]): string | undefined {
  if (!isCloudinaryImage(url)) return undefined;
  return widths.map((width) => `${optimizedImageUrl(url, width)} ${width}w`).join(", ");
}

/** Small JPEG poster of the first video frame. */
export function videoPosterUrl(videoUrl: string | undefined, width = 800): string | undefined {
  if (!videoUrl || !videoUrl.includes("res.cloudinary.com") || !videoUrl.includes("/video/upload/")) return undefined;
  const marker = "/video/upload/";
  const index = videoUrl.indexOf(marker) + marker.length;
  // Drop our own video transform (f_mp4,vc_h264…/) if present; it is not valid for a still image.
  const rest = videoUrl.slice(index).replace(/^f_mp4,vc_h264[^/]*\//, "");
  const still = rest.replace(/\.(mp4|webm|mov|m4v)(\?.*)?$/i, ".jpg");
  return `${videoUrl.slice(0, index)}so_0,f_auto,q_auto:good,c_limit,w_${width}/${still}`;
}

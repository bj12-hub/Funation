import { USE_MOCK } from "@/lib/mock";

const MOCK_THUMBS = 6;

/**
 * Thumbnail for a requested YouTube video. With a real backend this is YouTube's own image for the video;
 * in mock mode it is one of the original illustrations in `/mock/video` (scripts/mock-images), picked from the id,
 * so dev screens and Figma captures never show third-party thumbnails.
 */
export function videoThumbUrl(videoId: string, size: "default" | "medium" = "medium") {
  if (USE_MOCK) {
    let h = 0;
    for (const ch of videoId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return `/mock/video/thumb-${(h % MOCK_THUMBS) + 1}.jpg`;
  }
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/${size === "medium" ? "mqdefault" : "default"}.jpg`;
}

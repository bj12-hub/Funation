/**
 * FLEXTV's images (live thumbnails, avatars, channel backgrounds, signatures) come from its CDN, which Next's image
 * optimizer is not set up for: `next/image` shows them as they are (`unoptimized`).
 */
export const remote = (src: string) => /^https?:\/\//.test(src);

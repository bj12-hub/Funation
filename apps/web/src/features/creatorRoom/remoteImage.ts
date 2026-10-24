/**
 * A FLEXTV channel's images (avatar, background, signatures) come from FLEXTV's CDN, which Next's image optimizer is
 * not set up for: `next/image` shows them as they are (`unoptimized`).
 */
export const remote = (src: string) => /^https?:\/\//.test(src);

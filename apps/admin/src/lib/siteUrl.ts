/** Public address of the site, for "open on the site" links (the admin app runs on its own origin). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

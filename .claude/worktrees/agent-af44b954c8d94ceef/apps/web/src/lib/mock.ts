/**
 * Development mock switch for services whose backend is not built yet.
 * On by default in `next dev`; set NEXT_PUBLIC_AUTH_MOCK=true to enable it
 * in a production build (e.g. Vercel preview deployments).
 */
export const USE_MOCK = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_AUTH_MOCK === "true";

export const mockDelay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

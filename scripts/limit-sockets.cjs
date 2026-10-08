// Preloaded into `next build` by scripts/merge-pr.sh (NODE_OPTIONS=--require). next/font fetches every Google Fonts
// file at once (Gothic A1 alone is several hundred unicode-range files); on some networks that many parallel
// connections time out (ETIMEDOUT, "Failed to fetch `Gothic A1`" — 2026-10-08). Queue them a few at a time.
const https = require("node:https");
https.globalAgent.maxSockets = 12;
https.globalAgent.keepAlive = true;

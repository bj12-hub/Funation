/** Creator channel tabs (funnation channel page order). Shared by the server page and client tabs. */
export const CHANNEL_VIEWS = [
  { key: "home", label: "홈" },
  { key: "crew", label: "크루" },
  { key: "videos", label: "영상" },
  { key: "community", label: "커뮤니티" },
  { key: "signatures", label: "시그니처" },
  { key: "about", label: "소개" }
] as const;
export type ChannelView = (typeof CHANNEL_VIEWS)[number]["key"];
export const parseChannelView = (v: unknown): ChannelView => (CHANNEL_VIEWS.some((x) => x.key === v) ? (v as ChannelView) : "home");

/**
 * Creator account settings (Figma 315:405 · 315:2) and 프로필 수정 popup (326:496).
 * Client-safe types and option lists; the actions live in ./creatorSettings.ts.
 */

export type CreatorLanguage = "ko" | "en" | "zh";
export const CREATOR_LANGUAGES: { key: CreatorLanguage; label: string }[] = [
  { key: "ko", label: "한국어" },
  { key: "en", label: "English" },
  { key: "zh", label: "中文" }
];

export type MainPlatform = "SOOP" | "FLEXTV" | "YOUTUBE" | "CHZZK" | "OTHER";
export const MAIN_PLATFORMS: { key: MainPlatform; label: string; color: string }[] = [
  { key: "SOOP", label: "SOOP (아프리카TV)", color: "#1e6bff" },
  { key: "FLEXTV", label: "FlexTV (플렉스TV)", color: "#f5bf0a" },
  { key: "YOUTUBE", label: "Youtube", color: "#ff0000" },
  { key: "CHZZK", label: "치지직 (CHZZK)", color: "#00d26a" },
  { key: "OTHER", label: "기타", color: "#3a3a4a" }
];

export type SnsKind = "INSTAGRAM" | "TIKTOK" | "X" | "ETC";
export const SNS_KINDS: { key: SnsKind; label: string; placeholder: string }[] = [
  { key: "INSTAGRAM", label: "Instagram", placeholder: "https://www.instagram.com/" },
  { key: "TIKTOK", label: "Tiktok", placeholder: "https://www.tiktok.com/" },
  { key: "X", label: "X", placeholder: "https://www.twitter.com/" },
  { key: "ETC", label: "etc.", placeholder: "https://" }
];
export type SnsLink = { kind: SnsKind; url: string };

/** 326:496 "내 방송 정보" chips (max 3). */
export const BROADCAST_CATEGORIES = [
  "게임",
  "토크",
  "음식/먹방",
  "뷰티/패션/쇼핑",
  "스포츠",
  "음악/댄스",
  "애니/만화",
  "연극/영화/드라마",
  "버추얼",
  "경제/금융",
  "주식/재테크",
  "부동산",
  "정치/시사",
  "IT/테크",
  "ASMR",
  "여행/아웃도어방송",
  "수영장/욕조/해변",
  "아트",
  "교육/자기계발",
  "건강/의학",
  "자연/과학",
  "육아/키즈",
  "자동차/교통",
  "취미/생활",
  "밀리터리/전쟁",
  "갬블"
] as const;
export const MAX_CATEGORIES = 3;
export const MAX_PROFILE_IMAGES = 3;
export const MAX_ANNIVERSARIES = 5;

export type Anniversary = { name: string; date: string };

export type CreatorSettings = {
  channelName: string;
  ssumnationId: string;
  /** Profile images; index 0 is 대표. `null` for an empty slot. */
  images: (string | null)[];
  debutDate: string;
  debutPublic: boolean;
  birthday: string;
  birthdayPublic: boolean;
  anniversaries: Anniversary[];
  categories: string[];
  liveProfileVisible: boolean;
  marketingConsent: boolean;
  languages: CreatorLanguage[];
  donateUrl: string;
  rtmpUrl: string;
  /** 통합 알림창 (alert widget) URL for OBS/Xsplit browser sources (328:907). Format TBD. */
  alertWidgetUrl: string;
  /** Only the last 4 characters are ever sent unless the member asks to copy it. */
  integrationKeyMasked: string;
  mainPlatform: MainPlatform;
  sns: SnsLink[];
};

export type SaveResult = { status: "SAVED" } | { status: "INVALID"; message?: string } | { status: "UNAUTHORIZED" };

/** Channel name (닉네임) rule — assumption: 2–20 chars of Korean/English/digits/space/_ (TBD). */
export const isValidChannelName = (v: string) => /^[가-힣A-Za-z0-9 _]{2,20}$/.test(v.trim());

export const isHttpUrl = (v: string) => /^https?:\/\/[^\s]{1,190}$/.test(v.trim());

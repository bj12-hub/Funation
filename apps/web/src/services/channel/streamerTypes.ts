/**
 * Becoming a FLEXTV streamer from `/channel/new` (phase 5, docs/development/flextv-backend.md "5단계"). Client-safe.
 */

/** Where the member stands: FLEXTV's own order (본인인증 → 외국인 → 만 14세). */
export type StreamerGate = "ELIGIBLE" | "IDENTITY_REQUIRED" | "FOREIGNER" | "UNDER_AGE";

export type BecomeStreamerResult =
  | { status: "REGISTERED" }
  /** FLEXTV made the stream key but has not made the member a streamer: its 고객센터 finishes it. */
  | { status: "PENDING" }
  | { status: "INVALID"; message: string }
  | { status: "ALREADY_CREATOR" | "UNAUTHORIZED" | "IDENTITY_REQUIRED" | "FOREIGNER" | "UNDER_AGE" }
  /** FLEXTV did not answer: whether it went through shows on the next look. */
  | { status: "UNKNOWN" };

/** FLEXTV's 방송 준수사항 (its broadcast form asks for it before every first broadcast), summarized. */
export const STREAM_POLICY = [
  "음란물을 방송하거나 제작 · 판매 · 유포하지 않아요. 적발 시 서비스 영구정지와 형사고발 조치가 있어요.",
  "저작권이 확보되지 않은 영상 · 음원 · 이미지 · 글꼴을 쓰지 않고, 타인의 권리 · 명예 · 사생활 · 초상권을 침해하지 않아요.",
  "욕설 · 언어폭력 등 저속한 표현이나 공공질서 · 미풍양속에 어긋나는 방송, 회사와 협의 없는 영리 목적의 방송을 하지 않아요.",
  "사행성 · 음주 · 흡연 · 잔인 · 폭력적인 장면은 19세 연령제한을 켜고 방송해요. 리딩방송(투자 조언 · 종목 추천)은 유사투자자문업자만 할 수 있어요."
] as const;

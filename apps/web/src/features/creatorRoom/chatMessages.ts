/**
 * Chat messages for the creator room (Figma 826:685).
 * TODO: realtime chat transport, moderation and rate limiting belong to the backend (TBD).
 */

export type ChatMessage =
  | { id: string; kind: "CHAT"; nickname: string; handle: string; color: string; avatarUrl: string | null; text: string }
  | { id: string; kind: "DONATION"; title: string; text: string };

// ── Mock data: Figma 826:685 ───────────────────────────────────────────────────
export const MOCK_MESSAGES: ChatMessage[] = [
  { id: "m1", kind: "CHAT", nickname: "크리에이터팬클럽", handle: "FNCL_01", color: "#ec4899", avatarUrl: "/mock/room/chat-avatar-1.png", text: "하음파 썰 미쳤다 그냥 화이팅!!" },
  { id: "m2", kind: "CHAT", nickname: "탑스타최강", handle: "TSCG_88", color: "#8b5cf6", avatarUrl: null, text: "오늘 무대 구성 역대급이네요 ㄷㄷ" },
  { id: "m3", kind: "CHAT", nickname: "우왁꾿마니아", handle: "WKMN_42", color: "#06b6d4", avatarUrl: "/mock/room/chat-avatar-2.png", text: "다음 게스트 스포 가능한가요?" },
  { id: "m4", kind: "DONATION", title: "도네만선 님이 1,000 FN을 후원했습니다.", text: "오늘도 즐거운 방송 응원할게요!" },
  { id: "m5", kind: "CHAT", nickname: "오디션투표", handle: "ODTP_19", color: "#f5bf0a", avatarUrl: "/mock/room/chat-avatar-3.png", text: "방금 춤선 장난 아니었습니다" },
  { id: "m6", kind: "CHAT", nickname: "도네만선", handle: "DNMS_12", color: "#10b981", avatarUrl: "/mock/room/chat-avatar-4.png", text: "후원 갑니다 가자!!" },
  { id: "m7", kind: "CHAT", nickname: "하팬음대파표", handle: "HPMP_03", color: "#f3f4f6", avatarUrl: null, text: "항상 실시간 라이브 최고에요" }
];

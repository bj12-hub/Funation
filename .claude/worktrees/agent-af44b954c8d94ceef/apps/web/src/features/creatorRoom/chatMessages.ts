/**
 * Chat messages for the creator room (Figma 826:685).
 * TODO: realtime chat transport, moderation and rate limiting belong to the backend (TBD).
 */

export type ChatMessage =
  | { id: string; kind: "CHAT"; nickname: string; handle: string; color: string; avatarUrl: string | null; text: string }
  | { id: string; kind: "DONATION"; title: string; text: string };

// ── Mock data: Figma 826:685 ───────────────────────────────────────────────────
export const MOCK_MESSAGES: ChatMessage[] = [
  { id: "m1", kind: "CHAT", nickname: "봄날팬클럽", handle: "BMFC_01", color: "#ec4899", avatarUrl: "/mock/room/chat-avatar-1.png", text: "오늘 사연 미쳤다 그냥 화이팅!!" },
  { id: "m2", kind: "CHAT", nickname: "직급전최강", handle: "JGJN_88", color: "#8b5cf6", avatarUrl: null, text: "오늘 점수판 역대급이네요 ㄷㄷ" },
  { id: "m3", kind: "CHAT", nickname: "새벽감성러", handle: "SBGS_42", color: "#06b6d4", avatarUrl: "/mock/room/chat-avatar-2.png", text: "다음 회차 멤버 스포 가능한가요?" },
  { id: "m4", kind: "DONATION", title: "도네만선 님이 1,000 FN을 후원했습니다.", text: "오늘도 즐거운 방송 응원할게요!" },
  { id: "m5", kind: "CHAT", nickname: "엑셀응원단", handle: "EXCL_19", color: "#f5bf0a", avatarUrl: "/mock/room/chat-avatar-3.png", text: "방금 순위 역전 장난 아니었습니다" },
  { id: "m6", kind: "CHAT", nickname: "도네만선", handle: "DNMS_12", color: "#10b981", avatarUrl: "/mock/room/chat-avatar-4.png", text: "후원 갑니다 가자!!" },
  { id: "m7", kind: "CHAT", nickname: "하루봄찐팬", handle: "HRBM_03", color: "#f3f4f6", avatarUrl: null, text: "항상 실시간 라이브 최고에요" }
];

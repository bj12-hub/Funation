/**
 * Development-only mailbox of the signed-in mock member. Server-side only, kept on `globalThis`.
 * `folder` applies to received mail (inbox / archive / spam); sent mail lives in "sent".
 */

export type MockMessage = {
  id: string;
  direction: "IN" | "OUT";
  peerId: string;
  peerName: string;
  body: string;
  sentAt: string;
  read: boolean;
  folder: "inbox" | "archive" | "spam" | "sent";
  deleted: boolean;
};

const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const seed: MockMessage[] = [
  { id: "ms-1", direction: "IN", peerId: "c4", peerName: "불꽃크루", body: "후원 감사합니다! 다음 회차 엑셀방송에서 꼭 읽어 드릴게요 🙌", sentAt: ago(3), read: false, folder: "inbox", deleted: false },
  { id: "ms-2", direction: "IN", peerId: "c1", peerName: "하루봄", body: "이번 주 금요일 밤 9시 소통 특집 방송 공지드려요. 많이 와 주세요!", sentAt: ago(20), read: true, folder: "inbox", deleted: false },
  { id: "ms-3", direction: "OUT", peerId: "c4", peerName: "불꽃크루", body: "어제 직급전 최고였어요!", sentAt: ago(26), read: true, folder: "sent", deleted: false }
];

/**
 * `requests`: `${memberId}:${requestId}` → the message that 쪽지 보내기 request sent, so a retry after a lost response
 * sends once (a 재가입 moves the withdrawn account's keys to its own id, account/rejoin.ts).
 */
type Store = { messages: MockMessage[]; sentLog: string[]; requests: Record<string, string> };
// V2: request ids for 쪽지 보내기.
const g = globalThis as typeof globalThis & { __ssumnationMockMessagesV2?: Store };

export const mockMessages = (g.__ssumnationMockMessagesV2 ??= { messages: seed.map((m) => ({ ...m })), sentLog: [], requests: {} });

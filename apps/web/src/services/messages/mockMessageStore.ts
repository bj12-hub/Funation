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
  { id: "ms-1", direction: "IN", peerId: "c4", peerName: "피식대학", body: "후원 감사합니다! 다음 방송에서 꼭 읽어 드릴게요 🙌", sentAt: ago(3), read: false, folder: "inbox", deleted: false },
  { id: "ms-2", direction: "IN", peerId: "c1", peerName: "침착맨", body: "이번 주 금요일 특집 방송 공지드려요. 많이 와 주세요!", sentAt: ago(20), read: true, folder: "inbox", deleted: false },
  { id: "ms-3", direction: "OUT", peerId: "c4", peerName: "피식대학", body: "어제 콩트 최고였어요!", sentAt: ago(26), read: true, folder: "sent", deleted: false }
];

const g = globalThis as typeof globalThis & { __funationMockMessagesV1?: { messages: MockMessage[]; sentLog: string[] } };

export const mockMessages = (g.__funationMockMessagesV1 ??= { messages: seed.map((m) => ({ ...m })), sentLog: [] });

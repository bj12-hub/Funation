/** A FLEXTV channel room's chat, client-safe: the actions live in ./flextvRoomChat.ts. */

export type RoomChatLine = { id: string; nickname: string; color: string; text: string };
export type RoomChatRead = { status: "OK"; lines: RoomChatLine[] } | { status: "INVALID" | "UNAVAILABLE" };
export type RoomChatSend = { status: "SENT" } | { status: "UNAUTHORIZED" } | { status: "REFUSED"; message: string };

/** The longest line sent to FLEXTV (its own chat box keeps lines short; its server refuses long ones). */
export const ROOM_CHAT_MAX = 100;

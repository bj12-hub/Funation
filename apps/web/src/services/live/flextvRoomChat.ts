"use server";

import { isFlextvChannelId } from "@/lib/flextv/donation";
import { fetchChat, sendChat, type FlextvChatLine } from "@/lib/flextv/live";
import { FLEXTV_LIVE } from "@/lib/flextv/mode";
import { requestDeviceContext } from "@/lib/flextv/request";
import { getFlextvAccessToken, getSession } from "@/lib/session";
import { ROOM_CHAT_MAX, type RoomChatLine, type RoomChatRead, type RoomChatSend } from "./roomChatTypes";

/**
 * A FLEXTV channel room's chat (phase 4, docs/development/flextv-backend.md "4단계"). The browser asks every couple of
 * seconds; this server asks FLEXTV at most once per stream in that time, whoever is watching, and passes on only a
 * nickname, a color and the text. Sending goes to FLEXTV with the member's token, which never reaches the browser.
 */

const READ_TTL_MS = 2_000;

/** Nickname colors (the room's palette), picked by the sender so one viewer keeps one color. */
const COLORS = ["#7c5cff", "#ff6b9a", "#2ec4b6", "#ffb020", "#4da3ff", "#a0d911", "#ff7a45", "#b37feb"];

const isStreamId = (value: unknown): value is string => typeof value === "string" && /^[1-9]\d{0,17}$/.test(value);

function digest(value: string) {
  let h = 5381;
  for (let i = 0; i < value.length; i++) h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  return h >>> 0;
}

const lineOf = (l: FlextvChatLine): RoomChatLine => ({
  id: digest(l.key).toString(36) + l.at.slice(-6).replace(/\D/g, ""),
  nickname: l.nickname,
  color: COLORS[digest(l.memberId) % COLORS.length],
  text: l.text
});

const g = globalThis as typeof globalThis & { __ssumnationFlextvChat?: Map<string, { at: number; read: Promise<RoomChatLine[]> }> };
const reads = (g.__ssumnationFlextvChat ??= new Map());

export async function getRoomChat(channelId: unknown, streamId: unknown): Promise<RoomChatRead> {
  if (!FLEXTV_LIVE || !isFlextvChannelId(channelId) || !isStreamId(streamId)) return { status: "INVALID" };
  const key = `${channelId}:${streamId}`;
  const now = Date.now();
  let entry = reads.get(key);
  if (!entry || now - entry.at >= READ_TTL_MS) {
    if (reads.size > 2_000) for (const [k, e] of reads) if (now - e.at >= READ_TTL_MS) reads.delete(k);
    entry = { at: now, read: fetchChat(channelId, streamId).then((lines) => lines.map(lineOf)) };
    reads.set(key, entry);
  }
  try {
    return { status: "OK", lines: await entry.read };
  } catch {
    reads.delete(key);
    return { status: "UNAVAILABLE" };
  }
}

const CHAT_REFUSAL_COPY = {
  MUTED: "지금은 채팅할 수 없어요. 잠시 후 다시 시도해 주세요.",
  BLOCKED: "이 채널에서 채팅이 제한된 계정이에요.",
  TOO_LONG: `채팅은 ${ROOM_CHAT_MAX}자까지 쓸 수 있어요.`,
  INVALID: "보낼 수 없는 메시지예요."
} as const;

export async function sendRoomChat(input: { channelId: unknown; streamId: unknown; text: unknown }): Promise<RoomChatSend> {
  if (!FLEXTV_LIVE) return { status: "REFUSED", message: CHAT_REFUSAL_COPY.INVALID };
  const session = await getSession();
  const token = session && (await getFlextvAccessToken());
  if (!session || !token) return { status: "UNAUTHORIZED" };
  const { channelId, streamId } = input ?? {};
  const message = typeof input?.text === "string" ? input.text.replace(/[\u0000-\u001f\u007f]/g, " ").trim() : "";
  if (!isFlextvChannelId(channelId) || !isStreamId(streamId) || !message) return { status: "REFUSED", message: CHAT_REFUSAL_COPY.INVALID };
  if (message.length > ROOM_CHAT_MAX) return { status: "REFUSED", message: CHAT_REFUSAL_COPY.TOO_LONG };
  try {
    const outcome = await sendChat(token, await requestDeviceContext(), { channelId, streamId, message });
    if (outcome.kind === "SENT") {
      // The next read shows it.
      reads.delete(`${channelId}:${streamId}`);
      return { status: "SENT" };
    }
    if (outcome.kind === "UNAUTHORIZED") return { status: "UNAUTHORIZED" };
    return { status: "REFUSED", message: CHAT_REFUSAL_COPY[outcome.kind] };
  } catch {
    return { status: "REFUSED", message: "메시지를 보내지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
}

import { FlextvUnavailableError, flextvRequest, isRecord } from "./client";

/**
 * FLEXTV's 알림 (phase 7, docs/development/flextv-backend.md "7단계"): `GET /api/my/notification-list` gives the latest
 * ten as `{ result, data: [{ typeLabel, message, metadata }] }` — no id and no time — and marks them seen; whether there
 * is something new is the profile's `setting.notificationView`. `readNotifications` is pure (notifications.test.ts).
 */

export type FlextvNotification = {
  /** FLEXTV's label: 즐겨찾기 호스트 방송 시작 · 기프티콘 선물 · 쪽지 · 댓글 · 구독자 · 충전 완료 · 꿀 · 퀘스트 완료 · 신규 업적 달성. */
  label: string;
  message: string;
  /** FLEXTV's own address for it (`/channels/3021/profile`, `/honey-pot`), when it has one. */
  redirect: string | null;
};

export function readNotifications(data: unknown): FlextvNotification[] {
  const rows = isRecord(data) && Array.isArray(data.data) ? data.data : [];
  return rows.flatMap((raw) => {
    if (!isRecord(raw) || typeof raw.message !== "string") return [];
    const redirect = isRecord(raw.metadata) && typeof raw.metadata.redirect === "string" && /^\/[^/\\]/.test(raw.metadata.redirect) ? raw.metadata.redirect : null;
    return [{ label: typeof raw.typeLabel === "string" ? raw.typeLabel : "", message: raw.message, redirect }];
  });
}

/** Null when FLEXTV no longer accepts the token. Reading marks them seen on FLEXTV. */
export async function fetchNotifications(token: string): Promise<FlextvNotification[] | null> {
  const response = await flextvRequest("/api/my/notification-list", { token });
  if (response.status === 401) return null;
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV 알림 answered ${response.status}`);
  return readNotifications(response.data);
}

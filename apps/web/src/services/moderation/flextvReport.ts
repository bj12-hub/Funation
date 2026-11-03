"use server";

import { requestFrom } from "@/lib/flextv/auth";
import { fetchChannel } from "@/lib/flextv/donation";
import { createQueue } from "@/lib/flextv/queue";
import { requestDeviceContext } from "@/lib/flextv/request";
import { FLEXTV_REPORT_BODY_MAX } from "@/lib/flextv/rules";
import { fetchReportCategories, postBroadcastReport } from "@/lib/flextv/support";
import { getFlextvAccessToken, getSession } from "@/lib/session";
import type { FlextvReportCategory, FlextvReportResult } from "./flextvReportTypes";

/**
 * 방송 신고 in a FLEXTV channel's room (phase 10, docs/development/flextv-backend.md "10단계"): FLEXTV's 신고 유형 and
 * its 신고 form, to FLEXTV's operators. The streamer's member number is looked up here and never reaches the browser.
 */

/** FLEXTV's 신고 유형; null when FLEXTV does not answer (the room then says to try later). */
export async function flextvReportCategories(): Promise<FlextvReportCategory[] | null> {
  try {
    const categories = await fetchReportCategories();
    return categories.length > 0 ? categories : null;
  } catch {
    return null;
  }
}

const serialize = createQueue("report");
const REQUEST_TTL_MS = 30 * 60 * 1000;
const g = globalThis as typeof globalThis & { __ssumnationFlextvReportRequests?: Map<string, { at: number; result: Promise<FlextvReportResult> }> };
const requests = (g.__ssumnationFlextvReportRequests ??= new Map());

/**
 * One 신고 per `requestId`: a double submit (or a retry after a lost answer) is one 신고 while FLEXTV's answer is kept; a
 * refused or unclear one may be sent again. The id is checked and recorded with nothing awaited in between.
 */
export async function reportFlextvBroadcast(input: { channelId: unknown; category: unknown; content: unknown; requestId: unknown }): Promise<FlextvReportResult> {
  const [session, token] = await Promise.all([getSession(), getFlextvAccessToken()]);
  if (!session || !token) return { status: "UNAUTHORIZED" };
  const { channelId, category, content, requestId } = input;
  if (typeof requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  if (typeof channelId !== "string" || !/^[1-9]\d{0,15}$/.test(channelId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const key = `${session.userId}:${requestId}`;
  const now = Date.now();
  for (const [k, v] of requests) if (now - v.at > REQUEST_TTL_MS) requests.delete(k);
  const done = requests.get(key);
  if (done) return done.result;
  const result = submitReport(token, channelId, category, content);
  requests.set(key, { at: now, result });
  result.then(
    (r) => r.status !== "REPORTED" && requests.delete(key),
    () => requests.delete(key)
  );
  return result;
}

async function submitReport(token: string, channelId: string, category: unknown, content: unknown): Promise<FlextvReportResult> {
  const text = typeof content === "string" ? content.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").trim() : "";
  if (!text || text.length > FLEXTV_REPORT_BODY_MAX) return { status: "INVALID", message: `신고 내용을 1~${FLEXTV_REPORT_BODY_MAX}자로 입력해 주세요.` };
  const [categories, channel] = await Promise.all([fetchReportCategories(), fetchChannel(channelId)]);
  if (typeof category !== "string" || !categories.some((c) => c.value === category)) return { status: "INVALID", message: "신고 유형을 골라 주세요." };
  if (!channel) return { status: "INVALID", message: "이 채널을 찾을 수 없어요." };
  // FLEXTV's form asks for a 제목; the room names the broadcast instead (FLEXTV's 1:1 문의 제목 limit, 50자).
  const title = `[방송 신고] ${channel.owner.nickname}`.slice(0, 50);
  const caller = requestFrom(await requestDeviceContext());
  return serialize(token, async (): Promise<FlextvReportResult> => {
    const posted = await postBroadcastReport(token, { targetMemberId: channel.owner.memberId, title, category, content: text }, caller);
    if (posted.kind === "UNAUTHORIZED") return { status: "UNAUTHORIZED" };
    return posted.kind === "OK" ? { status: "REPORTED" } : { status: "INVALID", message: posted.message };
  });
}

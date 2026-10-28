import { mockAlerts } from "@/services/creator/alertCore";
import { isSignatureImage, mockSignatures } from "@/services/donations/signatureCore";
import { DEFAULT_SIG_COUNT, SIG_COUNT_COLUMNS_MAX, SIG_COUNT_ROWS, SIG_COUNT_SORTS, SIG_COUNT_TITLE_MAX, type SigCountLive, type SigCountRow, type SigCountSettings } from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 시그 카운트 (server-only) — code-first, StreamDonate 시그 카운트 참고. How many of each chosen signature every crew member
 * received during the broadcast: a 시그니처 후원, or a 일반 후원 that alerted as a signature by 금액 일치 · 금액범위, counted
 * for the member the supporter picked (멤버 지정; none = 미지정). Read from the 후원 알림 records, so only completed
 * donations to the studio channel count. Display only — no FN moves.
 */

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;

/** The channel's 시그 카운트 settings (defaults until saved; saved before 선택한 멤버 · 출근 필터 (2026-10-28) with none picked, 출퇴근 무관). */
export const sigCountSettingsOf = (channelId: string): SigCountSettings => ({ ...DEFAULT_SIG_COUNT, ...mockCrew.sigCounts?.[channelId] });

/** The signatures the settings can pick from, in the creator's order (숨긴 시그니처 too: it may have been sent before it was hidden). */
export const sigCountSignatures = () => mockSignatures.items.map((s) => ({ id: s.id, name: s.name, group: s.group, active: s.active, price: s.price, match: s.match, rangeMin: s.rangeMin }));

/**
 * Validates the settings. `signatureIds`: the signatures that exist now (the columns must be among them); `memberIds`: the
 * channel's crew (the picked rows must be in it).
 */
export function parseSigCount(input: unknown, forbidden: string[], signatureIds: string[], memberIds: string[]): SigCountSettings | { message: string } {
  const v = rec(input);
  const title = typeof v.title === "string" ? v.title.trim() : "";
  if (title.length > SIG_COUNT_TITLE_MAX) return { message: `제목은 ${SIG_COUNT_TITLE_MAX}자 이내로 입력해 주세요.` };
  if (title && forbidden.some((w) => title.toLowerCase().includes(w))) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
  if (!Array.isArray(v.signatureIds) || v.signatureIds.some((id) => typeof id !== "string" || !signatureIds.includes(id))) return { message: "셀 시그니처를 확인해 주세요." };
  const ids = [...new Set(v.signatureIds as string[])];
  if (ids.length > SIG_COUNT_COLUMNS_MAX) return { message: `시그니처는 ${SIG_COUNT_COLUMNS_MAX}개까지 셀 수 있어요.` };
  const rows = SIG_COUNT_ROWS.find((r) => r.key === v.rows)?.key;
  const sort = SIG_COUNT_SORTS.find((r) => r.key === v.sort)?.key;
  if (!rows || !sort || typeof v.showTotal !== "boolean") return { message: "표시 설정을 확인해 주세요." };
  // A screen from before 선택한 멤버 (2026-10-28) sends none: none picked.
  const picked = v.memberIds === undefined ? [] : v.memberIds;
  if (!Array.isArray(picked) || picked.some((id) => typeof id !== "string" || !memberIds.includes(id))) return { message: "표에 넣을 멤버를 확인해 주세요." };
  const members = [...new Set(picked as string[])];
  if (rows === "SELECTED" && !members.length) return { message: "표에 넣을 멤버를 골라 주세요." };
  // … and no 출근 필터: 출퇴근 무관.
  if (v.activeOnly !== undefined && typeof v.activeOnly !== "boolean") return { message: "표시 설정을 확인해 주세요." };
  return { title, signatureIds: ids, rows, memberIds: members, activeOnly: v.activeOnly === true, sort, showTotal: v.showTotal };
}

/**
 * The table of a broadcast: donation alerts from `since` (the start, or the last 다시 세기) to the end. 다시 보내기 copies
 * and test alerts never count; a 퀘스트 후원 counts once it succeeded. Members in crew order (removed ones after, as
 * 삭제된 멤버), 미지정 last; sorted by total when the settings say so (ties keep crew order). On 선택한 멤버 only the picked
 * members (and 미지정) are rows; 출근 BJ만 leaves out members on 휴식. The 합계 counts the rows shown only.
 */
export function sigCountLive(b: MockBroadcast): SigCountLive {
  const settings = sigCountSettingsOf(b.channelId);
  const since = b.sigCount?.since ?? b.startedAt;
  const from = Date.parse(since);
  const to = b.endedAt ? Date.parse(b.endedAt) : Infinity;
  const byId = new Map(mockSignatures.items.map((s) => [s.id, s]));
  const columns = settings.signatureIds.map((id) => {
    const s = byId.get(id);
    return { id, name: s?.name ?? "삭제된 시그니처", imageUrl: s && isSignatureImage(s.imageUrl) ? s.imageUrl : null };
  });
  const column = new Map(settings.signatureIds.map((id, i) => [id, i]));

  const counts = new Map<string | null, number[]>();
  for (const a of mockAlerts.items) {
    if (a.kind !== "DONATION" || a.replayOf || !a.signatureId || (a.questId && !a.questSucceeded)) continue;
    const i = column.get(a.signatureId);
    const at = Date.parse(a.createdAt);
    if (i === undefined || at < from || at > to) continue;
    const key = a.memberId ?? null;
    let row = counts.get(key);
    if (!row) counts.set(key, (row = columns.map(() => 0)));
    row[i] += 1;
  }

  const crew = mockCrew.crews[b.channelId] ?? [];
  const order = new Map(crew.map((m, i) => [m.id, i]));
  const row = (memberId: string | null, n: number[]): SigCountRow => {
    const m = memberId === null ? undefined : crew.find((x) => x.id === memberId);
    return { memberId, name: memberId === null ? "미지정" : (m?.name ?? "삭제된 멤버"), color: m?.color ?? null, counts: n, total: n.reduce((s, c) => s + c, 0) };
  };
  // 선택한 멤버: only those still in the crew, and 미지정.
  const picked = new Set(settings.memberIds.filter((id) => order.has(id)));
  const listed = new Set<string | null>(settings.rows === "SELECTED" ? [...counts.keys()].filter((id) => id === null) : counts.keys());
  if (settings.rows === "ALL") for (const m of crew) if (m.active) listed.add(m.id);
  if (settings.rows === "SELECTED") for (const id of picked) listed.add(id);
  // 출근 BJ만: members on 휴식 and removed ones leave (미지정 stays).
  if (settings.activeOnly) for (const id of listed) if (id !== null && !crew.find((m) => m.id === id)?.active) listed.delete(id);
  const rank = (id: string | null) => (id === null ? Infinity : (order.get(id) ?? crew.length));
  const rows = [...listed]
    .map((id) => row(id, counts.get(id) ?? columns.map(() => 0)))
    .sort((x, y) => {
      if ((x.memberId === null) !== (y.memberId === null)) return x.memberId === null ? 1 : -1;
      return (settings.sort === "TOTAL" ? y.total - x.total : 0) || rank(x.memberId) - rank(y.memberId);
    });
  const totals = columns.map((_, i) => rows.reduce((s, r) => s + r.counts[i], 0));
  return { settings: structuredClone(settings), visible: !!b.sigCount?.visible, since, columns, rows, totals };
}

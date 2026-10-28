import { formatKstTime, formatNumber } from "@/lib/format";
import { unitLabel } from "@/types/donationUnit";
import { battleGroups, donorMergesOf, donorNamer, excelOf, extraPoints, gameRunCounts, gradeBonus, gradeMultipliersOf, scoreFn, scoreboardRows, scoredFeed, windowReceived } from "./crewCore";
import { CONTRIBUTION_EXPORT_MAX, CONTRIBUTION_KINDS, FEED_ORIGINS, GAMES, feedOrigin, type ContributionLine } from "./crewTypes";
import { STUDIO_CHANNEL, mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 기여도 내역 (server-only) — code-first, StreamDonate 후원 및 통합 관리 "기여도 내역(후원 + 조정, 기능별 필터)" 참고. Every
 * part of the scoreboard, line by line, with the same rules as `scoreboardRows` so a member's lines add up to their score:
 * 멤버 지정 후원 and 후원 리스트 배정 (자동엑셀 points), 보정, 기여도 강탈 (+ for the thief, − for the target), 배틀 배수 extra
 * per battle, 직급 배수 extra for the whole broadcast, and 점수 게임 results once they show on OBS. Members no longer in the
 * crew are left out, as on the scoreboard. Donor names read through 후원자 이름 병합.
 */
export function contributionLines(b: MockBroadcast, now = Date.now()): ContributionLine[] {
  const crew = new Map((mockCrew.crews[b.channelId] ?? []).map((m) => [m.id, m]));
  const end = b.endedAt ?? new Date(now + 1000).toISOString();
  const s = excelOf(b.channelId);
  const nameOf = donorNamer(donorMergesOf(b.channelId));
  const donor = (name: string) => (nameOf(name) === name ? name : `${nameOf(name)} (${name})`);
  const lines: ContributionLine[] = [];
  const push = (memberId: string, line: Omit<ContributionLine, "memberId" | "memberName" | "color">) => {
    const m = crew.get(memberId);
    if (m) lines.push({ ...line, memberId, memberName: m.name, color: m.color });
  };

  for (const a of mockCrew.attributions) {
    if (a.channelId !== b.channelId || a.at < b.startedAt || a.at > end) continue;
    push(a.memberId, { id: `donation-${a.donationId}`, at: a.at, kind: "DONATION", points: scoreFn(a.fnAmount, s), label: `${donor(a.donor ?? a.shownDonor)} · ${formatNumber(a.fnAmount)} FN`, detail: "멤버 지정 후원" });
  }
  for (const f of scoredFeed(b)) {
    if (f.status !== "ASSIGNED" || !f.memberId) continue;
    const origin = FEED_ORIGINS.find((o) => o.key === feedOrigin(f))!.label;
    const detail = [origin, f.oneshot && "한방", f.contribution && "기여도 수기 입력"].filter(Boolean).join(" · ");
    push(f.memberId, { id: `feed-${f.id}`, at: f.at, kind: "FEED", points: f.points, label: `${donor(f.donor)} · ${formatNumber(f.amount)} ${unitLabel(f.unit)}`, detail });
  }
  // A 보정 sent without a 사유 is stored as "보정 +" / "보정 −" for the log; here that is no 사유 at all.
  for (const a of b.adjustments) push(a.memberId, { id: `adjust-${a.id}`, at: a.at, kind: "ADJUST", points: a.points, label: "보정", detail: !a.reason || /^보정 [+−]$/.test(a.reason) ? "사유 없음" : a.reason });
  for (const x of b.steals ?? []) {
    const name = (id: string) => crew.get(id)?.name ?? "삭제된 멤버";
    push(x.thief, { id: `steal-${x.id}-in`, at: x.at, kind: "STEAL", points: x.points, label: `기여도 강탈 · ${x.slotLabel}`, detail: `${name(x.target)}에게서 가져옴` });
    push(x.target, { id: `steal-${x.id}-out`, at: x.at, kind: "STEAL", points: -x.points, label: `기여도 강탈 · ${x.slotLabel}`, detail: `${name(x.thief)}에게 빼앗김` });
  }
  // 배틀 배수: the same window and rounding as crewCore.battleBonus, one line per battle and member.
  for (const x of b.battles ?? []) {
    const m = x.multiplier ?? 1;
    if (m === 1) continue;
    const endMs = Math.min(Date.parse(x.endsAt), x.stoppedAt ? Date.parse(x.stoppedAt) : Infinity);
    const received = windowReceived(b, x.startedAt, endMs > now ? null : new Date(endMs).toISOString());
    for (const id of battleGroups(x).flat().flatMap((side) => side.memberIds)) {
      const extra = extraPoints(received.get(id) ?? 0, m);
      if (extra) push(id, { id: `battle-${x.no}-${id}`, at: x.startedAt, kind: "BATTLE", points: extra, label: `배틀 ${x.no} · ×${m}`, detail: `${x.title || "실시간 배틀"} · 배틀 중 받은 ${formatNumber(received.get(id) ?? 0)}점` });
    }
  }
  const grades = b.gradeMultipliers ?? gradeMultipliersOf(b.channelId);
  for (const [id, extra] of gradeBonus(b)) {
    if (extra) push(id, { id: `grade-${id}`, at: null, kind: "GRADE", points: extra, label: `직급 배수 · ×${grades[id]}`, detail: "이번 방송에 받은 후원 기준" });
  }
  for (const r of b.gameRuns ?? []) {
    if (r.at < b.startedAt || r.at > end || !gameRunCounts(b, r, now)) continue;
    const label = `${GAMES.find((g) => g.key === r.game)?.label ?? "점수 게임"} · ${r.label}`;
    if (r.points) push(r.memberId, { id: `game-${r.id}`, at: r.at, kind: "GAME", points: r.points, label, detail: "OBS에 결과가 나온 뒤 반영" });
    for (const share of r.shares ?? []) push(share.memberId, { id: `game-${r.id}-${share.memberId}`, at: r.at, kind: "GAME", points: share.points, label, detail: "몰수권" });
  }

  // Newest first; 직급 배수 (the whole broadcast) last.
  return lines.sort((x, y) => (x.at === y.at ? x.id.localeCompare(y.id) : x.at === null ? 1 : y.at === null ? -1 : y.at.localeCompare(x.at)));
}

// ── 기여도 내보내기 (2026-10-25) ─────────────────────────────────────────────────────────────────────

const KIND_LABEL = Object.fromEntries(CONTRIBUTION_KINDS.map((k) => [k.key, k.label]));
const stamp = (iso: string) => formatKstTime(iso, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
/** A 회차's column / cell name: "3회차" in a project, else the start date and title; "(진행 중)" while live. */
const roundName = (b: MockBroadcast) =>
  `${b.round ? `${b.round}회차` : `${formatKstTime(b.startedAt, { month: "2-digit", day: "2-digit" })} ${b.title}`}${b.endedAt ? "" : " (진행 중)"}`;
/** Characters a file name cannot hold become _. */
const fileSafe = (s: string) => s.replace(/[\\/:*?"<>|]/g, "_").trim() || "방송";

/** A 기여도 내보내기 table: headers and rows, the file name without its extension, and how many rows it counts. */
export type ContributionTable = { name: string; sheet: string; headers: string[]; rows: (string | number)[][]; count: number; truncated: boolean };

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const ofChannel = () => (mockCrew.broadcasts ?? []).filter((b) => b.channelId === STUDIO_CHANNEL);

/**
 * 기여도 내보내기 (CSV or Excel): `broadcastId` (one broadcast, LINES only), or `project` (a project name, or null for the
 * broadcasts started without one — every 회차 oldest first, the live one included). ROUNDS: members × 회차 with each
 * 회차's final score (the live one's current score), 합계 per member and a 합계 row, best total first. LINES: every 기여도
 * 내역 line, with its 회차 — recomputed with today's 자동엑셀 settings, so it can differ from ROUNDS if those changed after a
 * 회차 ended. Up to CONTRIBUTION_EXPORT_MAX lines.
 */
export function contributionTable(input: unknown): ContributionTable | { message: string } {
  const v = rec(input);
  if (v.format !== "ROUNDS" && v.format !== "LINES") return { message: "내보낼 형식을 골라 주세요." };
  let list: MockBroadcast[];
  let name: string;
  if (v.broadcastId !== undefined) {
    const b = ofChannel().find((x) => x.id === v.broadcastId);
    if (!b) return { message: "방송을 찾을 수 없어요." };
    if (v.format !== "LINES") return { message: "회차별 합계는 프로젝트로 내보내 주세요." };
    list = [b];
    name = `기여도내역-${fileSafe(b.title)}`;
  } else {
    if (v.project !== null && typeof v.project !== "string") return { message: "프로젝트를 골라 주세요." };
    list = ofChannel()
      .filter((b) => (b.project ?? null) === v.project)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    if (!list.length) return { message: "내보낼 방송이 없어요." };
    name = `기여도-${fileSafe((v.project as string | null) ?? "프로젝트 없음")}-${v.format === "ROUNDS" ? "회차별" : "상세"}`;
  }

  if (v.format === "ROUNDS") {
    // Each 회차's own score (with 기여도 공유 a score also holds earlier 회차 — the 합계 counts them once).
    const scores = list.map((b) => new Map((b.final ?? scoreboardRows(b)).map((r) => [r.memberId, { name: r.name, score: r.score - (r.carried ?? 0) }])));
    const crew = new Map((mockCrew.crews[STUDIO_CHANNEL] ?? []).map((m) => [m.id, m.name]));
    const ids = [...new Set(scores.flatMap((m) => [...m.keys()]))];
    const rows = ids
      .map((id) => {
        const each = scores.map((m) => m.get(id)?.score ?? 0);
        // The current name, else the name of their last 회차.
        const last = [...scores].reverse().find((m) => m.has(id))!.get(id)!.name;
        return { name: crew.get(id) ?? last, each, total: each.reduce((s, x) => s + x, 0) };
      })
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    const totals = list.map((_, i) => rows.reduce((s, r) => s + r.each[i], 0));
    return {
      name,
      sheet: "회차별 합계",
      headers: ["멤버", ...list.map(roundName), "합계"],
      rows: [...rows.map((r) => [r.name, ...r.each, r.total]), ["합계", ...totals, totals.reduce((s, x) => s + x, 0)]],
      count: rows.length,
      truncated: false
    };
  }

  // Oldest first within each 회차 (the screen shows newest first), 직급 배수 for the whole 회차 last.
  const oldestFirst = (b: MockBroadcast) => contributionLines(b).sort((x, y) => (x.at === y.at ? x.id.localeCompare(y.id) : x.at === null ? 1 : y.at === null ? -1 : x.at.localeCompare(y.at)));
  const lines = list.flatMap((b) => oldestFirst(b).map((l) => ({ b, l })));
  const shown = lines.slice(0, CONTRIBUTION_EXPORT_MAX);
  return {
    name,
    sheet: "기여도 내역",
    headers: ["회차", "방송", "시각", "멤버", "종류", "내용", "상세", "점수"],
    rows: shown.map(({ b, l }) => [roundName(b), b.title, l.at ? stamp(l.at) : "방송 전체", l.memberName, KIND_LABEL[l.kind], l.label, l.detail, l.points]),
    count: shown.length,
    truncated: lines.length > shown.length
  };
}

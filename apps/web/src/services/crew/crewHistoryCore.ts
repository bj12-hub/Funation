import { formatNumber } from "@/lib/format";
import { unitLabel } from "@/types/donationUnit";
import { battleGroups, donorMergesOf, donorNamer, excelOf, extraPoints, gameRunCounts, gradeBonus, gradeMultipliersOf, scoreFn, scoredFeed, windowReceived } from "./crewCore";
import { FEED_ORIGINS, GAMES, feedOrigin, type ContributionLine } from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

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

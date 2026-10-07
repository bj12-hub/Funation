import { MOCK_TAKEN_NICKNAMES, mockAccount } from "@/services/account/mockStore";
import { memberStore } from "@/services/admin/memberCore";
import { getAllCreatorsForAdmin } from "@/services/creators/creators";
import { listDonationRecords } from "@/services/wallet/walletHistory";
import {
  GLOBAL_TITLES,
  GRADES,
  STORE_TITLES,
  globalTitleLabel,
  gradeLabel,
  storeTitleLabel,
  type AlertBadges,
  type DonationNickname,
  type Progress,
  type SupporterIdentity
} from "./identityTypes";
import { mockIdentity } from "./mockIdentityStore";

/**
 * Server-only identity internals shared by the Server Actions in ./identity.ts and the Donation
 * Core. Deliberately NOT a "use server" module: nothing here may be callable from the browser
 * (e.g. attributing a donation to a nickname happens only inside a completed donation).
 */

const DAY = 86_400_000;

function progress(tiers: readonly { label: string; minFn: number }[], currentFn: number): Progress {
  const next = tiers.find((t) => t.minFn > currentFn) ?? null;
  const prev = [...tiers].reverse().find((t) => t.minFn <= currentFn)?.minFn ?? 0;
  const percent = next ? Math.min(100, Math.floor(((currentFn - prev) / (next.minFn - prev)) * 100)) : 100;
  return { currentFn, nextLabel: next?.label ?? null, nextMinFn: next?.minFn ?? null, percent };
}

export function nicknameList(): { id: string; name: string }[] {
  return [{ id: "nk-default", name: mockAccount.nickname }, ...mockIdentity.nicknames];
}

export function computeIdentity(): SupporterIdentity {
  const records = listDonationRecords().filter((d) => d.status === "COMPLETED");
  const now = Date.now();
  const lifetimeFn = records.reduce((s, d) => s + d.fnAmount, 0);
  const last30Fn = records.filter((d) => now - new Date(d.donatedAt.replace(" ", "T")).getTime() <= 30 * DAY).reduce((s, d) => s + d.fnAmount, 0);

  const nicknames: DonationNickname[] = nicknameList().map((n) => {
    const mine = records.filter((d) => (mockIdentity.attribution[d.id] ?? mockIdentity.defaultId) === n.id);
    return { id: n.id, name: n.name, isDefault: n.id === mockIdentity.defaultId, totalFn: mine.reduce((s, d) => s + d.fnAmount, 0), count: mine.length };
  });

  const grade = [...GRADES].reverse().find((g) => last30Fn >= g.minFn)!;
  const earned = GLOBAL_TITLES.filter((t) => lifetimeFn >= t.minFn).map((t) => t.key);

  const byCreator = new Map<string, { name: string; total: number }>();
  for (const d of records) {
    const e = byCreator.get(d.creatorId) ?? { name: d.creatorName, total: 0 };
    e.total += d.fnAmount;
    byCreator.set(d.creatorId, e);
  }
  const stores = [...byCreator.entries()]
    .map(([creatorId, e]) => ({
      creatorId,
      creatorName: e.name,
      totalFn: e.total,
      title: [...STORE_TITLES].reverse().find((t) => e.total >= t.minFn)?.key ?? null,
      progress: progress(STORE_TITLES, e.total)
    }))
    .sort((a, b) => b.totalFn - a.totalFn);

  return {
    nicknames,
    grade: { key: grade.key, last30Fn, progress: progress(GRADES.slice(1), last30Fn) },
    global: { lifetimeFn, earned, best: earned.at(-1) ?? null, progress: progress(GLOBAL_TITLES, lifetimeFn) },
    stores,
    equip: { ...mockIdentity.equip }
  };
}

/**
 * Names an 별명 may not take (2026-10-08 결정 "다른 회원 닉네임·채널명 금지"): other members' nicknames in the member
 * directory and every channel name the creator service knows, trimmed and lowercased. The member's own nickname is
 * not in it (it is already the default 별명). 별명 are otherwise unique only within the member's own list.
 */
export async function namesTakenByOthers(): Promise<Set<string>> {
  const norm = (name: string) => name.trim().toLowerCase();
  const own = norm(mockAccount.nickname);
  const channels = (await getAllCreatorsForAdmin()).map((c) => c.name);
  const names = [...MOCK_TAKEN_NICKNAMES, ...memberStore().supporters.map((m) => m.nickname), ...channels].map(norm);
  return new Set(names.filter((n) => n !== own));
}

/** Whether a nickname id belongs to the signed-in supporter. */
export const ownsNickname = (nicknameId: unknown) => typeof nicknameId === "string" && nicknameList().some((n) => n.id === nicknameId);

/** Records which nickname a completed donation was sent under (Donation Core only). */
export function attributeDonation(donationId: string, nicknameId: string | null) {
  if (nicknameId && nicknameId !== mockIdentity.defaultId && ownsNickname(nicknameId)) mockIdentity.attribution[donationId] = nicknameId;
}

/** Badges a donation alert shows for this supporter and creator. */
export function resolveBadges(nicknameId: unknown, creatorId: unknown): AlertBadges {
  const id = computeIdentity();
  const list = nicknameList();
  const name = list.find((n) => n.id === nicknameId)?.name ?? list.find((n) => n.id === mockIdentity.defaultId)!.name;
  const e = id.equip;
  const global = e.globalTitle === "OFF" ? null : e.globalTitle === "AUTO" ? id.global.best : e.globalTitle;
  const store = e.showStoreTitle ? (id.stores.find((s) => s.creatorId === creatorId)?.title ?? null) : null;
  return {
    name,
    grade: e.showGrade && id.grade.key !== "FRIEND" ? gradeLabel(id.grade.key) : null,
    globalTitle: global ? globalTitleLabel(global) : null,
    storeTitle: store ? storeTitleLabel(store) : null
  };
}

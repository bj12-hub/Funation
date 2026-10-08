import { formatNumber } from "@/lib/format";

/**
 * 뽑기 후원 (code-first; 2026-10-04 결정: 당첨은 크리에이터 상품이고 FN으로 지급하지 않는다). The creator's
 * 뽑기 위젯 settings (Figma 373:3675) define each 뽑기: price, 당첨확률형 (percents) or 상품소진형 (stock).
 * The server draws at payment; the 뽑기 overlay plays it and the 당첨 리스트 (전광판) lists the wins.
 * Remote flow: 펀페이 1009:6330 (상품 풀) · 1009:6549 (실행 대기) · 1009:6768 (결과 확인). Client-safe types.
 */

export type GachaDrawStatus = "QUEUED" | "SPINNING" | "RESULT" | "DONE";

export const GACHA_STATUS_LABEL: Record<GachaDrawStatus, string> = {
  QUEUED: "실행 대기",
  SPINNING: "뽑는 중",
  RESULT: "결과 확인",
  DONE: "완료"
};

/** 요청 번호 (펀페이 1009:6549 "DR-…"). */
export const gachaNo = (seq: number) => `#DR-${String(seq).padStart(5, "0")}`;

/** The 알림 메시지 템플릿 with {닉네임} and {금액} filled. */
export const fillGachaMessage = (template: string, nickname: string, amount: number) =>
  template.replaceAll("{닉네임}", nickname).replaceAll("{금액}", `${formatNumber(amount)}FN`);

/** A 뽑기 as the donation panel shows it: percents (당첨확률형) or what is left (상품소진형). */
export type GachaOffer = {
  id: string;
  name: string;
  price: number;
  mode: "PROBABILITY" | "STOCK";
  prizes: { name: string; blank: boolean; percent: number | null; left: number | null }[];
  /** 1인 횟수 한도 per day (null = 제한 없음). */
  limit: number | null;
  /** 상품소진형 with nothing left. */
  soldOut: boolean;
};

export type MyGachaDraw = {
  id: string;
  no: string;
  gachaId: string;
  gachaName: string;
  amount: number;
  createdAt: string;
  status: GachaDrawStatus;
  /** 1-based place among the waiting draws (QUEUED only). */
  position: number | null;
  /** Shown once the machine stops. */
  prize: string | null;
  blank: boolean | null;
};

export type RoomGacha = { waiting: number; usedToday: Record<string, number> | null; mine: MyGachaDraw[] };

/** The draw on the 뽑기 overlay; the prize only once revealed. */
export type GachaStage = {
  id: string;
  no: string;
  status: "SPINNING" | "RESULT";
  gachaName: string;
  style: "CAPSULE" | "BOX" | "CREDIT";
  pointColor: string;
  donor: string;
  amount: number;
  message: string;
  prize: string | null;
  blank: boolean | null;
  endsAt: string;
};

export type GachaRow = {
  id: string;
  no: string;
  gachaName: string;
  donor: string;
  amount: number;
  createdAt: string;
  status: GachaDrawStatus;
  prize: string | null;
  blank: boolean | null;
  /** 수령 여부 for a prize (null for 꽝 or before the result). */
  claimed: boolean | null;
};

export type GachaRemoteView = { stage: GachaStage | null; queue: GachaRow[]; recent: GachaRow[]; unclaimed: number; hidden: boolean };

/** 당첨 리스트 위젯 (전광판): prizes won in the period, newest first. */
export type GachaBoardView = { title: string; speed: "NORMAL" | "FAST" | "FIXED"; rows: { id: string; donor: string; gachaName: string; prize: string; claimed: boolean }[] };

export type GachaControlResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

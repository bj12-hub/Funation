import { formatNumber } from "@/lib/format";
import { luckyTierFor, type DonationCatalog, type DonationTypeKey } from "@/services/donations/donationCatalog";
import { parseYouTubeId, type DonationDetails } from "@/services/donations/donationTypes";

/**
 * Form state per donation type and the pure step that turns it into a request.
 * The browser checks only what it needs for feedback; the server validates everything again and
 * owns prices (signature / wishlist amounts shown here are the server's catalog values).
 */

export type TextState = { amount: string; message: string; voiceId: string | null };
export type MiniState = { amount: string; text: string; colorId: string; enterToSend: boolean };
export type VideoState = { amount: string; url: string; start: string; end: string; terms: boolean };
export type SignatureState = { signatureId: string | null; message: string };
export type WishlistState = { itemId: string | null; message: string; voiceId: string | null };
/** Each box has a stable id so React keys survive deletes. */
export type LuckyState = { boxes: { id: number; winner: boolean }[]; selected: number | null; amount: string; terms: boolean };

export type RouletteState = { tierKey: string };
/** Time limits are typed as minutes + seconds (867:* "10분 00초"). */
export type TimeLimit = { minutes: string; seconds: string };
export type QuestState = { title: string; success: string; cancel: string; time: TimeLimit; creatorDecides: boolean; terms: boolean };
export type DrawingState = { amount: string; title: string; image: string | null; showProcess: boolean; canvasMode: boolean; terms: boolean };
export type QuizRewardsState = { time: TimeLimit; correct: string; wrong: string; terms: boolean };
export type QuizChoiceState = QuizRewardsState & { question: string; options: string[]; correctIndex: number };
export type QuizInitialState = QuizRewardsState & { question: string; answer: string; hint: string };
export type QuizDrawingState = QuizRewardsState & { image: string | null; question: string; answer: string };

export type FormStates = {
  TEXT: TextState;
  MINI: MiniState;
  VIDEO: VideoState;
  SIGNATURE: SignatureState;
  WISHLIST: WishlistState;
  LUCKYBOX: LuckyState;
  ROULETTE: RouletteState;
  QUEST: QuestState;
  DRAWING: DrawingState;
  QUIZ_CHOICE: QuizChoiceState;
  QUIZ_INITIAL: QuizInitialState;
  QUIZ_DRAWING: QuizDrawingState;
};

export type FormKey = keyof FormStates;

export function initialStates(catalog: DonationCatalog): FormStates {
  const voiceId = catalog.voices[0]?.id ?? null;
  return {
    TEXT: { amount: "", message: "", voiceId },
    MINI: { amount: "", text: "", colorId: catalog.miniColors[1]?.id ?? catalog.miniColors[0]?.id ?? "", enterToSend: true },
    VIDEO: { amount: "", url: "", start: "00:00", end: "00:30", terms: false },
    SIGNATURE: { signatureId: null, message: "" },
    WISHLIST: { itemId: null, message: "", voiceId },
    // 851:5231 default: three boxes, the middle one wins, 5,000 FN.
    LUCKYBOX: {
      boxes: [
        { id: 1, winner: false },
        { id: 2, winner: true },
        { id: 3, winner: false }
      ],
      selected: 2,
      amount: String(catalog.luckyBox.presets[1] ?? catalog.luckyBox.minAmount),
      terms: false
    },
    // 867:2494 selects GOLD.
    ROULETTE: { tierKey: catalog.roulette.tiers[1]?.key ?? catalog.roulette.tiers[0]?.key ?? "" },
    QUEST: { title: "", success: "", cancel: "", time: { minutes: "10", seconds: "00" }, creatorDecides: true, terms: false },
    DRAWING: { amount: "", title: "", image: null, showProcess: true, canvasMode: false, terms: false },
    QUIZ_CHOICE: { question: "", options: ["", "", ""], correctIndex: 0, ...quizDefaults() },
    QUIZ_INITIAL: { question: "", answer: "", hint: "", ...quizDefaults() },
    QUIZ_DRAWING: { image: null, question: "", answer: "", ...quizDefaults() }
  };
}

function quizDefaults(): QuizRewardsState {
  return { time: { minutes: "00", seconds: "30" }, correct: "", wrong: "", terms: false };
}

/** Minutes + seconds → seconds, or null when not a valid positive time. */
export function timeToSec(time: TimeLimit): number | null {
  const m = Number(time.minutes || "0");
  const s = Number(time.seconds || "0");
  if (!Number.isInteger(m) || !Number.isInteger(s) || s > 59 || m < 0 || s < 0) return null;
  const total = m * 60 + s;
  return total > 0 ? total : null;
}

function quizDraft(s: QuizRewardsState, catalog: DonationCatalog, title: string) {
  const correct = digits(s.correct);
  const wrong = digits(s.wrong);
  const amount = correct === null && wrong === null ? null : Math.max(correct ?? 0, wrong ?? 0);
  const time = timeToSec(s.time);
  const error =
    amount !== null && amount < catalog.game.minAmount
      ? `보상 금액은 ${formatNumber(catalog.game.minAmount)} FN 이상이어야 해요.`
      : time === null
        ? "제한 시간을 확인해 주세요."
        : time > catalog.game.maxTimeSec
          ? `제한 시간은 최대 ${catalog.game.maxTimeSec / 60}분이에요.`
          : null;
  return {
    amount,
    error,
    time,
    ready: correct !== null && wrong !== null && !error && s.terms,
    rewards: { timeLimitSec: time ?? 0, correctReward: correct ?? 0, wrongReward: wrong ?? 0, termsAgreed: true as const },
    buttonLabel: `${title} ${formatNumber(amount ?? 0)} FN 후원하기`,
    summaryRows: [
      { label: "제한 시간", value: `${s.time.minutes || "0"}분 ${s.time.seconds || "0"}초` },
      { label: "보상", value: `정답 ${formatNumber(correct ?? 0)} FN · 오답 ${formatNumber(wrong ?? 0)} FN` }
    ]
  };
}

export type Draft = {
  /** Request details when the form is complete; `null` while something is missing. */
  details: DonationDetails | null;
  amount: number | null;
  /** Inline problem to show (already-typed but invalid input). */
  error: string | null;
  /** Rows for the 613:6 confirm popup. */
  summary: { label: string; value: string }[];
  /** Text for the chat notice after success. */
  chatText: string;
  /** Submit label when the type has its own (e.g. "GOLD BOX 5,000 FN 후원하기"). */
  buttonLabel?: string;
};

/** "mm:ss" → seconds, or null. */
export function parseClock(value: string): number | null {
  const m = value.trim().match(/^(\d{1,2}):([0-5]\d)$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

const digits = (value: string) => (value ? Number(value) : null);

export function buildDraft(key: FormKey, states: FormStates, catalog: DonationCatalog): Draft {
  switch (key) {
    case "TEXT": {
      const s = states.TEXT;
      const amount = digits(s.amount);
      const min = catalog.minAmount.TEXT;
      const tooSmall = amount !== null && amount < min;
      return {
        details: amount !== null && !tooSmall ? { type: "TEXT", amount, message: s.message.trim(), voiceId: s.voiceId } : null,
        amount,
        error: tooSmall ? `최소 ${formatNumber(min)} FN부터 후원할 수 있어요` : null,
        summary: [{ label: "후원 메시지", value: s.message.trim() || "메시지 없음" }],
        chatText: s.message.trim()
      };
    }
    case "MINI": {
      const s = states.MINI;
      const amount = digits(s.amount);
      const min = catalog.minAmount.MINI;
      const tooSmall = amount !== null && amount < min;
      const text = s.text.trim();
      return {
        details: amount !== null && !tooSmall && text ? { type: "MINI", amount, text, colorId: s.colorId } : null,
        amount,
        error: tooSmall ? `최소 ${formatNumber(min)} FN부터 후원할 수 있어요` : null,
        summary: [{ label: "텍스트 내용", value: text }],
        chatText: `⚡ ${text}`
      };
    }
    case "VIDEO": {
      const s = states.VIDEO;
      const amount = digits(s.amount);
      const min = catalog.minAmount.VIDEO;
      const tooSmall = amount !== null && amount < min;
      const videoId = s.url ? parseYouTubeId(s.url) : null;
      const start = parseClock(s.start);
      const end = parseClock(s.end);
      const rangeOk = start !== null && end !== null && end > start;
      const error = tooSmall
        ? `최소 ${formatNumber(min)} FN부터 후원할 수 있어요`
        : s.url && !videoId
          ? "YouTube 영상 주소를 입력해 주세요."
          : !rangeOk
            ? "종료 시간은 시작 시간보다 늦어야 해요."
            : null;
      const complete = amount !== null && !error && videoId && s.terms && start !== null && end !== null;
      return {
        details: complete
          ? { type: "VIDEO", amount, videoUrl: s.url.trim(), startSec: start, endSec: end, termsAgreed: true }
          : null,
        amount,
        error,
        summary: [
          { label: "영상", value: videoId ? `youtu.be/${videoId}` : "-" },
          { label: "재생 구간", value: `${s.start} ~ ${s.end}` }
        ],
        chatText: "🎬 영상 후원"
      };
    }
    case "SIGNATURE": {
      const s = states.SIGNATURE;
      const signature = catalog.signatures.find((x) => x.id === s.signatureId) ?? null;
      return {
        details: signature ? { type: "SIGNATURE", signatureId: signature.id, message: s.message.trim() } : null,
        amount: signature?.price ?? null,
        error: null,
        summary: [
          { label: "시그니처", value: signature?.name ?? "-" },
          { label: "메시지", value: s.message.trim() || "메시지 없음" }
        ],
        chatText: `✨ ${signature?.name ?? ""}${s.message.trim() ? ` · ${s.message.trim()}` : ""}`
      };
    }
    case "WISHLIST": {
      const s = states.WISHLIST;
      const item = catalog.wishlist.find((x) => x.id === s.itemId) ?? null;
      return {
        details: item?.inStock ? { type: "WISHLIST", itemId: item.id, message: s.message.trim(), voiceId: s.voiceId } : null,
        amount: item?.price ?? null,
        error: item && !item.inStock ? "선택한 상품은 지금 후원할 수 없어요." : null,
        summary: [
          { label: "위시 상품", value: item ? `${item.emoji} ${item.name}` : "-" },
          { label: "후원 메시지", value: s.message.trim() || "메시지 없음" }
        ],
        chatText: `🎁 ${item?.name ?? ""}`
      };
    }
    case "LUCKYBOX": {
      const s = states.LUCKYBOX;
      const lucky = catalog.luckyBox;
      const amount = digits(s.amount);
      const winners = s.boxes.filter((b) => b.winner).length;
      const tier = luckyTierFor(lucky, amount ?? 0);
      const error =
        amount === null || amount < lucky.minAmount
          ? `후원 금액은 ${formatNumber(lucky.minAmount)} FN 이상 입력해주세요.`
          : amount > lucky.maxAmount
            ? `후원 금액은 ${formatNumber(lucky.maxAmount)} FN 이하로 입력해주세요.`
            : winners === 0
              ? "당첨될 박스를 1개 이상 선택해주세요."
              : null;
      return {
        details: !error && amount !== null && s.terms ? { type: "LUCKYBOX", amount, boxCount: s.boxes.length, winnerCount: winners, termsAgreed: true } : null,
        amount,
        error,
        summary: [
          { label: "박스 등급", value: `${tier.label} BOX` },
          { label: "박스 구성", value: `박스 ${s.boxes.length}개 · 당첨 ${winners}개` }
        ],
        chatText: `🎲 ${tier.label} BOX 럭키박스`,
        buttonLabel: `${tier.label} BOX ${formatNumber(amount ?? 0)} FN 후원하기`
      };
    }
    case "ROULETTE": {
      const tier = catalog.roulette.tiers.find((t) => t.key === states.ROULETTE.tierKey) ?? null;
      return {
        details: tier ? { type: "ROULETTE", tierKey: tier.key } : null,
        amount: tier?.amount ?? null,
        error: null,
        summary: [{ label: "룰렛", value: tier ? `${tier.label} 룰렛` : "-" }],
        chatText: `🎡 ${tier?.label ?? ""} 룰렛`,
        buttonLabel: tier ? `${tier.label} 룰렛 ${formatNumber(tier.amount)} FN 후원하기` : undefined
      };
    }
    case "QUEST": {
      const s = states.QUEST;
      const success = digits(s.success);
      const cancel = digits(s.cancel);
      const time = timeToSec(s.time);
      const title = s.title.trim();
      const error =
        success !== null && success < catalog.game.minAmount
          ? `성공 보상은 ${formatNumber(catalog.game.minAmount)} FN 이상이어야 해요.`
          : success !== null && (cancel ?? 0) > success
            ? "취소 금액은 성공 보상보다 클 수 없어요."
            : time === null || time > catalog.game.maxTimeSec
              ? "제한 시간을 확인해 주세요."
              : null;
      const ready = title && success !== null && cancel !== null && time !== null && !error && s.terms;
      return {
        details: ready
          ? { type: "QUEST", title, successReward: success, cancelAmount: cancel, timeLimitSec: time, creatorDecides: s.creatorDecides, termsAgreed: true }
          : null,
        amount: success,
        error,
        summary: [
          { label: "퀘스트", value: title || "-" },
          { label: "실패 시", value: "전액 환불" },
          { label: "취소 금액", value: `${formatNumber(cancel ?? 0)} FN` },
          { label: "제한 시간", value: `${s.time.minutes || "0"}분 ${s.time.seconds || "0"}초` }
        ],
        chatText: `🏆 퀘스트: ${title}`,
        buttonLabel: `퀘스트 ${formatNumber(success ?? 0)} FN 후원하기`
      };
    }
    case "DRAWING": {
      const s = states.DRAWING;
      const amount = digits(s.amount);
      const tooSmall = amount !== null && amount < catalog.game.minAmount;
      const title = s.title.trim();
      return {
        details:
          amount !== null && !tooSmall && title && s.image && s.terms
            ? { type: "DRAWING", amount, title, image: s.image, showProcess: s.showProcess, canvasMode: s.canvasMode, termsAgreed: true }
            : null,
        amount,
        error: tooSmall ? `최소 ${formatNumber(catalog.game.minAmount)} FN부터 후원할 수 있어요` : null,
        summary: [{ label: "그림 제목", value: title || "-" }],
        chatText: `🎨 ${title}`,
        buttonLabel: `그림 후원 ${formatNumber(amount ?? 0)} FN 보내기`
      };
    }
    case "QUIZ_CHOICE": {
      const s = states.QUIZ_CHOICE;
      const q = quizDraft(s, catalog, "객관식 퀴즈");
      const question = s.question.trim();
      const options = s.options.map((o) => o.trim());
      const ok = question && options.every(Boolean) && q.ready;
      return {
        details: ok ? { type: "QUIZ_CHOICE", question, options, correctIndex: s.correctIndex, ...q.rewards } : null,
        amount: q.amount,
        error: q.error,
        summary: [
          { label: "문제", value: question || "-" },
          { label: "정답", value: options[s.correctIndex] || "-" },
          ...q.summaryRows
        ],
        chatText: `☷ 객관식 퀴즈: ${question}`,
        buttonLabel: q.buttonLabel
      };
    }
    case "QUIZ_INITIAL": {
      const s = states.QUIZ_INITIAL;
      const q = quizDraft(s, catalog, "초성 퀴즈");
      const question = s.question.trim();
      const answer = s.answer.trim();
      return {
        details: question && answer && q.ready ? { type: "QUIZ_INITIAL", question, answer, hint: s.hint.trim(), ...q.rewards } : null,
        amount: q.amount,
        error: q.error,
        summary: [{ label: "문제", value: question || "-" }, { label: "정답 · 힌트", value: `${answer || "-"} · ${s.hint.trim() || "없음"}` }, ...q.summaryRows],
        chatText: `ㄱ 초성 퀴즈: ${question}`,
        buttonLabel: q.buttonLabel
      };
    }
    case "QUIZ_DRAWING": {
      const s = states.QUIZ_DRAWING;
      const q = quizDraft(s, catalog, "그림 퀴즈");
      const question = s.question.trim();
      const answer = s.answer.trim();
      return {
        details: question && answer && s.image && q.ready ? { type: "QUIZ_DRAWING", image: s.image, question, answer, ...q.rewards } : null,
        amount: q.amount,
        error: q.error,
        summary: [{ label: "문제", value: question || "-" }, { label: "정답", value: answer || "-" }, ...q.summaryRows],
        chatText: `✎ 그림 퀴즈: ${question}`,
        buttonLabel: q.buttonLabel
      };
    }
  }
}

const FORM_KEYS: Record<FormKey, true> = {
  TEXT: true,
  MINI: true,
  VIDEO: true,
  SIGNATURE: true,
  WISHLIST: true,
  LUCKYBOX: true,
  ROULETTE: true,
  QUEST: true,
  DRAWING: true,
  QUIZ_CHOICE: true,
  QUIZ_INITIAL: true,
  QUIZ_DRAWING: true
};

export const isFormKey = (key: DonationTypeKey): key is FormKey => key in FORM_KEYS;

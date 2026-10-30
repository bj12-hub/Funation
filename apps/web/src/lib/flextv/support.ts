import { FlextvUnavailableError, flextvRequest, isRecord, type FlextvRequest, type FlextvResponse } from "./client";
import { readRefOptions } from "./studio";

/**
 * FLEXTV's 고객센터 (phase 7, docs/development/flextv-backend.md "7단계") — server/routes/api/cs and v2/api/cs of
 * FLEXTV's web repository: its 공지사항, 자주 묻는 질문 and the member's 1:1 문의 (written here too since phase 9).
 * Their texts are HTML from FLEXTV's editor; they are shown here as plain paragraphs (`htmlToParagraphs`), never as
 * HTML. The `read*` functions are pure (support.test.ts).
 */

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null);
const text = (value: unknown) => (typeof value === "string" ? value : "");
const idOf = (value: unknown) => {
  const id = num(value);
  return id !== null && id > 0 && Number.isSafeInteger(id) ? String(id) : null;
};

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", middot: "·" };

/** FLEXTV's editor HTML as text paragraphs: tags dropped, entities decoded, one paragraph per block or line break. */
export function htmlToParagraphs(html: string): string[] {
  return html
    .replace(/<\s*(script|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|tr|blockquote)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
      if (code[0] === "#") {
        const cp = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
      }
      return ENTITIES[code.toLowerCase()] ?? entity;
    })
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** FLEXTV's times as yyyy-mm-dd in KST. */
const kstDate = (value: unknown) => {
  const t = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(t) ? new Date(t + 9 * 3_600_000).toISOString().slice(0, 10) : "";
};
const iso = (value: unknown) => {
  const t = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : "";
};

/* ── 공지사항 ────────────────────────────────────────────── */

export type FlextvNotice = { id: string; title: string; important: boolean; date: string; paragraphs: string[] };

/** `GET /api/cs/notice-list`: `{ data: [{ id, title, mustRead, createdAt }], count }` (published ones only). */
export function readNoticeList(data: unknown): FlextvNotice[] {
  const rows = isRecord(data) && Array.isArray(data.data) ? data.data : [];
  return rows.flatMap((raw) => {
    const id = isRecord(raw) ? idOf(raw.id) : null;
    if (!id || !isRecord(raw)) return [];
    return [{ id, title: text(raw.title), important: Boolean(num(raw.mustRead)), date: kstDate(raw.createdAt), paragraphs: [] }];
  });
}

/** FLEXTV's 공지사항 board (its `boardDiv` 1). */
const NOTICE_BOARD = 1;

/** `GET /api/cs/notice-page?page=:id`: `{ notices, prevnotices, nextnotices }`, the text in `bcontent`. Shown only as a published 공지사항. */
export function readNoticePage(data: unknown): FlextvNotice | null {
  const n = isRecord(data) && isRecord(data.notices) ? data.notices : null;
  const id = n ? idOf(n.id) : null;
  if (!n || !id || num(n.open) !== 1 || num(n.boardDiv) !== NOTICE_BOARD) return null;
  return { id, title: text(n.title), important: Boolean(num(n.mustRead)), date: kstDate(n.createdAt), paragraphs: htmlToParagraphs(text(n.bcontent) || text(n.content)) };
}

const NOTICE_LIMIT = 50;

export async function fetchNotices(): Promise<FlextvNotice[]> {
  const response = await flextvRequest(`/api/cs/notice-list?offset=0&limit=${NOTICE_LIMIT}`);
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV 공지사항 answered ${response.status}`);
  return readNoticeList(response.data);
}

export async function fetchNotice(id: string): Promise<FlextvNotice | null> {
  if (!idOf(id)) return null;
  const response = await flextvRequest(`/api/cs/notice-page?page=${id}`);
  if (response.status === 204 || response.status === 400 || response.status === 404) return null;
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV 공지사항 answered ${response.status}`);
  return readNoticePage(response.data);
}

/* ── 자주 묻는 질문 · 1:1 문의 ──────────────────────────────── */

export type FlextvQuestion = { id: string; title: string; paragraphs: string[]; answer: string[]; answered: boolean; createdAt: string };

/** FLEXTV's questions board (`questions`): its FAQ (boardType 2) and the member's 1:1 문의 share one shape. */
export function readQuestions(data: unknown): FlextvQuestion[] {
  const rows = isRecord(data) && Array.isArray(data.data) ? data.data : [];
  return rows.flatMap((raw) => {
    const id = isRecord(raw) ? idOf(raw.id) : null;
    if (!id || !isRecord(raw)) return [];
    const answer = htmlToParagraphs(text(raw.answer));
    return [{ id, title: text(raw.title), paragraphs: htmlToParagraphs(text(raw.content)), answer, answered: Boolean(num(raw.isCompleted)) || answer.length > 0, createdAt: iso(raw.createdAt) }];
  });
}

const FAQ_LIMIT = 100;

/** FLEXTV's 자주 묻는 질문, optionally searched (FLEXTV searches the text). */
export async function fetchFaqs(query?: string): Promise<FlextvQuestion[]> {
  const search = query ? `&title=${encodeURIComponent(query)}` : "";
  const response = await flextvRequest(`/v2/api/cs/inquiry-list?boardType=2&offset=0&limit=${FAQ_LIMIT}${search}`);
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV 자주 묻는 질문 answered ${response.status}`);
  return readQuestions(response.data);
}

/** The member's 1:1 문의 on FLEXTV; null when FLEXTV no longer accepts the token. */
export async function fetchMyInquiries(token: string): Promise<FlextvQuestion[] | null> {
  const response = await flextvRequest("/api/cs/inquiry-list?offset=0&limit=50", { token });
  if (response.status === 401) return null;
  if (response.status === 204) return [];
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV 1:1 문의 answered ${response.status}`);
  return readQuestions(response.data);
}

/* ── 1:1 문의 작성 (phase 9) ─────────────────────────────── */

export type InquiryCategory = { value: string; label: string };

/** `GET /api/guest/refcode/questionsCategory`: `[{ key, value, text }]`; FLEXTV takes codes 1–19 as 1:1 문의. */
export function readInquiryCategories(data: unknown): InquiryCategory[] {
  const rows = Array.isArray(data) ? data : [];
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    if (!isRecord(row)) return [];
    const code = num(row.value);
    const label = text(row.text).trim();
    if (code === null || !Number.isInteger(code) || code < 1 || code > 19 || !label || seen.has(String(code))) return [];
    seen.add(String(code));
    return [{ value: String(code), label }];
  });
}

export async function fetchInquiryCategories(): Promise<InquiryCategory[]> {
  const response = await flextvRequest("/api/guest/refcode/questionsCategory");
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV inquiry categories answered ${response.status}`);
  return readInquiryCategories(response.data);
}

export type InquiryPost = { kind: "OK"; id: string } | { kind: "REFUSED"; message: string } | { kind: "UNAUTHORIZED" };

/**
 * FLEXTV answers `{ result: true, data: { id, … } }`, or `{ result: false, data: reason }` (a suspended member …). Its
 * 신고 answers the same way (`refused`: the words when FLEXTV gives no reason).
 */
export function mapInquiryPost({ status, data }: Pick<FlextvResponse, "status" | "data">, refused = "문의를 접수하지 못했어요."): InquiryPost {
  if (status === 401) return { kind: "UNAUTHORIZED" };
  if (status === 200 && isRecord(data) && data.result === true && isRecord(data.data)) {
    const id = idOf(data.data.id);
    if (id) return { kind: "OK", id };
  }
  if (status === 200 && isRecord(data) && data.result === false) return { kind: "REFUSED", message: text(data.data) || refused };
  throw new FlextvUnavailableError(`FLEXTV inquiry post answered ${status}`);
}

/** As FLEXTV's form sends it: multipart, with the picture (when there is one) as `image`. */
export async function postInquiry(
  token: string,
  inquiry: { title: string; content: string; category: string; image: { blob: Blob; filename: string } | null },
  caller: Pick<FlextvRequest, "clientIp" | "userAgent">
): Promise<InquiryPost> {
  const form = new FormData();
  form.set("title", inquiry.title);
  form.set("category", inquiry.category);
  form.set("content", inquiry.content);
  if (inquiry.image) form.set("image", inquiry.image.blob, inquiry.image.filename);
  return mapInquiryPost(await flextvRequest("/api/cs/inquiry-post", { method: "POST", form, token, ...caller }));
}

/* ── 방송 신고 (phase 10) ────────────────────────────────── */

/** `GET /api/guest/refcode/bjreportCategory`: `[{ key, value, text }]`, FLEXTV's 신고 유형 in its order. */
export async function fetchReportCategories(): Promise<InquiryCategory[]> {
  const response = await flextvRequest("/api/guest/refcode/bjreportCategory");
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV report categories answered ${response.status}`);
  return readRefOptions(response.data);
}

/**
 * `POST /api/cs/declaration-post` as FLEXTV's 신고 form sends it from a live room: multipart 제목 · 유형 · 내용, the
 * reported streamer's member number as `targetId` (FLEXTV finds the channel by it) and `reportTypes` 1 (방송). It goes
 * to FLEXTV's operators, who answer it in the member's 신고 내역 on FLEXTV.
 */
export async function postBroadcastReport(
  token: string,
  report: { targetMemberId: number; title: string; category: string; content: string },
  caller: Pick<FlextvRequest, "clientIp" | "userAgent">
): Promise<InquiryPost> {
  const form = new FormData();
  form.set("title", report.title);
  form.set("category", report.category);
  form.set("content", report.content);
  form.set("targetId", String(report.targetMemberId));
  form.set("reportTypes", "1");
  return mapInquiryPost(await flextvRequest("/api/cs/declaration-post", { method: "POST", form, token, ...caller }), "신고를 접수하지 못했어요.");
}

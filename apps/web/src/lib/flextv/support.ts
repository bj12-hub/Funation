import { FlextvUnavailableError, flextvRequest, isRecord } from "./client";

/**
 * FLEXTV's 고객센터 (phase 7, docs/development/flextv-backend.md "7단계") — server/routes/api/cs and v2/api/cs of
 * FLEXTV's web repository: its 공지사항, 자주 묻는 질문 and the member's 1:1 문의. Their texts are HTML from FLEXTV's
 * editor; they are shown here as plain paragraphs (`htmlToParagraphs`), never as HTML. The `read*` functions are pure
 * (support.test.ts).
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

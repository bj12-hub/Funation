/**
 * FLEXTV backend switch (2026-10-25 결정, docs/development/flextv-backend.md).
 *
 * Ssumnation's screens run on FLEXTV's backend: FLEXTV's members, 렉스 ledger, payments and broadcasting. Each phase
 * moves one area off its mock; `NEXT_PUBLIC_BACKEND=flextv` turns on every phase built so far, and the areas not
 * connected yet keep their mock.
 *
 * NEXT_PUBLIC_ so the screens can show FLEXTV's forms (아이디 instead of an e-mail, the payment window) in the browser
 * too. It only picks which backend the server calls: a member cannot change who they are or what they pay by flipping it.
 */
export const FLEXTV_BACKEND = process.env.NEXT_PUBLIC_BACKEND === "flextv";

/** Phase 1: 로그인 · 회원가입 · 세션 · 간편 로그인. */
export const FLEXTV_AUTH = FLEXTV_BACKEND;

/** Phase 2: 렉스 잔액 · 충전 · 충전 내역 · 지갑 개요. */
export const FLEXTV_WALLET = FLEXTV_BACKEND;

/** Phase 3: 후원 to a FLEXTV channel's room (`/creators/{FLEXTV channel id}`) and 후원 내역. */
export const FLEXTV_DONATION = FLEXTV_BACKEND;

/** Phase 4: FLEXTV's live list, its player in a channel's room, and the room's live chat. */
export const FLEXTV_LIVE = FLEXTV_BACKEND;

/** FLEXTV's own site, for flows Ssumnation does not host yet (아이디 · 비밀번호 찾기, 본인인증). */
export const FLEXTV_WEB_URL = (process.env.NEXT_PUBLIC_FLEXTV_WEB_URL || "https://www.flextv.co.kr").replace(/\/+$/, "");

/**
 * FLEXTV backend switch (2026-10-25 결정, docs/development/flextv-backend.md).
 *
 * Ssumnation's screens run on FLEXTV's backend: FLEXTV's members, 렉스 ledger, payments and broadcasting. The switch
 * moves one area at a time; phase 1 is 로그인 · 회원가입 · 세션. Every other service keeps its mock until its phase.
 *
 * NEXT_PUBLIC_ so the auth screens can show FLEXTV's form (아이디 instead of an e-mail, no SMS step) in the browser
 * too. It only picks which backend the server calls: a member cannot change who they are by flipping it.
 */
export const FLEXTV_AUTH = process.env.NEXT_PUBLIC_AUTH_BACKEND === "flextv";

/** FLEXTV's own site, for the flows phase 1 does not connect yet (아이디 · 비밀번호 찾기 needs FLEXTV's 본인인증). */
export const FLEXTV_WEB_URL = (process.env.NEXT_PUBLIC_FLEXTV_WEB_URL || "https://www.flextv.co.kr").replace(/\/+$/, "");

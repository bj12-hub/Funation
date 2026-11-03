/** 방송 신고 in a FLEXTV channel's room (phase 10, docs/development/flextv-backend.md "10단계"). */

export type FlextvReportCategory = { value: string; label: string };

export type FlextvReportResult =
  | { status: "REPORTED" }
  | { status: "UNAUTHORIZED" }
  /** `message`: what to show (FLEXTV's reason, or what to fix). */
  | { status: "INVALID"; message: string };

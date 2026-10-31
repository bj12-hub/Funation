import { describe, expect, it } from "vitest";
import { FlextvUnavailableError } from "./client";
import { htmlToParagraphs, mapInquiryPost, readInquiryCategories, readNoticeList, readNoticePage, readQuestions } from "./support";

/** FLEXTV's 고객센터 answers (server/routes/api/cs, v2/api/cs of FLEXTV's web repository), in its shapes. */

describe("FLEXTV's editor HTML", () => {
  it("becomes plain paragraphs, never HTML", () => {
    expect(htmlToParagraphs("<p>안녕하세요&nbsp;여러분</p><p>점검&amp;업데이트<br>오전 2시</p>")).toEqual(["안녕하세요 여러분", "점검&업데이트", "오전 2시"]);
    expect(htmlToParagraphs('<script>alert(1)</script><p onclick="x">본문 <b>굵게</b></p><img src=x onerror=alert(1)>')).toEqual(["본문 굵게"]);
    expect(htmlToParagraphs("&lt;b&gt; &#44032;&#x41;")).toEqual(["<b> 가A"]);
    expect(htmlToParagraphs("")).toEqual([]);
  });
});

describe("공지사항", () => {
  it("reads the list, dated in KST", () => {
    expect(readNoticeList({ data: [{ id: 7, title: "점검 안내", mustRead: 1, createdAt: "2026-10-24T16:00:00.000Z" }, { id: 0, title: "x" }], count: 2 })).toEqual([
      { id: "7", title: "점검 안내", important: true, date: "2026-10-25", paragraphs: [] }
    ]);
  });

  it("shows a published 공지사항 only", () => {
    const page = (over: Record<string, unknown>) => ({ notices: { id: 7, title: "점검 안내", boardDiv: 1, open: 1, mustRead: 0, createdAt: "2026-10-24T03:00:00.000Z", bcontent: "<p>내용</p>", ...over }, prevnotices: null, nextnotices: null });
    expect(readNoticePage(page({}))).toEqual({ id: "7", title: "점검 안내", important: false, date: "2026-10-24", paragraphs: ["내용"] });
    expect(readNoticePage(page({ open: 0 }))).toBeNull();
    expect(readNoticePage(page({ boardDiv: 2 }))).toBeNull();
    expect(readNoticePage({ notices: null })).toBeNull();
  });
});

describe("questions (자주 묻는 질문 · 1:1 문의)", () => {
  it("reads the text, the answer and whether it is answered", () => {
    expect(
      readQuestions({
        data: [
          { id: 3, title: "충전은 어떻게 하나요?", content: "<p>충전 버튼을 누르세요.</p>", answer: null, isCompleted: 0, createdAt: "2026-10-01T00:00:00.000Z" },
          { id: 4, title: "환불 문의", content: "환불해 주세요", answer: "<p>처리했습니다.</p>", isCompleted: 1, createdAt: "2026-10-02T00:00:00.000Z" }
        ],
        count: 2
      })
    ).toEqual([
      { id: "3", title: "충전은 어떻게 하나요?", paragraphs: ["충전 버튼을 누르세요."], answer: [], answered: false, createdAt: "2026-10-01T00:00:00.000Z" },
      { id: "4", title: "환불 문의", paragraphs: ["환불해 주세요"], answer: ["처리했습니다."], answered: true, createdAt: "2026-10-02T00:00:00.000Z" }
    ]);
    expect(readQuestions([])).toEqual([]);
  });
});

describe("1:1 문의 작성 (phase 9)", () => {
  it("offers FLEXTV's 1:1 문의 유형 only (codes 1–19)", () => {
    expect(
      readInquiryCategories([
        { key: 1, value: "1", text: "계정" },
        { key: 2, value: 5, text: "결제/환불" },
        { key: 3, value: "31", text: "건의" },
        { key: 4, value: "x", text: "기타" },
        { key: 5, value: "1", text: "계정" },
        { key: 6, value: "7", text: "" }
      ])
    ).toEqual([
      { value: "1", label: "계정" },
      { value: "5", label: "결제/환불" }
    ]);
    expect(readInquiryCategories(null)).toEqual([]);
  });

  it("reads FLEXTV's answer to a 문의", () => {
    expect(mapInquiryPost({ status: 200, data: { result: true, data: { id: 302, title: "질문" } } })).toEqual({ kind: "OK", id: "302" });
    expect(mapInquiryPost({ status: 200, data: { result: false, error: 400, data: "정지된 회원입니다." } })).toEqual({ kind: "REFUSED", message: "정지된 회원입니다." });
    expect(mapInquiryPost({ status: 401, data: "로그인을 해주세요." })).toEqual({ kind: "UNAUTHORIZED" });
    expect(() => mapInquiryPost({ status: 200, data: { result: true, data: null } })).toThrow(FlextvUnavailableError);
  });
});

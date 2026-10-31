import type { MessageKey } from "@/lib/i18n/translate";

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

/**
 * The option labels and hints the widget services define in Korean (`widgetSettingsTypes` · `overlayThemeTypes`: styles,
 * layouts, periods, speeds, 등장 효과 …), as message keys so the 위젯 settings popups show them in the creator's language
 * (2026-11-01). The constants and the stored values stay as they are; a label not listed shows as written.
 */
const OPTION_KEYS: Record<string, MessageKey> = {
  // 후원 알림 모양 · 시그니처 음원
  카드형: "widgetFormOptions.layoutCard",
  "금액을 크게, 문구와 메시지를 아래에": "widgetFormOptions.layoutCardHint",
  "가로 띠형": "widgetFormOptions.layoutBanner",
  "한 줄로 길게, 화면 위나 아래에 두기 좋아요": "widgetFormOptions.layoutBannerHint",
  "이미지 강조형": "widgetFormOptions.layoutImage",
  "시그니처 이미지를 크게 보여 줘요": "widgetFormOptions.layoutImageHint",
  "기존 방식": "widgetFormOptions.fetchCache",
  "브라우저 캐시를 쓰고, 받으면서 재생해요.": "widgetFormOptions.fetchCacheHint",
  "매번 새로 받기": "widgetFormOptions.fetchFresh",
  "캐시를 쓰지 않고, 받으면서 재생해요.": "widgetFormOptions.fetchFreshHint",
  "다 받고 재생": "widgetFormOptions.fetchFull",
  "캐시를 쓰지 않고, 전부 받은 뒤 재생해요. 재생 중 끊기지 않지만 네트워크가 느리면 시작이 늦어요.": "widgetFormOptions.fetchFullHint",
  // 등장 효과 (OVERLAY_MOTIONS · EFFECT_LABELS)
  "톡 튀어오르기": "widgetFormOptions.motionPop",
  "아래에서 올라오기": "widgetFormOptions.motionSlideUp",
  "옆에서 밀려오기": "widgetFormOptions.motionSlideSide",
  "스르륵 나타나기": "widgetFormOptions.motionFade",
  "쿵 내려앉기": "widgetFormOptions.motionZoom",
  "효과 없음": "widgetFormOptions.motionNone",
  "커지며 나타나기": "widgetFormOptions.effectZoomIn",
  "스르륵 사라지기": "widgetFormOptions.effectFadeOut",
  "옆으로 밀려나기": "widgetFormOptions.effectSlideOut",
  "작아지며 사라지기": "widgetFormOptions.effectZoomOut",
  "스르륵 나타났다 사라지기": "widgetFormOptions.effectFadeInOut",
  "밀려왔다 밀려나기": "widgetFormOptions.effectSlideInOut",
  // 채팅창 · QR · 후원목표 · 이벤트 · 벽지 styles
  "한 줄 테두리 없음": "widgetFormOptions.chatLinePlain",
  "한 줄 상자 테두리": "widgetFormOptions.chatLineBox",
  "상자 테두리 (정렬)": "widgetFormOptions.chatBoxAligned",
  말풍선형: "widgetFormOptions.bubble",
  "상자형 심플": "widgetFormOptions.chatBoxSimple",
  "항상 표시": "widgetFormOptions.nickBgAlways",
  "어두운 닉네임만": "widgetFormOptions.nickBgDark",
  "표시 안 함": "widgetFormOptions.nickBgNever",
  기본형: "widgetFormOptions.basic",
  라운드형: "widgetFormOptions.round",
  원형: "widgetFormOptions.circle",
  부드러운형: "widgetFormOptions.soft",
  "기본 한 줄": "widgetFormOptions.goalOneLine",
  "심플 레이아웃": "widgetFormOptions.goalSimple",
  막대: "widgetFormOptions.shapeBar",
  반원: "widgetFormOptions.shapeSemi",
  하트: "widgetFormOptions.shapeHeart",
  별: "widgetFormOptions.shapeStar",
  박스형: "widgetFormOptions.box",
  리스트형: "widgetFormOptions.list",
  최신순: "widgetFormOptions.newest",
  오래된순: "widgetFormOptions.oldest",
  치지직: "widgetFormOptions.chzzk",
  // 후원랭킹
  텍스트: "widgetFormOptions.text",
  "스크롤 되는 텍스트": "widgetFormOptions.scrollText",
  심플: "widgetFormOptions.simple",
  계정: "widgetFormOptions.account",
  "후원시 설정한 이름": "widgetFormOptions.donationName",
  "매우 느리게": "widgetFormOptions.verySlow",
  느리게: "widgetFormOptions.slow",
  보통: "widgetFormOptions.normal",
  빠르게: "widgetFormOptions.fast",
  "매우 빠르게": "widgetFormOptions.veryFast",
  "후원자 랭킹": "widgetFormOptions.boardDonor",
  "크루 후원 순위": "widgetFormOptions.boardCrew",
  "수단별 보드": "widgetFormOptions.boardSource",
  // 퀘스트 · 뽑기
  화려한: "widgetFormOptions.fancy",
  심플한: "widgetFormOptions.simpleQuest",
  캡슐: "widgetFormOptions.capsule",
  박스: "widgetFormOptions.boxGacha",
  크레딧: "widgetFormOptions.credit",
  "🔵 캡슐 스타일": "widgetFormOptions.capsuleTab",
  "🎁 박스 스타일": "widgetFormOptions.boxTab",
  "📋 크레딧 스타일": "widgetFormOptions.creditTab",
  "기본 테마": "widgetFormOptions.themeBasic",
  "빼빼로 데이": "widgetFormOptions.themePepero",
  크리스마스: "widgetFormOptions.themeChristmas",
  "발렌타인 데이": "widgetFormOptions.themeValentine",
  "새해 설날": "widgetFormOptions.themeNewYear",
  당첨확률형: "widgetFormOptions.probability",
  상품소진형: "widgetFormOptions.stock",
  "오늘 기준": "widgetFormOptions.today",
  "최근 7일 기준": "widgetFormOptions.last7",
  "최근 30일 기준": "widgetFormOptions.last30",
  빠름: "widgetFormOptions.fastBoard",
  고정: "widgetFormOptions.fixed",
  전체: "widgetFormOptions.all",
  // 시계 · 알림 모니터 · 시그 벽지
  플립: "widgetFormOptions.flip",
  "숫자마다 카드가 넘어가요": "widgetFormOptions.flipHint",
  디지털: "widgetFormOptions.digital",
  "큰 숫자 한 줄": "widgetFormOptions.digitalHint",
  아날로그: "widgetFormOptions.analog",
  "바늘 시계와 시각": "widgetFormOptions.analogHint",
  "후원이 들어올 때": "widgetFormOptions.timingReceived",
  "후원이 완료되면 바로 바뀌어요": "widgetFormOptions.timingReceivedHint",
  "알림이 나올 때": "widgetFormOptions.timingPlayed",
  "그 후원의 알림이 방송 화면에 나오면 바뀌어요": "widgetFormOptions.timingPlayedHint",
  "나중 후원자": "widgetFormOptions.tieLatest",
  "같은 금액이 또 들어오면 나중에 보낸 사람으로 바뀌어요": "widgetFormOptions.tieLatestHint",
  "먼저 후원자": "widgetFormOptions.tieFirst",
  "같은 금액이면 먼저 보낸 사람이 그대로 남아요": "widgetFormOptions.tieFirstHint",
  기본: "widgetFormOptions.monitorBasic",
  "몇 초 전 · 후원자 · 금액 · 메시지": "widgetFormOptions.monitorBasicHint",
  컴팩트: "widgetFormOptions.compact",
  "후원자 · 메시지만 크게": "widgetFormOptions.compactHint",
  세로형: "widgetFormOptions.vertical",
  "카드를 위에서 아래로": "widgetFormOptions.verticalHint",
  가로형: "widgetFormOptions.horizontal",
  "카드를 왼쪽에서 오른쪽으로": "widgetFormOptions.horizontalHint",
  표시: "widgetFormOptions.topLineThanks",
  후원자명만: "widgetFormOptions.topLineName",
  "기본 시스템 폰트": "widgetFormOptions.systemFont"
};

/** 일간 · 주간 · 월간 · 전체 (RANKING_WIDGET_PERIODS) — 전체 reads "all time" here, unlike the 상품 타입 전체. */
const PERIOD_KEYS: Record<string, MessageKey> = {
  일간: "widgetFormOptions.daily",
  주간: "widgetFormOptions.weekly",
  월간: "widgetFormOptions.monthly",
  전체: "widgetFormOptions.allTime"
};

/** A Korean option label or hint from the services, in the viewer's language. */
export function optionText(text: string, t: T) {
  const key = OPTION_KEYS[text];
  return key ? t(key) : text;
}

/** A 기간 value (일간 …) in the viewer's language. */
export function periodText(text: string, t: T) {
  const key = PERIOD_KEYS[text];
  return key ? t(key) : text;
}

/** `{ key, label, hint? }` options with their label (and hint) translated; keys stay as stored. */
export function translatedOptions<O extends { label: string; hint?: string }>(options: readonly O[], t: T): O[] {
  return options.map((o) => ({ ...o, label: optionText(o.label, t), ...(o.hint === undefined ? {} : { hint: optionText(o.hint, t) }) }));
}

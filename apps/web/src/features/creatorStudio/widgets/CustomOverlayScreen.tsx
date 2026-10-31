"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveCustomOverlay } from "@/services/creator/customOverlay";
import {
  CUSTOM_CODE_MAX,
  CUSTOM_NAME_MAX,
  CUSTOM_SLOTS,
  SANDBOX_SRC,
  type CustomChat,
  type CustomCrew,
  type CustomCode,
  type CustomDonation,
  type CustomOverlayView,
  type CustomSlot
} from "@/services/creator/customOverlayTypes";
import { shownOverlayAddress } from "../crew/overlayAddress";
import styles from "../crew/crew.module.css";
import prize from "../crew/prize.module.css";
import { CopyButton } from "../settings/SettingsCards";
import local from "./customOverlay.module.css";
import { useSandbox } from "./useSandbox";

const FIELDS = [
  { key: "html", label: "HTML", rows: 8 },
  { key: "css", label: "CSS", rows: 8 },
  { key: "js", label: "JS", rows: 12 }
] as const;

/** 예시 코드: a donation pop-up and a short chat list. */
const EXAMPLE: CustomCode = {
  html: `<div class="alert" id="alert" hidden>
  <strong id="who"></strong>
  <span id="amount"></span>
  <p id="msg"></p>
</div>
<ul class="chat" id="chat"></ul>`,
  css: `body { font-family: sans-serif; color: #fff; }
.alert { padding: 16px 20px; border-radius: 16px; background: rgba(124, 58, 237, 0.85); text-align: center; }
.alert strong { font-size: 28px; }
.alert span { display: block; font-size: 22px; color: #fde68a; }
.chat { list-style: none; margin: 12px 0 0; padding: 0; font-size: 18px; text-shadow: 0 1px 2px #000; }`,
  js: `var alertBox = document.getElementById("alert");
var hideTimer = null;

function onData(type, data) {
  if (type === "donation") {
    document.getElementById("who").textContent = data.nickname;
    document.getElementById("amount").textContent = data.amountLabel;
    document.getElementById("msg").textContent = data.message;
    alertBox.hidden = false;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { alertBox.hidden = true; }, Math.max(1000, Date.parse(data.endsAt) - Date.now()));
  }
  if (type === "chat") {
    var list = document.getElementById("chat");
    var li = document.createElement("li");
    li.textContent = data.nickname + ": " + data.text;
    list.appendChild(li);
    while (list.children.length > 8) list.removeChild(list.firstChild);
  }
}`
};

const API = `function onData(type, data) {
  // type "donation" — 후원 알림이 뜰 때 (테스트 후원 포함)
  //   data.nickname · amount (FN) · amountLabel ("1,000 FN") · message
  //   data.typeLabel · kind · platform · imageUrl · endsAt (알림이 끝나는 시각)
  // type "chat" — 통합 채팅 한 줄 (처음 열리면 최근 20줄부터)
  //   data.nickname · text · platform · at
  // type "crew" — 크루 점수판이 바뀔 때마다 (처음 열리면 지금 점수판)
  //   data.live (방송 중) · title · project · round · total
  //   data.rows[] — rank · name · color · score (높은 점수부터)
}`;

let testNo = 0;
const testDonation = (): CustomDonation => ({
  id: `preview-d${++testNo}`,
  kind: "TEST",
  nickname: "미리보기",
  message: "커스텀 오버레이 테스트예요",
  amount: 10_000,
  amountLabel: "10,000 FN",
  typeLabel: "텍스트 후원",
  platform: null,
  imageUrl: null,
  endsAt: new Date(Date.now() + 5000).toISOString()
});
const testChat = (): CustomChat => ({ id: `preview-c${++testNo}`, platform: "YOUTUBE", nickname: "시청자", text: `안녕하세요 ${testNo}`, at: new Date().toISOString() });
const testCrew = (): CustomCrew => {
  const base = [
    { name: "길동", color: "#8b5cf6", score: 30_000 },
    { name: "하늘", color: "#ec4899", score: 25_000 },
    { name: "바다", color: "#3b82f6", score: 12_000 }
  ].map((r) => ({ ...r, score: r.score + ++testNo * 1_000 }));
  const rows = base.sort((x, y) => y.score - x.score).map((r, i) => ({ rank: i + 1, ...r }));
  return { live: true, title: "미리보기 방송", project: "시즌1", round: 3, rows, total: rows.reduce((s, r) => s + r.score, 0) };
};

/**
 * 커스텀 오버레이 — code-first (no Figma frame; StreamDonate "오버레이 커스텀" 참고, P3). Route `/creator/widgets/custom`. 슬롯
 * 5개, each with 이름 · 사용 · HTML · CSS · JS (저장 per slot), a 미리보기 that runs the draft in the same sandbox as OBS with
 * 테스트 후원 · 테스트 채팅 (preview only: no alert is queued), the `onData` reference and the slot's OBS address.
 */
export function CustomOverlayScreen({ view }: { view: CustomOverlayView }) {
  const router = useRouter();
  const [no, setNo] = useState(1);
  const [drafts, setDrafts] = useState<CustomSlot[]>(() => view.slots);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  // A newer saved slot (after a save, another tab) replaces its draft unless it has unsaved edits.
  const synced = useRef(view.slots.map((s) => JSON.stringify(s)));
  useEffect(() => {
    setDrafts((d) =>
      d.map((draft, i) => {
        const next = JSON.stringify(view.slots[i]);
        if (next === synced.current[i]) return draft;
        const clean = JSON.stringify(draft) === synced.current[i];
        synced.current[i] = next;
        return clean ? view.slots[i] : draft;
      })
    );
  }, [view.slots]);

  const i = no - 1;
  const draft = drafts[i];
  const dirty = JSON.stringify(draft) !== JSON.stringify(view.slots[i]);
  const edit = (patch: Partial<CustomSlot>) => setDrafts((d) => d.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const over = FIELDS.some((f) => draft[f.key].length > CUSTOM_CODE_MAX);

  // The preview runs the draft as of the last 미리보기 실행 (not every keystroke).
  const [previewCode, setPreviewCode] = useState<CustomCode>(() => ({ html: draft.html, css: draft.css, js: draft.js }));
  const [previewRun, setPreviewRun] = useState(0);
  const { frame, key, send, onLoad } = useSandbox(previewCode, previewRun);
  const runPreview = () => {
    setPreviewCode({ html: draft.html, css: draft.css, js: draft.js });
    setPreviewRun((n) => n + 1);
  };

  const save = () => {
    setMessage(null);
    const sent = draft;
    startTransition(async () => {
      try {
        const res = await saveCustomOverlay({ no, ...sent });
        if (res.status === "SAVED") {
          setMessage({ tone: "ok", text: `${sent.name.trim() || `커스텀 ${no}`} 코드를 저장했어요. OBS에는 몇 초 안에 반영돼요.` });
          router.refresh();
        } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/widgets/custom");
        else setMessage({ tone: "error", text: res.message });
      } catch {
        setMessage({ tone: "error", text: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };

  const path = `/overlay/custom/${view.overlayKey}`;
  const query = `?slot=${no}`;

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>커스텀 오버레이</h1>
        <p className={styles.subtitle}>HTML · CSS · JS로 나만의 오버레이를 만들어요. 후원 알림과 통합 채팅을 실시간으로 받아 그릴 수 있어요.</p>
        <p className={styles.note}>
          코드는 사이트와 분리된 샌드박스에서만 실행돼요. 로그인 정보 · 연동 키 · 스튜디오에 접근할 수 없고, 외부 서버로 데이터를 보낼 수도 없어요. 다른 사람이 준 코드는 내용을 확인한
          뒤 넣어 주세요. 오버레이 주소 · 원소스 배치는 <Link href="/creator/widgets/overlays">오버레이 주소</Link>에 있어요.
        </p>
      </header>

      <div className={styles.segment} role="group" aria-label="슬롯">
        {Array.from({ length: CUSTOM_SLOTS }, (_, k) => k + 1).map((n) => (
          <button key={n} type="button" aria-pressed={no === n} aria-label={`슬롯 ${n} ${drafts[n - 1].name}`} onClick={() => setNo(n)}>
            슬롯 {n}
            {view.slots[n - 1].enabled && " ON"}
            {JSON.stringify(drafts[n - 1]) !== JSON.stringify(view.slots[n - 1]) && " •"}
          </button>
        ))}
      </div>

      {message && (
        <p className={message.tone === "ok" ? styles.ok : styles.error} role={message.tone === "ok" ? "status" : "alert"}>
          {message.text}
        </p>
      )}

      <section className={styles.card} aria-labelledby="custom-code-title">
        <h2 id="custom-code-title" className={styles.cardTitle}>
          슬롯 {no} · {draft.name || `커스텀 ${no}`}
        </h2>
        <label className={prize.field}>
          <span className={styles.muted}>이름</span>
          <input className={styles.input} aria-label="오버레이 이름" maxLength={CUSTOM_NAME_MAX} value={draft.name} onChange={(e) => edit({ name: e.target.value })} />
        </label>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={draft.enabled} onChange={(e) => edit({ enabled: e.target.checked })} />
          사용 (끄면 OBS에 아무것도 나오지 않아요)
        </label>
        {FIELDS.map((f) => (
          <label key={f.key} className={prize.field}>
            <span className={local.codeHead}>
              <span className={styles.muted}>{f.label}</span>
              <span className={`${styles.muted} ${local.count}`} data-over={draft[f.key].length > CUSTOM_CODE_MAX || undefined}>
                {draft[f.key].length.toLocaleString("ko-KR")} / {CUSTOM_CODE_MAX.toLocaleString("ko-KR")}
              </span>
            </span>
            <textarea
              className={`${styles.input} ${styles.textarea} ${local.code}`}
              aria-label={`${f.label} 코드`}
              rows={f.rows}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              value={draft[f.key]}
              onChange={(e) => edit({ [f.key]: e.target.value })}
            />
          </label>
        ))}
        <p className={styles.note}>HTML 안의 &lt;script&gt;는 실행되지 않아요. 스크립트는 JS 칸에 넣어 주세요.</p>
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} onClick={() => edit(EXAMPLE)}>
            예시 코드 넣기
          </button>
          <button type="button" className={styles.ghost} disabled={pending || !dirty} onClick={() => setDrafts((d) => d.map((s, k) => (k === i ? view.slots[i] : s)))}>
            되돌리기
          </button>
          <button type="button" className={styles.primary} disabled={pending || !dirty || over} onClick={save}>
            {pending ? "저장하는 중…" : "저장"}
          </button>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="custom-preview-title">
        <h2 id="custom-preview-title" className={styles.cardTitle}>
          미리보기
        </h2>
        <p className={styles.note}>
          지금 입력한 코드를 OBS와 같은 샌드박스에서 실행해요. 테스트 후원 · 테스트 채팅 · 테스트 점수판은 이 미리보기에만 보내요(알림 대기열에 들어가지 않고 FN도 움직이지 않아요).
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={runPreview}>
            미리보기 실행
          </button>
          <button type="button" className={styles.ghost} onClick={() => send("donation", testDonation())}>
            테스트 후원
          </button>
          <button type="button" className={styles.ghost} onClick={() => send("chat", testChat())}>
            테스트 채팅
          </button>
          <button type="button" className={styles.ghost} onClick={() => send("crew", testCrew())}>
            테스트 점수판
          </button>
        </div>
        <iframe
          key={key}
          ref={frame}
          src={SANDBOX_SRC}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          title={`${draft.name || `커스텀 ${no}`} 미리보기`}
          className={local.preview}
          onLoad={onLoad}
        />
      </section>

      <section className={styles.card} aria-labelledby="custom-api-title">
        <h2 id="custom-api-title" className={styles.cardTitle}>
          onData로 받는 데이터
        </h2>
        <pre className={local.api}>{API}</pre>
        <ul className={local.rules}>
          <li>JS 칸에 onData 함수를 만들면 데이터가 들어올 때마다 불러요. HTML은 &lt;div id=&quot;overlay&quot;&gt; 안에 들어가요.</li>
          <li>외부 서버 요청(fetch · WebSocket)과 다른 창 · 폼 · 팝업은 막혀 있어요. 이미지 · 글꼴 · 소리는 https 주소로 불러올 수 있어요.</li>
          <li>배경은 투명해요. 코드를 바꿔 저장하면 OBS의 오버레이가 새로 시작돼요.</li>
        </ul>
      </section>

      <section className={styles.card} aria-labelledby="custom-obs-title">
        <h2 id="custom-obs-title" className={styles.cardTitle}>
          OBS 주소
        </h2>
        <p className={styles.note}>OBS 브라우저 소스에 넣어요. 크기는 자유예요(예: 800 × 600). 리모컨 기능 제어의 &lsquo;커스텀 오버레이&rsquo;로 모든 슬롯을 켜고 끌 수 있어요.</p>
        <div className={styles.addRow}>
          <input className={styles.input} value={shownOverlayAddress(origin, path, query)} readOnly aria-label={`슬롯 ${no} OBS 주소`} onFocus={(e) => e.target.select()} />
          <CopyButton value={`${origin}${path}${query}`} label="복사" className={styles.ghost} />
        </div>
      </section>
    </div>
  );
}

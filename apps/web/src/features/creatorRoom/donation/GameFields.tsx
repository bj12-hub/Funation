"use client";

import { useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/format";
import type { DonationCatalog } from "@/services/donations/donationCatalog";
import { MAX_DRAWING_CHARS } from "@/services/donations/donationTypes";
import type { DrawingState, QuestState, QuizChoiceState, QuizDrawingState, QuizInitialState, QuizRewardsState, RouletteState, TimeLimit } from "./drafts";
import { SwitchRow } from "./Fields";
import room from "../room.module.css";
import styles from "./game.module.css";

/**
 * Page-2 donation types. Figma 867:2458 룰렛 · 867:2545 퀘스트 · 867:2647 그림 · 867:2755 객관식 ·
 * 867:2855 초성 · 867:2955 그림 퀴즈. Outcomes (spin result, quest/quiz judgement) happen on the
 * broadcast side and are TBD; these forms only collect the request.
 */

type Props<S> = { value: S; onChange: (next: S) => void; catalog: DonationCatalog; error: string | null };

const onlyDigits = (raw: string, max = 9) => raw.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "").slice(0, max);

function FnInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <span className={room.inputBox}>
        <input className={room.input} inputMode="numeric" placeholder="0" value={value ? formatNumber(Number(value)) : ""} onChange={(e) => onChange(onlyDigits(e.target.value))} />
        <span className={room.suffix}>FN</span>
      </span>
    </label>
  );
}

function TextInput({ label, value, onChange, max, placeholder, tall = false }: { label: string; value: string; onChange: (v: string) => void; max: number; placeholder: string; tall?: boolean }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <span className={room.inputBox}>
        {tall ? (
          <textarea className={room.textarea} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input className={room.input} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        )}
      </span>
    </label>
  );
}

function TimeInput({ value, onChange }: { value: TimeLimit; onChange: (v: TimeLimit) => void }) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>제한 시간</span>
      <span className={`${room.inputBox} ${styles.time}`}>
        <input aria-label="분" inputMode="numeric" value={value.minutes} onChange={(e) => onChange({ ...value, minutes: onlyDigits(e.target.value, 2) })} />
        <span>분</span>
        <input aria-label="초" inputMode="numeric" value={value.seconds} onChange={(e) => onChange({ ...value, seconds: onlyDigits(e.target.value, 2) })} />
        <span>초</span>
      </span>
    </div>
  );
}

const Terms = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <SwitchRow label="후원 서비스 이용약관 및 안내 동의 (필수)" checked={checked} onChange={onChange} />
);

const ErrorLine = ({ error }: { error: string | null }) =>
  error ? (
    <p className={`${room.validation} ${room.validationError}`} role="alert">
      ! {error}
    </p>
  ) : null;

function QuizRewardFields<S extends QuizRewardsState>({ value, onChange, columns = 3 }: { value: S; onChange: (next: S) => void; columns?: 2 | 3 }) {
  const time = <TimeInput value={value.time} onChange={(time) => onChange({ ...value, time })} />;
  const correct = <FnInput label="정답 보상" value={value.correct} onChange={(correct) => onChange({ ...value, correct })} />;
  const wrong = <FnInput label="오답 보상" value={value.wrong} onChange={(wrong) => onChange({ ...value, wrong })} />;
  return columns === 3 ? (
    <div className={styles.cols3}>
      {time}
      {correct}
      {wrong}
    </div>
  ) : (
    <div className={styles.cols2}>
      {correct}
      {wrong}
    </div>
  );
}

// ── 룰렛 (867:2494) ──────────────────────────────────────────────────────────

export function RouletteFields({ value, onChange, catalog }: Props<RouletteState>) {
  return (
    <>
      <div className={styles.tiers} role="radiogroup" aria-label="룰렛 등급">
        {catalog.roulette.tiers.map((t) => (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={value.tierKey === t.key}
            className={`${styles.tier} ${value.tierKey === t.key ? styles.tierOn : ""}`}
            onClick={() => onChange({ tierKey: t.key })}
          >
            <strong>{t.label}</strong>
            <span>{formatNumber(t.amount)} FN</span>
          </button>
        ))}
      </div>
      <div className={styles.odds}>
        <strong>룰렛 결과 / 당첨 확률</strong>
        <ul>
          {catalog.roulette.odds.map((o) => (
            <li key={o.prize}>
              {o.prize} · {o.percent}%
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

// ── 퀘스트 (867:2581) ────────────────────────────────────────────────────────

export function QuestFields({ value, onChange, catalog, error }: Props<QuestState>) {
  return (
    <>
      <TextInput label="퀘스트 제목" value={value.title} onChange={(title) => onChange({ ...value, title })} max={catalog.game.maxText} placeholder="크리에이터에게 요청할 퀘스트" />
      <div className={styles.cols2}>
        <FnInput label="성공 보상" value={value.success} onChange={(success) => onChange({ ...value, success })} />
        <FnInput label="취소 금액" value={value.cancel} onChange={(cancel) => onChange({ ...value, cancel })} />
      </div>
      <TimeInput value={value.time} onChange={(time) => onChange({ ...value, time })} />
      {/* 2026-10-04 결정: a failed quest refunds the whole amount, so there is no 실패 금액. */}
      <p className={styles.refundNote}>퀘스트가 실패하면 후원한 FN이 전액 환불돼요.</p>
      <SwitchRow label="크리에이터 성공 결정" checked={value.creatorDecides} onChange={(creatorDecides) => onChange({ ...value, creatorDecides })} />
      <Terms checked={value.terms} onChange={(terms) => onChange({ ...value, terms })} />
      <ErrorLine error={error} />
    </>
  );
}

// ── 그림 후원 (867:2683) ─────────────────────────────────────────────────────

export function DrawingFields({ value, onChange, catalog, error }: Props<DrawingState>) {
  return (
    <>
      <div className={styles.inlineSwitches}>
        <SwitchRow label="그림 과정 공개" checked={value.showProcess} onChange={(showProcess) => onChange({ ...value, showProcess })} />
        <SwitchRow label="캔버스 모드" checked={value.canvasMode} onChange={(canvasMode) => onChange({ ...value, canvasMode })} />
      </div>
      <DrawingPad placeholder="✦ 〰 ✦" initial={value.image} onChange={(image) => onChange({ ...value, image })} />
      <FnInput label="후원 금액" value={value.amount} onChange={(amount) => onChange({ ...value, amount })} />
      <TextInput label="그림 제목" value={value.title} onChange={(title) => onChange({ ...value, title })} max={catalog.game.maxText} placeholder="그림에 붙일 제목" />
      <Terms checked={value.terms} onChange={(terms) => onChange({ ...value, terms })} />
      <ErrorLine error={error} />
    </>
  );
}

// ── 객관식 퀴즈 (867:2791) ───────────────────────────────────────────────────

export function QuizChoiceFields({ value, onChange, catalog, error }: Props<QuizChoiceState>) {
  const { min, max } = catalog.game.quizOptions;
  const setOption = (i: number, text: string) => onChange({ ...value, options: value.options.map((o, j) => (j === i ? text : o)) });
  const removeOption = (i: number) =>
    onChange({
      ...value,
      options: value.options.filter((_, j) => j !== i),
      correctIndex: value.correctIndex === i ? 0 : value.correctIndex > i ? value.correctIndex - 1 : value.correctIndex
    });

  return (
    <>
      <TextInput label="문제" value={value.question} onChange={(question) => onChange({ ...value, question })} max={catalog.game.maxText} placeholder="크리에이터가 맞힐 문제" tall />
      <div className={styles.field}>
        <span className={styles.label}>보기 · 정답 선택</span>
        <ol className={styles.options}>
          {value.options.map((o, i) => (
            <li key={i} className={`${styles.option} ${value.correctIndex === i ? styles.optionOn : ""}`}>
              <input type="radio" name="quiz-correct" checked={value.correctIndex === i} onChange={() => onChange({ ...value, correctIndex: i })} aria-label={`${i + 1}번을 정답으로`} />
              <span aria-hidden="true">{"①②③④⑤"[i]}</span>
              <input className={styles.optionInput} value={o} maxLength={catalog.game.maxText} placeholder={`보기 ${i + 1}`} onChange={(e) => setOption(i, e.target.value)} aria-label={`보기 ${i + 1}`} />
              {value.options.length > min && (
                <button type="button" className={styles.optionRemove} onClick={() => removeOption(i)} aria-label={`보기 ${i + 1} 삭제`}>
                  ×
                </button>
              )}
            </li>
          ))}
        </ol>
        {value.options.length < max && (
          <button type="button" className={styles.addOption} onClick={() => onChange({ ...value, options: [...value.options, ""] })}>
            ＋ 항목 추가
          </button>
        )}
      </div>
      <QuizRewardFields value={value} onChange={onChange} />
      <Terms checked={value.terms} onChange={(terms) => onChange({ ...value, terms })} />
      <ErrorLine error={error} />
    </>
  );
}

// ── 초성 퀴즈 (867:2891) ─────────────────────────────────────────────────────

export function QuizInitialFields({ value, onChange, catalog, error }: Props<QuizInitialState>) {
  return (
    <>
      <TextInput label="문제" value={value.question} onChange={(question) => onChange({ ...value, question })} max={catalog.game.maxText} placeholder="크리에이터가 맞힐 문제" />
      <TextInput label="정답" value={value.answer} onChange={(answer) => onChange({ ...value, answer })} max={catalog.game.maxText} placeholder="정답" />
      <TextInput label="힌트" value={value.hint} onChange={(hint) => onChange({ ...value, hint })} max={catalog.game.maxText} placeholder="예: ㅂㅂ ㅇㄹ" />
      <QuizRewardFields value={value} onChange={onChange} />
      <Terms checked={value.terms} onChange={(terms) => onChange({ ...value, terms })} />
      <ErrorLine error={error} />
    </>
  );
}

// ── 그림 퀴즈 (867:2991) ─────────────────────────────────────────────────────

export function QuizDrawingFields({ value, onChange, catalog, error }: Props<QuizDrawingState>) {
  return (
    <>
      <DrawingPad placeholder="☁ ?" initial={value.image} onChange={(image) => onChange({ ...value, image })} />
      <TextInput label="문제" value={value.question} onChange={(question) => onChange({ ...value, question })} max={catalog.game.maxText} placeholder="그림 속 정답을 묻는 문제" />
      <div className={styles.cols2}>
        <TextInput label="정답" value={value.answer} onChange={(answer) => onChange({ ...value, answer })} max={catalog.game.maxText} placeholder="정답" />
        <TimeInput value={value.time} onChange={(time) => onChange({ ...value, time })} />
      </div>
      <QuizRewardFields value={value} onChange={onChange} columns={2} />
      <Terms checked={value.terms} onChange={(terms) => onChange({ ...value, terms })} />
      <ErrorLine error={error} />
    </>
  );
}

// ── Drawing pad (867:2683 tool preview: ✎ ⌫ □ ↶) ─────────────────────────────

type Tool = "pen" | "eraser";

/** Small canvas. Emits a PNG data URL after each stroke, or `null` when empty. */
function DrawingPad({ placeholder, initial, onChange }: { placeholder: string; initial: string | null; onChange: (image: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const history = useRef<ImageData[]>([]);
  const drawing = useRef(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [empty, setEmpty] = useState(!initial);
  const [tooLarge, setTooLarge] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#efeff5";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Restore the drawing kept in the form state (e.g. after switching donation types).
    if (initial) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = initial;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * canvas.width, y: ((e.clientY - rect.top) / rect.height) * canvas.height };
  };

  const emit = () => {
    const canvas = canvasRef.current!;
    const data = canvas.toDataURL("image/png");
    const over = data.length > MAX_DRAWING_CHARS;
    setTooLarge(over);
    onChange(over ? null : data);
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    history.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (history.current.length > 20) history.current.shift();
    canvas.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = tool === "pen" ? "#8b5cf6" : "#efeff5";
    ctx.lineWidth = tool === "pen" ? 4 : 18;
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setEmpty(false);
    emit();
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    history.current = [];
    ctx.fillStyle = "#efeff5";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    setTooLarge(false);
    onChange(null);
  };

  const undo = () => {
    const previous = history.current.pop();
    if (!previous) return;
    canvasRef.current!.getContext("2d")!.putImageData(previous, 0, 0);
    if (history.current.length === 0) {
      setEmpty(true);
      onChange(null);
    } else emit();
  };

  return (
    <div className={styles.pad}>
      <div className={styles.canvasWrap}>
        <div className={styles.tools} role="toolbar" aria-label="그리기 도구">
          <button type="button" aria-pressed={tool === "pen"} className={tool === "pen" ? styles.toolOn : ""} onClick={() => setTool("pen")} aria-label="펜">
            ✎
          </button>
          <button type="button" aria-pressed={tool === "eraser"} className={tool === "eraser" ? styles.toolOn : ""} onClick={() => setTool("eraser")} aria-label="지우개">
            ⌫
          </button>
          <button type="button" onClick={clear} aria-label="모두 지우기">
            □
          </button>
          <button type="button" onClick={undo} aria-label="되돌리기">
            ↶
          </button>
        </div>
        <canvas
          ref={canvasRef}
          width={704}
          height={156}
          className={styles.canvas}
          aria-label="그림 그리기 캔버스"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
        {empty && (
          <span className={styles.canvasHint} aria-hidden="true">
            {placeholder}
          </span>
        )}
      </div>
      {tooLarge && (
        <p className={`${room.validation} ${room.validationError}`} role="alert">
          ! 그림이 너무 커요. 조금 지우고 다시 시도해 주세요.
        </p>
      )}
    </div>
  );
}

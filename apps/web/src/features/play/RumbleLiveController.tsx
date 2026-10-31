"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { LIVE_COLORS } from "@/features/creatorStudio/play/playOverlayClock";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { joinLiveRound } from "@/services/play/rumbleLive";
import { LIVE_INPUT_MS, LIVE_NAME_MAX, type LiveInviteView, type LiveMe } from "@/services/play/rumbleLiveTypes";
import styles from "./marbleInvite.module.css";
import local from "./rumbleLiveController.module.css";

type Identity = { playerId: string; secret: string; name: string };
const storageKey = (token: string) => `rumbleLive:${token}`;
/** Reads between sends while not fighting (ms). */
const IDLE_MS = 600;
const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0]
};

/**
 * 로얄 럼블 (조작형) 참가 · 조종 — code-first, route `/play/rumble/[token]`, no login. Join with a name while 모집 중 (the
 * fighter's key stays in this browser tab), then steer: drag the joystick (or WASD · 방향키) and press 공격 (or Space).
 * The stick is sent several times a second while fighting; the page shows the countdown, your HP and how it ended.
 */
export function RumbleLiveController({ token, invite }: { token: string; invite: LiveInviteView | null }) {
  const { t } = useI18n();
  const [me, setMe] = useState<Identity | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey(token));
      if (saved) setMe(JSON.parse(saved) as Identity);
    } catch {
      // No storage: the player joins again after a reload.
    }
    setReady(true);
  }, [token]);
  const remember = (id: Identity | null) => {
    setMe(id);
    try {
      if (id) sessionStorage.setItem(storageKey(token), JSON.stringify(id));
      else sessionStorage.removeItem(storageKey(token));
    } catch {
      // Ignored: the page still works for this visit.
    }
  };

  if (!invite) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1 className={styles.title}>{t("play.rumble")}</h1>
          <p className={styles.note}>{t("play.closed")}</p>
        </section>
      </main>
    );
  }
  if (!ready) return null;
  return me ? <Controller token={token} identity={me} onGone={() => remember(null)} /> : <JoinForm token={token} invite={invite} onJoined={remember} />;
}

function JoinForm({ token, invite, onJoined }: { token: string; invite: LiveInviteView; onJoined: (id: Identity) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const requestId = useRef<string | null>(null);
  const join = async () => {
    setError(null);
    setPending(true);
    requestId.current ??= crypto.randomUUID();
    try {
      const res = await joinLiveRound({ token, name, requestId: requestId.current });
      if (res.status === "JOINED") onJoined({ playerId: res.playerId, secret: res.secret, name: res.name });
      else {
        requestId.current = null;
        setError(res.message);
      }
    } catch {
      setError(t("play.joinError"));
    } finally {
      setPending(false);
    }
  };
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="live-join-title">
        <h1 id="live-join-title" className={styles.title}>
          🕹️ {invite.title}
        </h1>
        {invite.phase !== "OPEN" ? (
          <p className={styles.note}>{t("play.started")}</p>
        ) : (
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              void join();
            }}
          >
            <p className={styles.note}>
              {t("play.rumbleNote", { players: invite.players, max: invite.maxPlayers })}
            </p>
            <input className={styles.input} aria-label={t("play.nameAria")} placeholder={t("play.name")} maxLength={LIVE_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} />
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <button type="submit" className={styles.primary} disabled={pending || !name.trim()}>
              {t("play.join")}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

function Controller({ token, identity, onGone }: { token: string; identity: Identity; onGone: () => void }) {
  const { t } = useI18n();
  const [state, setState] = useState<LiveMe | null>(null);
  const [skew, setSkew] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const stick = useRef({ dx: 0, dy: 0 });
  const attack = useRef(false);
  const keys = useRef(new Set<string>());
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const phase = state?.phase;
  // The loop below keeps running across renders; it calls the latest onGone.
  const gone = useRef(onGone);
  useEffect(() => {
    gone.current = onGone;
  });

  // Send (while fighting) or just read, again and again.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const fighting = phase === "FIGHTING";
        const body = { token, playerId: identity.playerId, secret: identity.secret, ...(fighting ? { dx: stick.current.dx, dy: stick.current.dy, attack: attack.current } : {}) };
        attack.current = false;
        const res = await fetch("/api/play/rumble-live/input", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
        if (!alive) return;
        if (res.status === 404) return gone.current();
        if (res.ok) {
          const data = (await res.json()) as { me: LiveMe };
          setState(data.me);
          setSkew(Date.parse(data.me.serverNow) - Date.now());
        }
      } catch {
        // A dropped request is retried on the next tick.
      }
      if (alive) timer = setTimeout(tick, phase === "FIGHTING" || phase === "COUNTDOWN" ? LIVE_INPUT_MS : IDLE_MS);
    };
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [token, identity, phase]);

  useEffect(() => {
    if (phase !== "COUNTDOWN") return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [phase]);

  // Keyboard: WASD · 방향키 move, Space attacks.
  const fromKeys = useCallback(() => {
    let x = 0;
    let y = 0;
    for (const k of keys.current) {
      x += KEYS[k][0];
      y += KEYS[k][1];
    }
    const len = Math.hypot(x, y) || 1;
    stick.current = { dx: x / len, dy: y / len };
    setKnob({ x: x / len, y: y / len });
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        attack.current = true;
      } else if (KEYS[e.code]) {
        e.preventDefault();
        keys.current.add(e.code);
        fromKeys();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (keys.current.delete(e.code)) fromKeys();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [fromKeys]);

  // The on-screen joystick.
  const pad = useRef<HTMLDivElement>(null);
  const steer = (e: PointerEvent<HTMLDivElement>) => {
    const box = pad.current!.getBoundingClientRect();
    const r = box.width / 2;
    let x = (e.clientX - box.left - r) / r;
    let y = (e.clientY - box.top - r) / r;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    stick.current = { dx: x, dy: y };
    setKnob({ x, y });
  };
  const release = () => {
    stick.current = { dx: 0, dy: 0 };
    setKnob({ x: 0, y: 0 });
  };

  const color = LIVE_COLORS[(state?.me.color ?? 0) % LIVE_COLORS.length];
  const countdown = state?.startAt ? Math.max(0, Math.ceil((Date.parse(state.startAt) - (now + skew)) / 1000)) : 0;
  const m = state?.me;
  return (
    <main className={local.page} style={{ "--me": color } as CSSProperties}>
      <header className={local.head}>
        <span className={local.dot} aria-hidden />
        <strong>{identity.name}</strong>
        <span className={local.muted}>{state ? `${state.title} · ${state.phase === "OPEN" ? t("play.joinedCount", { count: state.players }) : t("play.aliveCount", { alive: state.alive, players: state.players })}` : t("play.connecting")}</span>
      </header>

      {state?.phase === "OPEN" && <p className={local.big}>{t("play.waiting")}</p>}
      {state?.phase === "COUNTDOWN" && <p className={local.count}>{countdown || t("play.go")}</p>}
      {m && (state?.phase === "FIGHTING" || state?.phase === "COUNTDOWN") && (
        <div className={local.hp} role="meter" aria-label={t("play.hp")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={m.hp}>
          <span style={{ width: `${m.hp}%` }} />
          <b>
            {t("play.hpLine", { hp: m.hp, kills: m.kills })}
          </b>
        </div>
      )}
      {m && !m.alive && state?.phase === "FIGHTING" && (
        <p className={local.big}>
          {t("play.out", { rank: m.rank ?? "", kills: m.kills })}
        </p>
      )}
      {state?.phase === "DONE" && (
        <p className={local.big} role="status">
          {state.winner === identity.name ? t("play.youWon") : t("play.winner", { name: String(state.winner) })} · {t("play.myResult", { rank: m?.rank ?? "", kills: m?.kills ?? "" })}
        </p>
      )}

      {(state?.phase === "FIGHTING" || state?.phase === "COUNTDOWN") && m?.alive && (
        <div className={local.controls}>
          <div
            ref={pad}
            className={local.pad}
            role="application"
            aria-label={t("play.joystick")}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              steer(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons) steer(e);
            }}
            onPointerUp={release}
            onPointerCancel={release}
          >
            <span className={local.knob} style={{ transform: `translate(${knob.x * 60}%, ${knob.y * 60}%)` } as CSSProperties} />
          </div>
          <button type="button" className={local.attack} onPointerDown={() => (attack.current = true)} aria-label={t("play.attackAria")}>
            {t("play.attack")}
          </button>
        </div>
      )}
      <p className={local.muted}>{t("play.howTo")}</p>
    </main>
  );
}

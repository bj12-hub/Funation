"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChargeModal } from "@/features/walletCharge";
import { formatNumber } from "@/lib/format";
import type { DonationCatalog } from "@/services/donations/donationCatalog";
import { requestDonation } from "@/services/donations/donate";
import { getCrewPublic } from "@/services/crew/crew";
import type { CrewPublic } from "@/services/crew/crewTypes";
import { getAlertBadges, getDonationNicknameOptions } from "@/services/supporter/identity";
import { alertBadgeLabels } from "@/services/supporter/identityTypes";
import { DonationCompleteDialog, DonationConfirmDialog, InsufficientFnDialog, type AlertPreview } from "./DonationDialogs";
import { MiniFields, SignatureFields, TextFields, VideoFields, WishlistFields } from "./donation/Fields";
import { DrawingFields, GachaFields, QuestFields, RouletteFields } from "./donation/GameFields";
import { SignaturePopup } from "./donation/SignaturePopup";
import { buildDraft, initialStates, isFormKey, type FormKey, type FormStates } from "./donation/drafts";
import panel from "./donation/donation.module.css";
import styles from "./room.module.css";

type Dialog =
  | { kind: "NONE" }
  | { kind: "CONFIRM" }
  | { kind: "COMPLETE"; fnAmount: number; balance: number }
  | { kind: "INSUFFICIENT"; balance: number; required: number }
  | { kind: "CHARGE" }
  | { kind: "SIGNATURES" };

const CHIPS_PER_PAGE = 6;

/**
 * Donation tab. Figma 610:138 · 851:4546 (일반) · 851:4665 (미니) · 851:4788 (영상) · 851:4929 (시그니처)
 * · 851:5054 (위시) · 867:* (룰렛·퀘스트·그림) · 뽑기 (code-first) → 613:6 확인 → 613:122 완료, or 613:237 FN 부족 → FN 충전 modal.
 *
 * Every type goes through the same Donation Core: one confirm step, one server action, one debit.
 * Each confirmed submission carries an idempotency key so a double click or retry never debits twice.
 */
export function DonationForm({
  creatorId,
  name,
  donation,
  signedIn,
  fnBalance,
  onDonated
}: {
  creatorId: string;
  name: string;
  donation: DonationCatalog;
  signedIn: boolean;
  fnBalance: number | null;
  onDonated: (donation: { fnAmount: number; text: string; anonymous: boolean }) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [typeIndex, setTypeIndex] = useState(0);
  const [chipPage, setChipPage] = useState(0);
  const [states, setStates] = useState<FormStates>(() => initialStates(donation));
  const [hideProfile, setHideProfile] = useState(false);
  // Donation nicknames (별명); the first entry is the default and is sent as null.
  const [nicknames, setNicknames] = useState<{ id: string; name: string }[]>([]);
  const [nicknameId, setNicknameId] = useState<string | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    getDonationNicknameOptions().then((list) => alive && list && setNicknames(list));
    return () => {
      alive = false;
    };
  }, [signedIn]);
  // Crew members of this creator (크루 멤버 지정); optional, validated again on the server.
  const [members, setMembers] = useState<CrewPublic["members"]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getCrewPublic(creatorId).then((crew) => alive && setMembers(crew.members));
    return () => {
      alive = false;
    };
  }, [creatorId]);
  // Remounts the fields after a completed donation (e.g. clears the drawing canvas).
  const [formVersion, setFormVersion] = useState(0);
  const [dialog, setDialog] = useState<Dialog>({ kind: "NONE" });
  // 후원 알림 미리보기 in the confirm dialog; the counter drops answers for an earlier opening.
  const [alertPreview, setAlertPreview] = useState<AlertPreview | null>(null);
  const previewSeq = useRef(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per confirmed request; kept when the outcome is unknown so a retry cannot debit twice.
  const keyRef = useRef<string | null>(null);

  const type = donation.types[typeIndex];
  const formKey = isFormKey(type.key) && type.available ? type.key : null;
  const draft = formKey ? buildDraft(formKey, states, donation) : null;
  const loginHref = `/login?next=${encodeURIComponent(pathname)}`;
  const pageCount = Math.ceil(donation.types.length / CHIPS_PER_PAGE);
  const chips = donation.types.slice(chipPage * CHIPS_PER_PAGE, (chipPage + 1) * CHIPS_PER_PAGE);

  const update = <K extends FormKey>(key: K) => (next: FormStates[K]) => {
    keyRef.current = null; // any edit makes it a different request
    setStates((s) => ({ ...s, [key]: next }));
  };

  const open = () => {
    if (!draft?.details || draft.amount === null) return;
    // UX pre-check with the server-provided balance; the server checks again on submit.
    if (fnBalance !== null && draft.amount > fnBalance) {
      setDialog({ kind: "INSUFFICIENT", balance: fnBalance, required: draft.amount });
      return;
    }
    setError(null);
    setDialog({ kind: "CONFIRM" });
    loadAlertPreview();
  };

  const loadAlertPreview = () => {
    const seq = ++previewSeq.current;
    // A hidden profile is delivered as 익명 without badges (same rule as the Donation Core).
    if (hideProfile) return setAlertPreview({ status: "READY", name: "익명", badges: [] });
    setAlertPreview({ status: "LOADING" });
    getAlertBadges(nicknameId, creatorId)
      .then((b) => seq === previewSeq.current && setAlertPreview(b ? { status: "READY", name: b.name, badges: alertBadgeLabels(b) } : { status: "ERROR" }))
      .catch(() => seq === previewSeq.current && setAlertPreview({ status: "ERROR" }));
  };

  const confirm = async () => {
    if (!draft?.details || !formKey) return;
    keyRef.current ??= crypto.randomUUID();
    setPending(true);
    setError(null);
    try {
      const result = await requestDonation({ ...draft.details, creatorId, hideProfile, nicknameId, memberId, idempotencyKey: keyRef.current });
      switch (result.status) {
        case "COMPLETED":
          keyRef.current = null;
          setDialog({ kind: "COMPLETE", fnAmount: result.fnAmount, balance: result.balance });
          onDonated({ fnAmount: result.fnAmount, text: draft.chatText, anonymous: hideProfile });
          setStates((s) => ({ ...s, [formKey]: initialStates(donation)[formKey] }));
          setFormVersion((v) => v + 1);
          router.refresh(); // header, side nav and this tab show the new server balance
          break;
        case "INSUFFICIENT_FN":
          keyRef.current = null;
          setDialog({ kind: "INSUFFICIENT", balance: result.balance, required: result.required });
          break;
        case "IN_PROGRESS":
          setError("후원을 처리하고 있습니다. 잠시 후 다시 시도해 주세요.");
          break;
        case "UNAUTHORIZED":
          router.push(loginHref);
          break;
        default:
          keyRef.current = null;
          setError("후원 정보를 다시 확인해 주세요.");
      }
    } catch {
      setError("후원 결과를 확인하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  };

  const selectType = (index: number) => {
    setTypeIndex(index);
    keyRef.current = null;
  };

  return (
    <div className={styles.donation}>
      <div className={styles.typeRow}>
        <button type="button" className={styles.typeArrow} aria-label="이전 후원 유형" disabled={chipPage === 0} onClick={() => setChipPage((p) => p - 1)}>
          ‹
        </button>
        <div className={styles.types} role="radiogroup" aria-label="후원 유형">
          {chips.map((t) => {
            const i = donation.types.indexOf(t);
            return (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={i === typeIndex}
                className={`${styles.type} ${i === typeIndex ? styles.typeOn : ""}`}
                onClick={() => selectType(i)}
              >
                <span aria-hidden="true">{t.emoji}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className={styles.typeArrow}
          aria-label="다음 후원 유형"
          disabled={chipPage >= pageCount - 1}
          onClick={() => setChipPage((p) => p + 1)}
        >
          ›
        </button>
      </div>

      <div className={styles.titleRow}>
        <h2 className={styles.formTitle}>{type.title}</h2>
        {fnBalance !== null && <span className={styles.balance}>보유 {formatNumber(fnBalance)} FN</span>}
      </div>

      <form
        key={formVersion}
        className={styles.form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (signedIn) open();
        }}
      >
        {formKey === "TEXT" && <TextFields value={states.TEXT} onChange={update("TEXT")} catalog={donation} balance={fnBalance} error={draft?.error ?? null} />}
        {formKey === "MINI" && (
          <MiniFields value={states.MINI} onChange={update("MINI")} catalog={donation} balance={fnBalance} error={draft?.error ?? null} onEnter={() => signedIn && open()} />
        )}
        {formKey === "VIDEO" && <VideoFields value={states.VIDEO} onChange={update("VIDEO")} catalog={donation} balance={fnBalance} error={draft?.error ?? null} />}
        {formKey === "SIGNATURE" && (
          <SignatureFields
            value={states.SIGNATURE}
            onChange={update("SIGNATURE")}
            catalog={donation}
            balance={fnBalance}
            onOpenAll={() => setDialog({ kind: "SIGNATURES" })}
          />
        )}
        {formKey === "ROULETTE" && (
          <RouletteFields value={states.ROULETTE} onChange={update("ROULETTE")} catalog={donation} error={draft?.error ?? null} creatorId={creatorId} signedIn={signedIn} />
        )}
        {formKey === "QUEST" && <QuestFields value={states.QUEST} onChange={update("QUEST")} catalog={donation} error={draft?.error ?? null} />}
        {formKey === "DRAWING" && <DrawingFields value={states.DRAWING} onChange={update("DRAWING")} catalog={donation} error={draft?.error ?? null} />}
        {formKey === "GACHA" && (
          <GachaFields value={states.GACHA} onChange={update("GACHA")} catalog={donation} error={draft?.error ?? null} creatorId={creatorId} signedIn={signedIn} />
        )}
        {formKey === "WISHLIST" && (
          <WishlistFields value={states.WISHLIST} onChange={update("WISHLIST")} catalog={donation} balance={fnBalance} creatorName={name} error={draft?.error ?? null} />
        )}
        {!formKey && (
          <p className={panel.unavailable} role="status">
            준비 중인 후원 유형이에요.
          </p>
        )}

        {/* Code-first (no Figma frame): attribute the donation to a crew member. */}
        {members.length > 0 && (
          <div className={styles.memberRow}>
            <span className={styles.memberLabel}>멤버 지정 (선택)</span>
            <div className={styles.memberChips} role="radiogroup" aria-label="크루 멤버">
              {[{ id: null as string | null, name: "지정 안 함", color: "transparent" }, ...members].map((m) => (
                <button
                  key={m.id ?? "none"}
                  type="button"
                  role="radio"
                  aria-checked={memberId === m.id}
                  className={styles.memberChip}
                  onClick={() => {
                    setMemberId(m.id);
                    keyRef.current = null;
                  }}
                >
                  {m.id && <span className={styles.memberDot} style={{ background: m.color }} aria-hidden="true" />}
                  {m.name}
                </button>
              ))}
            </div>
            <span className={styles.memberHint}>멤버를 고르면 그 멤버의 순위에 집계돼요.</span>
          </div>
        )}

        {/* Code-first (no Figma frame): donate under one of the supporter's 별명. */}
        {signedIn && nicknames.length > 1 && (
          <label className={styles.nicknameRow}>
            <span>별명</span>
            <select
              value={nicknameId ?? ""}
              onChange={(e) => {
                setNicknameId(e.target.value || null);
                keyRef.current = null;
              }}
              aria-label="후원 별명"
            >
              {nicknames.map((n, i) => (
                <option key={n.id} value={i === 0 ? "" : n.id}>
                  {n.name}
                  {i === 0 ? " (대표)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className={styles.toggleRow}>
          <button
            type="button"
            role="switch"
            aria-checked={hideProfile}
            aria-label="프로필 숨기기"
            className={styles.miniToggle}
            onClick={() => {
              setHideProfile((h) => !h);
              keyRef.current = null;
            }}
          />
          <span aria-hidden="true">프로필 숨기기</span>
        </div>
      </form>

      {signedIn ? (
        <button type="button" className={styles.submit} disabled={!draft?.details} onClick={open}>
          {draft?.buttonLabel ?? `${name}님에게 후원하기`}
        </button>
      ) : (
        <button type="button" className={styles.submit} onClick={() => router.push(loginHref)}>
          로그인하고 후원하기
        </button>
      )}

      <DonationConfirmDialog
        open={dialog.kind === "CONFIRM"}
        creatorName={name}
        amount={draft?.amount ?? 0}
        rows={draft?.summary ?? []}
        alert={alertPreview}
        pending={pending}
        error={error}
        onCancel={() => setDialog({ kind: "NONE" })}
        onConfirm={() => void confirm()}
      />
      <DonationCompleteDialog
        open={dialog.kind === "COMPLETE"}
        fnAmount={dialog.kind === "COMPLETE" ? dialog.fnAmount : 0}
        balance={dialog.kind === "COMPLETE" ? dialog.balance : 0}
        onClose={() => setDialog({ kind: "NONE" })}
      />
      <InsufficientFnDialog
        open={dialog.kind === "INSUFFICIENT"}
        balance={dialog.kind === "INSUFFICIENT" ? dialog.balance : 0}
        onCancel={() => setDialog({ kind: "NONE" })}
        onCharge={() => setDialog({ kind: "CHARGE" })}
      />
      <SignaturePopup
        open={dialog.kind === "SIGNATURES"}
        signatures={donation.signatures}
        initial={states.SIGNATURE.signatureId}
        onClose={() => setDialog({ kind: "NONE" })}
        onSelect={(id) => {
          update("SIGNATURE")({ ...states.SIGNATURE, signatureId: id });
          setDialog({ kind: "NONE" });
        }}
      />
      {dialog.kind === "CHARGE" && <ChargeModal onClose={() => setDialog({ kind: "NONE" })} />}
    </div>
  );
}

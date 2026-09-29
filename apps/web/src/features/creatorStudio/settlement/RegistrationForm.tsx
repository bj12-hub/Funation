"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { ChevronDownSmallIcon } from "@/components/icons";
import { Toast } from "@/components/ui/Toast";
import { registerSettlement } from "@/services/creator/settlement";
import {
  BANKS,
  CHANNEL_PLATFORMS,
  CORP_TAX_TYPES,
  MEMBER_TYPES,
  NATIONALITIES,
  TAX_EXEMPT_OPTIONS,
  VISA_TYPES,
  type MemberType
} from "@/services/creator/settlementTypes";
import { AddressInputs, EmailInputs, Field, FormCard, PhoneInputs, Select, TaxBar, TextInput, UploadField } from "./formFields";
import styles from "./registration.module.css";

const TITLES: Record<MemberType, string> = {
  INDIVIDUAL: "정산 자료 등록",
  FOREIGN_RESIDENT: "정산 자료 등록 (개인 - 외국인)",
  SOLE_PROPRIETOR: "정산 자료 등록 (개인사업자)",
  CORPORATION: "정산 자료 등록"
};

const SAME_AS_ACCOUNT = "정산 받으실 계좌와 동일한 정보를 입력해 주세요.";

/**
 * 정산 자료 등록 — Figma 429:219 (개인) · 443:5 (외국인) · 433:210 (개인사업자) · 437:4 (법인).
 * Native validation gives instant feedback; `registerSettlement` validates everything again.
 */
export function RegistrationForm({ memberType }: { memberType: MemberType }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const clearToast = useCallback(() => setToast(null), []);
  const t = memberType;

  const submit = (form: HTMLFormElement) => {
    setError(null);
    const fd = new FormData(form);
    fd.set("memberType", t);
    startTransition(async () => {
      const res = await registerSettlement(fd);
      if (res.status === "SUBMITTED") {
        router.push("/creator/settlement?registered=1");
        router.refresh();
      } else if (res.status === "INVALID") {
        setError(res.message);
        if (res.field) form.querySelector<HTMLElement>(`[name="${res.field}"], [name^="${res.field}"]`)?.focus();
      } else if (res.status === "NO_TERMS") router.push(`/creator/settlement/register?type=${t}`);
      else if (res.status === "ALREADY_REGISTERED") router.push("/creator/settlement/manage");
      else router.push("/login?role=creator&next=/creator/settlement/register");
    });
  };

  const bankCard = (holderHelper: string, holderPlaceholder: string, fallback: string) => (
    <>
      <FormCard title="계좌 인증">
        <Field label="은행명" htmlFor="st-bank">
          <Select id="st-bank" name="bank" options={BANKS} defaultValue={t === "SOLE_PROPRIETOR" || t === "CORPORATION" ? "우리은행" : "신한은행"} />
        </Field>
        <Field label="계좌번호" htmlFor="st-account">
          <TextInput id="st-account" name="accountNo" inputMode="numeric" pattern="\d{6,20}" maxLength={20} placeholder="-없이 입력" />
        </Field>
        <Field label="예금주 명" helper={holderHelper} htmlFor="st-holder">
          <TextInput id="st-holder" name="holder" maxLength={40} placeholder={holderPlaceholder} />
        </Field>
      </FormCard>
      <label className={styles.fallback}>
        <input type="checkbox" name="manualVerification" value="1" />
        <span>{fallback}</span>
      </label>
    </>
  );

  const phoneField = (
    <Field label="전화번호" group>
      <PhoneInputs prefix="phone" label="전화번호" />
    </Field>
  );
  const emailField = (
    <Field label="이메일" group>
      <EmailInputs prefix="email" label="이메일" />
    </Field>
  );
  const addressField = (
    <Field label="주소" group>
      <AddressInputs onSearch={() => setToast("주소 검색은 준비 중이에요. 주소를 직접 입력해 주세요.")} />
    </Field>
  );
  const channelField = (
    <Field label="Funation 사용채널" group>
      <span className={styles.row}>
        <ChannelSelect />
        <TextInput name="channelUrl" type="url" maxLength={300} placeholder="채널 URL을 입력해 주세요" aria-label="채널 URL" />
      </span>
    </Field>
  );
  const bizNoField = (
    <Field label="사업자등록번호" group>
      <span className={styles.row}>
        <TextInput name="bizNo1" inputMode="numeric" pattern="\d{3}" maxLength={3} placeholder="000" aria-label="사업자등록번호 앞 3자리" />
        <span className={styles.dash} aria-hidden="true">
          -
        </span>
        <TextInput name="bizNo2" inputMode="numeric" pattern="\d{2}" maxLength={2} placeholder="00" aria-label="사업자등록번호 가운데 2자리" />
        <span className={styles.dash} aria-hidden="true">
          -
        </span>
        <TextInput name="bizNo3" inputMode="numeric" pattern="\d{5}" maxLength={5} placeholder="00000" aria-label="사업자등록번호 끝 5자리" />
      </span>
    </Field>
  );
  const bizKindField = (
    <Field label="업태 / 업종" group>
      <span className={styles.row}>
        <TextInput name="bizCategory" maxLength={40} placeholder="업태" aria-label="업태" />
        <TextInput name="bizItem" maxLength={40} placeholder="업종" aria-label="업종" />
      </span>
    </Field>
  );
  const upload = (name: string, label: string, target: string, helper?: string, guide?: string) => (
    <UploadField name={name} label={label} target={target} helper={helper} guide={guide} onInvalid={setError} />
  );

  return (
    <div className={styles.content}>
      <nav className={styles.breadcrumb} aria-label="현재 위치">
        <Link href="/creator/settlement">정산관리</Link> <span aria-hidden="true">&gt;</span> <Link href={`/creator/settlement/register?type=${t}`}>정산 등록</Link>{" "}
        <span aria-hidden="true">&gt;</span> <span aria-current="page">정산 자료 등록</span>
      </nav>
      <h1 className={styles.title}>{TITLES[t]}</h1>

      {/* 443:62 type tabs — switching type goes back to 이용동의 for that type (consent is per type). */}
      <nav className={styles.typeTabs} aria-label="회원 유형">
        {MEMBER_TYPES.map((m) => (
          <Link key={m.key} href={`/creator/settlement/register?type=${m.key}`} className={styles.typeTab} aria-current={m.key === t ? "page" : undefined}>
            {m.formLabel}
          </Link>
        ))}
      </nav>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          submit(e.currentTarget);
        }}
      >
        {t === "INDIVIDUAL" && (
          <>
            <FormCard title="본인 인증">
              <TaxBar value="개인 (사업소득)" />
              <Field label="이름" helper={SAME_AS_ACCOUNT} htmlFor="st-name">
                <TextInput id="st-name" name="name" maxLength={40} placeholder="이름을 입력해주세요" />
              </Field>
              <IdNumberField label="주민등록번호" frontHint="앞 6자리" backHint="뒤 7자리" />
              {phoneField}
            </FormCard>
            {bankCard("정산 받으실 본인 명의의 계좌번호를 입력해 주세요.", "예금주 명을 입력해주세요", "실명인증 및 계좌인증이 어려운 경우 체크하세요 (파일 직접 업로드 필수)")}
            <FormCard title="추가 정보">
              {emailField}
              {addressField}
              {channelField}
            </FormCard>
            <FormCard title="파일 업로드">
              {upload("idCopy", "신분증 사본", "신분증 사본을", "주민등록증, 운전면허증, 여권 사본 중 하나", "개인(대한민국 국민) 신분증 인정범위 안내")}
              {upload("bankCopy", "통장 사본", "통장 사본을", "계좌인증을 완료한 통장의 사본", "통장사본 업로드 방법 안내")}
            </FormCard>
          </>
        )}

        {t === "FOREIGN_RESIDENT" && (
          <>
            <FormCard title="계약자 정보">
              <TaxBar value="개인 (사업소득, 대한민국 거주 외국인)" />
              <Field label="이름" helper={SAME_AS_ACCOUNT} htmlFor="st-name">
                <TextInput id="st-name" name="name" maxLength={40} placeholder="여권 또는 외국인등록증 상의 이름을 입력해주세요" />
              </Field>
              <IdNumberField label="외국인등록번호" frontHint="앞 6자리 (예: 950101)" backHint="뒤 7자리 (예: 5xxxxxx)" />
            </FormCard>
            {bankCard("정산 받으실 외국인등록증 상의 이름과 완전히 일치해야 합니다.", "예금주 명을 입력해주세요", "외국인등록인증 및 계좌인증이 어려운 경우 체크하세요 (파일 직접 업로드 필수)")}
            <FormCard title="추가 정보">
              <div className={styles.pair}>
                <Field label="국적 (국가/지역)" htmlFor="st-nation">
                  <Select id="st-nation" name="nationality" options={NATIONALITIES} placeholder="선택해주세요" />
                </Field>
                <Field label="체류 자격 (비자 종류)" htmlFor="st-visa">
                  <Select id="st-visa" name="visa" options={VISA_TYPES} placeholder="선택해주세요" />
                </Field>
              </div>
              {phoneField}
              {emailField}
              {addressField}
              {channelField}
            </FormCard>
            <FormCard title="파일 업로드">
              {upload(
                "foreignIdCopy",
                "외국인등록증 (또는 영주증) 사본",
                "외국인등록증 (또는 영주증) 사본을(를)",
                "이름, 외국인등록번호 및 체류 자격이 명확히 식별되는 선명한 사본 (앞/뒷면 모두 포함)",
                "개인(대한민국 거주 외국인) 신분증 인정범위 안내"
              )}
              {upload("bankCopy", "통장 사본", "통장 사본을(를)", "계좌인증을 완료한 본인 명의의 통장 사본", "통장사본 업로드 방법 안내")}
            </FormCard>
          </>
        )}

        {t === "SOLE_PROPRIETOR" && (
          <>
            <FormCard title="본인 인증">
              <TaxBar value="개인사업자" />
              {bizNoField}
              <Field label="면세 여부" helper="1인 미디어 콘텐츠 창작자(940306) 만 비과세 대상입니다." htmlFor="st-exempt">
                <Select id="st-exempt" name="taxExempt" options={TAX_EXEMPT_OPTIONS} defaultValue="과세사업자" />
              </Field>
              <Field label="대표자 성명" helper={SAME_AS_ACCOUNT} htmlFor="st-ceo">
                <TextInput id="st-ceo" name="ceoName" maxLength={40} placeholder="대표자 성명을 입력해주세요" />
              </Field>
            </FormCard>
            {bankCard("정산 받으실 본인 명의 혹은 기업 명의의 계좌번호를 입력해 주세요.", "예금주 명", "사업자인증 및 계좌인증이 어려운 경우 체크하세요 (파일 직접 업로드 필수)")}
            <FormCard title="추가 정보">
              <Field label="상호" htmlFor="st-company">
                <TextInput id="st-company" name="companyName" maxLength={60} placeholder="상호명 입력" />
              </Field>
              {bizKindField}
              {phoneField}
              {emailField}
              {addressField}
              {channelField}
            </FormCard>
            <FormCard title="파일 업로드">
              {upload("bizLicense", "사업자등록증", "사업자등록증을", "대표자 성명 및 사업자등록번호가 식별되는 선명한 사본")}
              {upload("bankCopy", "통장 사본", "통장 사본을", "계좌인증을 완료한 통장의 사본")}
            </FormCard>
          </>
        )}

        {t === "CORPORATION" && (
          <>
            <FormCard title="사업자 인증">
              <Field label="과세 유형" htmlFor="st-corp-type">
                <Select id="st-corp-type" name="corpTaxType" options={CORP_TAX_TYPES} defaultValue="법인 사업자" />
              </Field>
              {bizNoField}
              <Field label="상호" helper={SAME_AS_ACCOUNT} htmlFor="st-company">
                <TextInput id="st-company" name="companyName" maxLength={60} placeholder="상호명 입력" />
              </Field>
            </FormCard>
            {bankCard(SAME_AS_ACCOUNT, "예금주 명", "사업자인증, 계좌인증이 어려운 경우 체크하세요 (파일 직접 업로드 필수)")}
            <FormCard title="추가 정보">
              {bizKindField}
              <Field label="대표자 성명" htmlFor="st-ceo">
                <TextInput id="st-ceo" name="ceoName" maxLength={40} placeholder="대표자 성명 입력" />
              </Field>
              {phoneField}
              {emailField}
              {addressField}
              {channelField}
            </FormCard>
            <FormCard title="정산 담당자">
              <div className={styles.pair}>
                <Field label="이름" htmlFor="st-manager">
                  <TextInput id="st-manager" name="managerName" maxLength={40} placeholder="이름" />
                </Field>
                <Field label="직책" htmlFor="st-manager-title">
                  <TextInput id="st-manager-title" name="managerTitle" maxLength={40} placeholder="직책" />
                </Field>
              </div>
              <Field label="전화번호" group>
                <PhoneInputs prefix="managerPhone" label="담당자 전화번호" />
              </Field>
              <Field label="이메일" group>
                <EmailInputs prefix="managerEmail" label="담당자 이메일" />
              </Field>
            </FormCard>
            <FormCard title="파일 업로드">
              {upload("bizLicense", "사업자등록증", "사업자등록증을")}
              {upload("bankCopy", "통장 사본", "통장 사본을", undefined, "통장사본 업로드 방법 안내")}
              {upload("accountForm", "입금계좌등록신청서", "입금계좌 등록신청서를", undefined, "입금계좌 등록신청서 다운로드 및 안내")}
              {upload("corpSeal", "법인인감증명서", "법인인감증명서를", "3개월 이내 발급분")}
            </FormCard>
          </>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <Link href={`/creator/settlement/register?type=${t}`} className={styles.back}>
            뒤로
          </Link>
          <button type="submit" className={styles.submit} disabled={pending} aria-busy={pending || undefined}>
            {pending ? "제출 중..." : t === "CORPORATION" ? "등록 (신청하기)" : "신청하기"}
          </button>
        </div>
      </form>
      <Toast message={toast} onDone={clearToast} tone="neutral" />
    </div>
  );
}

/** 주민등록번호 / 외국인등록번호: 6 + 7 digits, the back half masked while typing. */
function IdNumberField({ label, frontHint, backHint }: { label: string; frontHint: string; backHint: string }) {
  return (
    <Field label={label} group>
      <span className={styles.row}>
        <TextInput name="idFront" inputMode="numeric" pattern="\d{6}" maxLength={6} placeholder={frontHint} aria-label={`${label} ${frontHint}`} />
        <span className={styles.dash} aria-hidden="true">
          -
        </span>
        <TextInput name="idBack" type="password" inputMode="numeric" pattern="\d{7}" maxLength={7} placeholder={backHint} aria-label={`${label} ${backHint}`} autoComplete="off" />
      </span>
    </Field>
  );
}

/** Platform dropdown posting the platform key. */
function ChannelSelect() {
  return (
    <span className={`${styles.selectWrap} ${styles.channelSelect}`}>
      <select name="channelPlatform" className={styles.select} required defaultValue="YOUTUBE" aria-label="사용 플랫폼">
        {CHANNEL_PLATFORMS.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
      <ChevronDownSmallIcon className={styles.selectChevron} aria-hidden="true" />
    </span>
  );
}

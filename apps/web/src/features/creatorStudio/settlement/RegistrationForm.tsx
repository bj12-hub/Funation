"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { ChevronDownSmallIcon } from "@/components/icons";
import { Toast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
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
import { MEMBER_TYPE_FORM_KEY } from "./settlementLabels";
import { AddressInputs, EmailInputs, Field, FormCard, PhoneInputs, Select, TaxBar, TextInput, UploadField } from "./formFields";
import styles from "./registration.module.css";

const TITLES: Record<MemberType, MessageKey> = {
  INDIVIDUAL: "studioSettlementForm.titleIndividual",
  FOREIGN_RESIDENT: "studioSettlementForm.titleForeign",
  SOLE_PROPRIETOR: "studioSettlementForm.titleSole",
  CORPORATION: "studioSettlementForm.titleCorporation"
};

/**
 * 정산 자료 등록 — Figma 429:219 (개인) · 443:5 (외국인) · 433:210 (개인사업자) · 437:4 (법인).
 * Native validation gives instant feedback; `registerSettlement` validates everything again. `tr` translates (`t` is the
 * member type here); the tax-type bars, the 면세 helper and the select options (banks, nationalities, visa and tax types)
 * stay as written.
 */
export function RegistrationForm({ memberType }: { memberType: MemberType }) {
  const { t: tr } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const clearToast = useCallback(() => setToast(null), []);
  const t = memberType;
  const SAME_AS_ACCOUNT = tr("studioSettlementForm.sameAsAccount");

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
      <FormCard title={tr("studioSettlementForm.cardAccount")}>
        <Field label={tr("studioSettlementForm.bank")} htmlFor="st-bank">
          <Select id="st-bank" name="bank" options={BANKS} defaultValue={t === "SOLE_PROPRIETOR" || t === "CORPORATION" ? "우리은행" : "신한은행"} />
        </Field>
        <Field label={tr("studioSettlementForm.accountNo")} htmlFor="st-account">
          <TextInput id="st-account" name="accountNo" inputMode="numeric" pattern="\d{6,20}" maxLength={20} placeholder={tr("studioSettlementForm.accountNoPlaceholder")} />
        </Field>
        <Field label={tr("studioSettlementForm.holder")} helper={holderHelper} htmlFor="st-holder">
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
    <Field label={tr("studioSettlementForm.phone")} group>
      <PhoneInputs prefix="phone" label={tr("studioSettlementForm.phone")} />
    </Field>
  );
  const emailField = (
    <Field label={tr("studioSettlementForm.email")} group>
      <EmailInputs prefix="email" label={tr("studioSettlementForm.email")} />
    </Field>
  );
  const addressField = (
    <Field label={tr("studioSettlementForm.address")} group>
      <AddressInputs onSearch={() => setToast(tr("studioSettlementForm.addressSoon"))} />
    </Field>
  );
  const channelField = (
    <Field label={tr("studioSettlementForm.channel")} group>
      <span className={styles.row}>
        <ChannelSelect />
        <TextInput name="channelUrl" type="url" maxLength={300} placeholder={tr("studioSettlementForm.channelUrlPlaceholder")} aria-label={tr("studioSettlementForm.channelUrl")} />
      </span>
    </Field>
  );
  const bizNoField = (
    <Field label={tr("studioSettlementForm.bizNo")} group>
      <span className={styles.row}>
        <TextInput name="bizNo1" inputMode="numeric" pattern="\d{3}" maxLength={3} placeholder="000" aria-label={tr("studioSettlementForm.bizNoFirst")} />
        <span className={styles.dash} aria-hidden="true">
          -
        </span>
        <TextInput name="bizNo2" inputMode="numeric" pattern="\d{2}" maxLength={2} placeholder="00" aria-label={tr("studioSettlementForm.bizNoMiddle")} />
        <span className={styles.dash} aria-hidden="true">
          -
        </span>
        <TextInput name="bizNo3" inputMode="numeric" pattern="\d{5}" maxLength={5} placeholder="00000" aria-label={tr("studioSettlementForm.bizNoLast")} />
      </span>
    </Field>
  );
  const bizKindField = (
    <Field label={tr("studioSettlementForm.bizKind")} group>
      <span className={styles.row}>
        <TextInput name="bizCategory" maxLength={40} placeholder={tr("studioSettlementForm.bizCategory")} aria-label={tr("studioSettlementForm.bizCategory")} />
        <TextInput name="bizItem" maxLength={40} placeholder={tr("studioSettlementForm.bizItem")} aria-label={tr("studioSettlementForm.bizItem")} />
      </span>
    </Field>
  );
  const upload = (name: string, label: string, target: string, helper?: string, guide?: string) => (
    <UploadField name={name} label={label} target={target} helper={helper} guide={guide} onInvalid={setError} />
  );

  return (
    <div className={styles.content}>
      <nav className={styles.breadcrumb} aria-label={tr("studioSettlementForm.breadcrumbAria")}>
        <Link href="/creator/settlement">{tr("studioSettlementForm.crumbSettlement")}</Link> <span aria-hidden="true">&gt;</span>{" "}
        <Link href={`/creator/settlement/register?type=${t}`}>{tr("studioSettlementForm.crumbRegister")}</Link> <span aria-hidden="true">&gt;</span>{" "}
        <span aria-current="page">{tr("studioSettlementForm.crumbForm")}</span>
      </nav>
      <h1 className={styles.title}>{tr(TITLES[t])}</h1>

      {/* 443:62 type tabs — switching type goes back to 이용동의 for that type (consent is per type). */}
      <nav className={styles.typeTabs} aria-label={tr("studioSettlementForm.memberTypeAria")}>
        {MEMBER_TYPES.map((m) => (
          <Link key={m.key} href={`/creator/settlement/register?type=${m.key}`} className={styles.typeTab} aria-current={m.key === t ? "page" : undefined}>
            {tr(MEMBER_TYPE_FORM_KEY[m.key])}
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
            <FormCard title={tr("studioSettlementForm.cardIdentity")}>
              <TaxBar value="개인 (사업소득)" />
              <Field label={tr("studioSettlementForm.name")} helper={SAME_AS_ACCOUNT} htmlFor="st-name">
                <TextInput id="st-name" name="name" maxLength={40} placeholder={tr("studioSettlementForm.namePlaceholder")} />
              </Field>
              <IdNumberField label={tr("studioSettlementForm.residentNo")} frontHint={tr("studioSettlementForm.front6")} backHint={tr("studioSettlementForm.back7")} />
              {phoneField}
            </FormCard>
            {bankCard(tr("studioSettlementForm.holderHelpIndividual"), tr("studioSettlementForm.holderPlaceholder"), tr("studioSettlementForm.fallbackIndividual"))}
            <FormCard title={tr("studioSettlementForm.cardExtra")}>
              {emailField}
              {addressField}
              {channelField}
            </FormCard>
            <FormCard title={tr("studioSettlementForm.cardFiles")}>
              {upload("idCopy", tr("studioSettlementForm.idCopy"), tr("studioSettlementForm.idCopyTarget"), tr("studioSettlementForm.idCopyHelp"), tr("studioSettlementForm.idCopyGuide"))}
              {upload("bankCopy", tr("studioSettlementForm.bankCopy"), tr("studioSettlementForm.bankCopyTarget"), tr("studioSettlementForm.bankCopyHelp"), tr("studioSettlementForm.bankCopyGuide"))}
            </FormCard>
          </>
        )}

        {t === "FOREIGN_RESIDENT" && (
          <>
            <FormCard title={tr("studioSettlementForm.cardContractor")}>
              <TaxBar value="개인 (사업소득, 대한민국 거주 외국인)" />
              <Field label={tr("studioSettlementForm.name")} helper={SAME_AS_ACCOUNT} htmlFor="st-name">
                <TextInput id="st-name" name="name" maxLength={40} placeholder={tr("studioSettlementForm.nameForeignPlaceholder")} />
              </Field>
              <IdNumberField label={tr("studioSettlementForm.foreignNo")} frontHint={tr("studioSettlementForm.front6Example")} backHint={tr("studioSettlementForm.back7Example")} />
            </FormCard>
            {bankCard(tr("studioSettlementForm.holderHelpForeign"), tr("studioSettlementForm.holderPlaceholder"), tr("studioSettlementForm.fallbackForeign"))}
            <FormCard title={tr("studioSettlementForm.cardExtra")}>
              <div className={styles.pair}>
                <Field label={tr("studioSettlementForm.nationality")} htmlFor="st-nation">
                  <Select id="st-nation" name="nationality" options={NATIONALITIES} placeholder={tr("studioSettlementForm.selectPlaceholder")} />
                </Field>
                <Field label={tr("studioSettlementForm.visa")} htmlFor="st-visa">
                  <Select id="st-visa" name="visa" options={VISA_TYPES} placeholder={tr("studioSettlementForm.selectPlaceholder")} />
                </Field>
              </div>
              {phoneField}
              {emailField}
              {addressField}
              {channelField}
            </FormCard>
            <FormCard title={tr("studioSettlementForm.cardFiles")}>
              {upload("foreignIdCopy", tr("studioSettlementForm.foreignIdCopy"), tr("studioSettlementForm.foreignIdCopyTarget"), tr("studioSettlementForm.foreignIdCopyHelp"), tr("studioSettlementForm.foreignIdCopyGuide"))}
              {upload("bankCopy", tr("studioSettlementForm.bankCopy"), tr("studioSettlementForm.bankCopyTargetForeign"), tr("studioSettlementForm.bankCopyHelpOwn"), tr("studioSettlementForm.bankCopyGuide"))}
            </FormCard>
          </>
        )}

        {t === "SOLE_PROPRIETOR" && (
          <>
            <FormCard title={tr("studioSettlementForm.cardIdentity")}>
              <TaxBar value="개인사업자" />
              {bizNoField}
              <Field label={tr("studioSettlementForm.taxExempt")} helper="1인 미디어 콘텐츠 창작자(940306) 만 비과세 대상입니다." htmlFor="st-exempt">
                <Select id="st-exempt" name="taxExempt" options={TAX_EXEMPT_OPTIONS} defaultValue="과세사업자" />
              </Field>
              <Field label={tr("studioSettlementForm.ceoName")} helper={SAME_AS_ACCOUNT} htmlFor="st-ceo">
                <TextInput id="st-ceo" name="ceoName" maxLength={40} placeholder={tr("studioSettlementForm.ceoPlaceholder")} />
              </Field>
            </FormCard>
            {bankCard(tr("studioSettlementForm.holderHelpSole"), tr("studioSettlementForm.holderPlaceholderShort"), tr("studioSettlementForm.fallbackSole"))}
            <FormCard title={tr("studioSettlementForm.cardExtra")}>
              <Field label={tr("studioSettlementForm.companyName")} htmlFor="st-company">
                <TextInput id="st-company" name="companyName" maxLength={60} placeholder={tr("studioSettlementForm.companyPlaceholder")} />
              </Field>
              {bizKindField}
              {phoneField}
              {emailField}
              {addressField}
              {channelField}
            </FormCard>
            <FormCard title={tr("studioSettlementForm.cardFiles")}>
              {upload("bizLicense", tr("studioSettlementForm.bizLicense"), tr("studioSettlementForm.bizLicenseTarget"), tr("studioSettlementForm.bizLicenseHelp"))}
              {upload("bankCopy", tr("studioSettlementForm.bankCopy"), tr("studioSettlementForm.bankCopyTarget"), tr("studioSettlementForm.bankCopyHelp"))}
            </FormCard>
          </>
        )}

        {t === "CORPORATION" && (
          <>
            <FormCard title={tr("studioSettlementForm.cardBusiness")}>
              <Field label={tr("studioSettlementForm.taxType")} htmlFor="st-corp-type">
                <Select id="st-corp-type" name="corpTaxType" options={CORP_TAX_TYPES} defaultValue="법인 사업자" />
              </Field>
              {bizNoField}
              <Field label={tr("studioSettlementForm.companyName")} helper={SAME_AS_ACCOUNT} htmlFor="st-company">
                <TextInput id="st-company" name="companyName" maxLength={60} placeholder={tr("studioSettlementForm.companyPlaceholder")} />
              </Field>
            </FormCard>
            {bankCard(SAME_AS_ACCOUNT, tr("studioSettlementForm.holderPlaceholderShort"), tr("studioSettlementForm.fallbackCorporation"))}
            <FormCard title={tr("studioSettlementForm.cardExtra")}>
              {bizKindField}
              <Field label={tr("studioSettlementForm.ceoName")} htmlFor="st-ceo">
                <TextInput id="st-ceo" name="ceoName" maxLength={40} placeholder={tr("studioSettlementForm.ceoPlaceholderShort")} />
              </Field>
              {phoneField}
              {emailField}
              {addressField}
              {channelField}
            </FormCard>
            <FormCard title={tr("studioSettlementForm.cardManager")}>
              <div className={styles.pair}>
                <Field label={tr("studioSettlementForm.name")} htmlFor="st-manager">
                  <TextInput id="st-manager" name="managerName" maxLength={40} placeholder={tr("studioSettlementForm.name")} />
                </Field>
                <Field label={tr("studioSettlementForm.managerPosition")} htmlFor="st-manager-title">
                  <TextInput id="st-manager-title" name="managerTitle" maxLength={40} placeholder={tr("studioSettlementForm.managerPosition")} />
                </Field>
              </div>
              <Field label={tr("studioSettlementForm.phone")} group>
                <PhoneInputs prefix="managerPhone" label={tr("studioSettlementForm.managerPhone")} />
              </Field>
              <Field label={tr("studioSettlementForm.email")} group>
                <EmailInputs prefix="managerEmail" label={tr("studioSettlementForm.managerEmail")} />
              </Field>
            </FormCard>
            <FormCard title={tr("studioSettlementForm.cardFiles")}>
              {upload("bizLicense", tr("studioSettlementForm.bizLicense"), tr("studioSettlementForm.bizLicenseTarget"))}
              {upload("bankCopy", tr("studioSettlementForm.bankCopy"), tr("studioSettlementForm.bankCopyTarget"), undefined, tr("studioSettlementForm.bankCopyGuide"))}
              {upload("accountForm", tr("studioSettlementForm.accountForm"), tr("studioSettlementForm.accountFormTarget"), undefined, tr("studioSettlementForm.accountFormGuide"))}
              {upload("corpSeal", tr("studioSettlementForm.corpSeal"), tr("studioSettlementForm.corpSealTarget"), tr("studioSettlementForm.corpSealHelp"))}
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
            {tr("studioSettlementForm.back")}
          </Link>
          <button type="submit" className={styles.submit} disabled={pending} aria-busy={pending || undefined}>
            {pending ? tr("studioSettlementForm.submitting") : t === "CORPORATION" ? tr("studioSettlementForm.submitCorporation") : tr("studioSettlementForm.submit")}
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
  const { t } = useI18n();
  return (
    <span className={`${styles.selectWrap} ${styles.channelSelect}`}>
      <select name="channelPlatform" className={styles.select} required defaultValue="YOUTUBE" aria-label={t("studioSettlementForm.platform")}>
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

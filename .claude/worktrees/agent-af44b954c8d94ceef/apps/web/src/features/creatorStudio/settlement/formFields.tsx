"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { ChevronDownSmallIcon, UploadIcon } from "@/components/icons";
import { EMAIL_DOMAINS, PHONE_PREFIXES, SETTLEMENT_FILE_MAX_BYTES, SETTLEMENT_FILE_TYPES } from "@/services/creator/settlementTypes";
import styles from "./registration.module.css";

/** Building blocks of the 정산 자료 등록 form cards (Figma 443:91 spec). */

export function FormCard({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className={styles.card} aria-labelledby={id}>
      <h2 id={id} className={styles.cardTitle}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function TaxBar({ value }: { value: string }) {
  return (
    <p className={styles.taxBar}>
      <span className={styles.taxLabel}>과세 유형</span>
      <span className={styles.taxDivider} aria-hidden="true" />
      <span className={styles.taxValue}>{value}</span>
    </p>
  );
}

type FieldProps = { label: string; helper?: string; htmlFor?: string; group?: boolean; children: ReactNode };

/** Label (+ red *) and helper above the control. `group` renders a fieldset for multi-input rows. */
export function Field({ label, helper, htmlFor, group, children }: FieldProps) {
  const head = (
    <>
      <span className={styles.label}>
        {label}
        <span className={styles.required} aria-hidden="true">
          {" "}
          *
        </span>
      </span>
      {helper && <span className={styles.helper}>{helper}</span>}
    </>
  );
  if (group) {
    return (
      <fieldset className={styles.field}>
        <legend className={styles.fieldHead}>{head}</legend>
        {children}
      </fieldset>
    );
  }
  return (
    <div className={styles.field}>
      <label className={styles.fieldHead} htmlFor={htmlFor}>
        {head}
      </label>
      {children}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={styles.input} required autoComplete="off" {...props} />;
}

export function Select({ options, placeholder, className, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: readonly string[]; placeholder?: string }) {
  return (
    <span className={`${styles.selectWrap} ${className ?? ""}`}>
      <select className={styles.select} required {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDownSmallIcon className={styles.selectChevron} aria-hidden="true" />
    </span>
  );
}

export function PhoneInputs({ prefix, label }: { prefix: string; label: string }) {
  return (
    <span className={styles.row}>
      <Select name={`${prefix}Prefix`} options={PHONE_PREFIXES} defaultValue="010" aria-label={`${label} 앞자리`} className={styles.phonePrefix} />
      <span className={styles.dash} aria-hidden="true">
        -
      </span>
      <TextInput name={`${prefix}Mid`} inputMode="numeric" maxLength={4} pattern="\d{3,4}" placeholder="0000" aria-label={`${label} 가운데 자리`} />
      <span className={styles.dash} aria-hidden="true">
        -
      </span>
      <TextInput name={`${prefix}Last`} inputMode="numeric" maxLength={4} pattern="\d{4}" placeholder="0000" aria-label={`${label} 끝자리`} />
    </span>
  );
}

/** username @ domain + 직접입력 dropdown (443:5). Picking a domain fills the domain input. */
export function EmailInputs({ prefix, label }: { prefix: string; label: string }) {
  const [domain, setDomain] = useState<string>(EMAIL_DOMAINS[0]);
  return (
    <span className={styles.row}>
      <TextInput name={`${prefix}Local`} placeholder="username" maxLength={64} aria-label={`${label} 아이디`} />
      <span className={styles.dash} aria-hidden="true">
        @
      </span>
      <TextInput name={`${prefix}Domain`} value={domain} onChange={(e) => setDomain(e.target.value)} maxLength={60} aria-label={`${label} 도메인`} />
      <Select
        options={EMAIL_DOMAINS}
        placeholder="직접입력"
        value={(EMAIL_DOMAINS as readonly string[]).includes(domain) ? domain : ""}
        onChange={(e) => setDomain(e.target.value)}
        required={false}
        aria-label={`${label} 도메인 선택`}
        className={styles.domainSelect}
      />
    </span>
  );
}

/**
 * 주소 + 주소 검색 (443:5). No address-search provider is chosen yet (TBD), so the base address is
 * typed directly; the button explains that.
 */
export function AddressInputs({ onSearch }: { onSearch: () => void }) {
  return (
    <span className={styles.stack}>
      <span className={styles.row}>
        <TextInput name="addressBase" placeholder="우편번호 및 기본 주소를 검색해 주세요" maxLength={150} aria-label="기본 주소" />
        <button type="button" className={styles.inlineButton} onClick={onSearch}>
          주소 검색
        </button>
      </span>
      <TextInput name="addressDetail" placeholder="상세 주소를 입력해 주세요" maxLength={50} required={false} aria-label="상세 주소" />
    </span>
  );
}

type UploadProps = { name: string; label: string; helper?: string; guide?: string; target: string; onInvalid: (msg: string) => void };

/** Drop zone (443:5): click or drag a file. Checks type and size before upload; the server re-checks. */
export function UploadField({ name, label, helper, guide, target, onInvalid }: UploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const id = useId();

  const accept = (files: FileList | null) => {
    const file = files?.[0];
    const input = inputRef.current;
    if (!file || !input) return;
    if (!(SETTLEMENT_FILE_TYPES as readonly string[]).includes(file.type)) {
      onInvalid("JPG, PNG, PDF 파일만 업로드할 수 있어요.");
      input.value = "";
      setFileName(null);
      return;
    }
    if (file.size > SETTLEMENT_FILE_MAX_BYTES) {
      onInvalid("파일은 5MB 이하만 업로드할 수 있어요.");
      input.value = "";
      setFileName(null);
      return;
    }
    if (input.files !== files) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
    }
    setFileName(file.name);
  };

  return (
    <div className={styles.field}>
      <label className={styles.fieldHead} htmlFor={id}>
        <span className={styles.label}>
          {label}
          <span className={styles.required} aria-hidden="true">
            {" "}
            *
          </span>
        </span>
        {helper && <span className={styles.helper}>{helper}</span>}
      </label>
      <div
        className={styles.drop}
        data-drag={drag || undefined}
        data-filled={fileName ? true : undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          accept(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
      >
        <span className={styles.dropIcon} aria-hidden="true">
          <UploadIcon />
        </span>
        <span className={styles.dropText}>{fileName ?? `클릭하거나 파일을 드래그하여 ${target} 업로드 하세요`}</span>
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="file"
          accept={SETTLEMENT_FILE_TYPES.join(",")}
          className={styles.fileInput}
          onChange={(e) => accept(e.target.files)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      {guide && (
        // Guide pages are not designed yet (TBD); shown as the design's label only.
        <span className={styles.guide} title="준비 중인 안내입니다">
          {guide} ›
        </span>
      )}
    </div>
  );
}

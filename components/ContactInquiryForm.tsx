"use client";

import { ContactFields } from "@/components/ContactFields";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  submitContactInquiry,
  type ContactInquiryActionState,
  type ContactInquiryFormValues,
} from "@/app/actions/contact-inquiry";
import {
  CONTACT_CALLBACK_CHANNELS,
  CONTACT_CALLBACK_LABELS,
  CONTACT_TOPICS,
  CONTACT_TOPIC_LABELS,
} from "@/lib/contact-inquiry-types";
import { getPublicContact } from "@/lib/public-contact";
import { site } from "@/lib/site";
import { trackEvent } from "@/lib/analytics";
import { captureFirstPartyAttribution } from "@/lib/attribution";

const initialState: ContactInquiryActionState = { ok: false };

const FIELD =
  "min-h-11 w-full rounded-xl border border-forest/20 bg-paper px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass";

function fieldError(
  fieldErrors: Record<string, string[]> | undefined,
  name: string,
): string | undefined {
  return fieldErrors?.[name]?.[0];
}

function successFollowUp(mailSent?: boolean, mailStatus?: string): string {
  if (mailSent || mailStatus === "sent") {
    return "จดหมายตอบรับถูกส่งไปที่อีเมลของท่านแล้ว กรุณาตรวจกล่องจดหมายและโฟลเดอร์สแปม";
  }
  if (mailStatus === "failed") {
    return "บันทึกเรื่องแล้ว แต่จดหมายตอบรับยังส่งไม่ถึง — ทีมงานจะติดต่อกลับทางโทรศัพท์หรืออีเมลในเวลาทำการ";
  }
  return "ทีมงานจะติดต่อกลับตามช่องทางที่ระบุในเวลาทำการ ไม่มีการส่งจดหมายตอบรับอัตโนมัติในครั้งนี้";
}

export function ContactInquiryForm() {
  const [state, formAction, pending] = useActionState(
    submitContactInquiry,
    initialState,
  );
  const [values, setValues] = useState<ContactInquiryFormValues>({
    topic: "inquiry",
    callbackChannel: "email",
  });
  const startedAt = useMemo(() => String(Date.now()), []);
  const [landingPath, setLandingPath] = useState("/contact");
  const [contactAttempted, setContactAttempted] = useState(false);
  const successRef = useRef<HTMLDivElement>(null);
  const contact = getPublicContact(site);

  function val(name: string): string {
    return state.values?.[name] ?? values[name] ?? "";
  }

  useEffect(() => {
    setLandingPath(
      captureFirstPartyAttribution({
        href: window.location.href,
        referrer: document.referrer,
        pageOrigin: window.location.origin,
      }).landingPath || "/contact",
    );
  }, []);

  useEffect(() => {
    if (state.ok && state.inquiryId) {
      const topic = state.values?.topic || values.topic;
      trackEvent("generate_lead", {
        method: "contact_form",
        ...(topic ? { content_type: topic } : {}),
      });
      successRef.current?.focus();
    }
  }, [state.ok, state.inquiryId, state.values?.topic, values.topic]);

  if (state.ok && state.inquiryId) {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-forest/15 bg-forest-mist p-6 text-forest outline-none sm:p-8"
      >
        <p className="text-sm font-semibold uppercase tracking-wide text-brass">
          รับเรื่องแล้ว
        </p>
        <h3 className="mt-2 text-2xl font-bold">ขอบคุณที่ติดต่อเข้ามา</h3>
        <p className="mt-3 text-sm leading-relaxed text-ink/80">
          {successFollowUp(state.mailSent, state.mailStatus)}
        </p>
        <p className="mt-5 rounded-xl bg-paper px-4 py-3 font-mono text-lg font-semibold tracking-wide text-forest">
          {state.inquiryId}
        </p>
        <p className="mt-2 text-xs text-ink/55">
          กรุณาเก็บหมายเลขอ้างอิงนี้ไว้เมื่อติดตามเรื่อง
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {contact.showPhone ? (
            <a
              href={site.phoneHref}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-forest px-5 text-sm font-semibold text-paper"
            >
              โทร {site.phoneDisplay}
            </a>
          ) : null}
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-5 text-sm font-semibold text-forest"
          >
            ขอใบเสนอราคาแทน
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="relative rounded-2xl border border-white/20 bg-paper/90 p-4 shadow-glass backdrop-blur-md sm:p-8 dark:border-white/10"
      onSubmit={() => setContactAttempted(true)}
    >
      <h2 className="text-2xl font-bold text-forest">แบบฟอร์มติดต่อ</h2>
      <p className="mt-2 text-xs text-ink/55">
        กรอกช่องที่มี * ให้ครบ แล้วกดส่ง — ทีมงานติดต่อกลับในเวลาทำการ ไม่มีการชำระเงินในหน้านี้
      </p>

      {state.formError ? (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <p>{state.formError}</p>
          <p className="mt-2 text-xs text-red-700/80">
            ข้อมูลที่กรอกยังอยู่ครบ กดส่งอีกครั้งได้เลย
          </p>
        </div>
      ) : null}

      <input type="hidden" name="startedAt" value={startedAt} />
      <input type="hidden" name="landingPath" value={landingPath} />
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
        <label htmlFor="inquiry-website">เว็บไซต์</label>
        <input id="inquiry-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <fieldset className="mt-6 space-y-2">
        <legend className="text-sm font-medium text-ink">เรื่องที่ต้องการ *</legend>
        <div className="flex flex-wrap gap-2">
          {CONTACT_TOPICS.map((topic) => {
            const selected = val("topic") === topic;
            return (
              <label
                key={topic}
                className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-medium ${
                  selected
                    ? "border-forest bg-forest text-paper"
                    : "border-forest/20 bg-paper text-forest hover:border-forest/40"
                }`}
              >
                <input
                  type="radio"
                  name="topic"
                  value={topic}
                  checked={selected}
                  onChange={() => setValues((prev) => ({ ...prev, topic }))}
                  className="sr-only"
                />
                {CONTACT_TOPIC_LABELS[topic]}
              </label>
            );
          })}
        </div>
        {fieldError(state.fieldErrors, "topic") ? (
          <p className="text-sm text-red-700">{fieldError(state.fieldErrors, "topic")}</p>
        ) : null}
      </fieldset>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="inquiry-name" className="mb-1.5 block text-sm font-medium text-ink">
            ชื่อผู้ติดต่อ *
          </label>
          <input
            id="inquiry-name"
            name="name"
            required
            autoComplete="name"
            value={val("name")}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, name: event.target.value }))
            }
            aria-invalid={Boolean(fieldError(state.fieldErrors, "name"))}
            className={FIELD}
          />
          {fieldError(state.fieldErrors, "name") ? (
            <p className="mt-1 text-sm text-red-700">
              {fieldError(state.fieldErrors, "name")}
            </p>
          ) : null}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="inquiry-company" className="mb-1.5 block text-sm font-medium text-ink">
            บริษัท / หน่วยงาน
          </label>
          <input
            id="inquiry-company"
            name="company"
            autoComplete="organization"
            value={val("company")}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, company: event.target.value }))
            }
            className={FIELD}
          />
        </div>
        <ContactFields
          email={val("email")}
          phone={val("phone")}
          emailError={fieldError(state.fieldErrors, "email")}
          phoneError={fieldError(state.fieldErrors, "phone")}
          forceShow={contactAttempted}
          onChange={(next) => setValues((prev) => ({ ...prev, ...next }))}
        />
      </div>

      <fieldset className="mt-5 space-y-2">
        <legend className="text-sm font-medium text-ink">ช่องทางให้ติดต่อกลับ *</legend>
        <div className="flex flex-col gap-2">
          {CONTACT_CALLBACK_CHANNELS.map((channel) => {
            const selected = val("callbackChannel") === channel;
            return (
              <label
                key={channel}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm ${
                  selected
                    ? "border-forest bg-forest-mist text-forest"
                    : "border-forest/15 bg-paper text-ink hover:border-forest/40"
                }`}
              >
                <input
                  type="radio"
                  name="callbackChannel"
                  value={channel}
                  checked={selected}
                  onChange={() =>
                    setValues((prev) => ({ ...prev, callbackChannel: channel }))
                  }
                  className="h-4 w-4 accent-forest"
                />
                <span>
                  {CONTACT_CALLBACK_LABELS[channel]}
                  {channel === "email" || channel === "both" ? (
                    <span className="ml-1 text-xs font-normal text-ink/55">
                      — ส่งจดหมายตอบรับไปที่อีเมล
                    </span>
                  ) : (
                    <span className="ml-1 text-xs font-normal text-ink/55">
                      — ทีมจะโทรกลับ ไม่ส่งจดหมายอัตโนมัติ
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5">
        <label htmlFor="inquiry-message" className="mb-1.5 block text-sm font-medium text-ink">
          รายละเอียด *
        </label>
        <textarea
          id="inquiry-message"
          name="message"
          required
          minLength={8}
          rows={6}
          value={val("message")}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, message: event.target.value }))
          }
          className="w-full rounded-xl border border-forest/20 bg-paper px-3 py-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          placeholder="บอกสิ่งที่ต้องการสอบถาม ร้องเรียน หรือให้เราติดต่อกลับ"
        />
        {fieldError(state.fieldErrors, "message") ? (
          <p className="mt-1 text-sm text-red-700">
            {fieldError(state.fieldErrors, "message")}
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex items-start gap-3">
        <input
          id="inquiry-consent"
          name="consent"
          type="checkbox"
          value="true"
          required
          defaultChecked={val("consent") === "true"}
          className="mt-1 h-5 w-5 rounded border-forest/30 text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        />
        <label htmlFor="inquiry-consent" className="text-sm text-ink/85">
          ยินยอมให้ติดต่อกลับทางอีเมลหรือโทรศัพท์ และรับทราบ{" "}
          <Link
            href="/privacy"
            className="font-semibold text-forest underline-offset-2 hover:underline"
          >
            นโยบายความเป็นส่วนตัว
          </Link>{" "}
          *
        </label>
      </div>
      {fieldError(state.fieldErrors, "consent") ? (
        <p className="mt-1 text-sm text-red-700">
          {fieldError(state.fieldErrors, "consent")}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-forest px-6 text-sm font-semibold text-paper disabled:opacity-60"
      >
        {pending ? "กำลังส่ง…" : "ส่งข้อความ"}
      </button>
      <p className="mt-3 text-xs text-ink/55">
        ฟอร์มนี้ไม่ใช่ใบเสนอราคาและไม่มีการชำระเงิน หากต้องการสั่งผลิต ให้ใช้แท็บขอใบเสนอราคา
      </p>
    </form>
  );
}

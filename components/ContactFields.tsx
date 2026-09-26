"use client";

import {
  emailFieldError,
  isValidEmail,
  isValidThaiPhone,
  phoneFieldError,
} from "@/lib/contact-validate";
import {
  EMAIL_FORMAT_HINT,
  PHONE_FORMAT_HINT,
} from "@/lib/ux-copy";
import { useState } from "react";

type ContactFieldsProps = {
  email: string;
  phone: string;
  emailError?: string;
  phoneError?: string;
  forceShow?: boolean;
  onChange: (next: { email?: string; phone?: string }) => void;
};

export function ContactFields({
  email,
  phone,
  emailError,
  phoneError,
  forceShow = false,
  onChange,
}: ContactFieldsProps) {
  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);

  const liveEmail = emailFieldError(email);
  const livePhone = phoneFieldError(phone);
  const showEmail = forceShow || emailTouched || Boolean(emailError);
  const showPhone = forceShow || phoneTouched || Boolean(phoneError);
  const emailOk = Boolean(email.trim()) && isValidEmail(email);
  const phoneOk = Boolean(phone.trim()) && isValidThaiPhone(phone);
  const emailMessage = showEmail ? liveEmail || (emailOk ? "" : emailError || "") : "";
  const phoneMessage = showPhone ? livePhone || (phoneOk ? "" : phoneError || "") : "";

  return (
    <>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink">
          อีเมล *
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => onChange({ email: event.target.value })}
          onBlur={() => setEmailTouched(true)}
          className="min-h-11 w-full rounded-xl border border-forest/20 bg-paper px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          aria-invalid={Boolean(emailMessage)}
          aria-describedby={emailMessage ? "email-error" : "email-hint"}
        />
        <p id="email-hint" className="mt-1 text-xs text-ink/55">
          {EMAIL_FORMAT_HINT}
        </p>
        {emailMessage ? (
          <p id="email-error" className="mt-1 text-sm text-red-700">
            {emailMessage}
          </p>
        ) : showEmail && emailOk ? (
          <p className="mt-1 text-sm text-forest">อีเมลถูกต้อง</p>
        ) : null}
      </div>
      <div>
        <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-ink">
          เบอร์โทร *
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          inputMode="tel"
          value={phone}
          onChange={(event) => onChange({ phone: event.target.value })}
          onBlur={() => setPhoneTouched(true)}
          className="min-h-11 w-full rounded-xl border border-forest/20 bg-paper px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          aria-invalid={Boolean(phoneMessage)}
          aria-describedby={phoneMessage ? "phone-error" : "phone-hint"}
        />
        <p id="phone-hint" className="mt-1 text-xs text-ink/55">
          {PHONE_FORMAT_HINT}
        </p>
        {phoneMessage ? (
          <p id="phone-error" className="mt-1 text-sm text-red-700">
            {phoneMessage}
          </p>
        ) : showPhone && phoneOk ? (
          <p className="mt-1 text-sm text-forest">เบอร์โทรถูกต้อง</p>
        ) : null}
      </div>
    </>
  );
}

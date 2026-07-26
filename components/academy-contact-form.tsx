"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  BotProtectionFields,
  readHoneypotFromForm,
} from "@/components/bot-protection-fields";
import { FormErrorAlert } from "@/components/form-error-alert";
import { HONEYPOT_FIELD_NAME } from "@/lib/bot-protection-shared";
import { isValidEmail } from "@/lib/validation/email";
import { cn } from "@/lib/utils";

type AcademyContactFormProps = {
  academySlug: string;
  className?: string;
};

type FieldErrors = {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
};

const SUCCESS_COPY =
  "Thanks for getting in touch. We've received your message and will reply as soon as we can.";

export function AcademyContactForm({ academySlug, className }: AcademyContactFormProps) {
  const formId = useId();
  const successRef = useRef<HTMLParagraphElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  useEffect(() => {
    if (!success) return;
    const frame = window.requestAnimationFrame(() => {
      successRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [success]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    const nextErrors: FieldErrors = {};
    if (!name.trim()) nextErrors.name = "Name is required.";
    if (!email.trim()) nextErrors.email = "Email is required.";
    else if (!isValidEmail(email)) nextErrors.email = "Please enter a valid email address.";
    if (!subject.trim()) nextErrors.subject = "Subject is required.";
    if (!message.trim()) nextErrors.message = "Message is required.";

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const form = event.currentTarget as HTMLFormElement;
    const honeypot = readHoneypotFromForm(form);

    setSubmitting(true);
    try {
      const response = await fetch("/api/academy/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academySlug,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          subject: subject.trim(),
          message: message.trim(),
          turnstileToken: turnstileToken || undefined,
          [HONEYPOT_FIELD_NAME]: honeypot,
        }),
      });
      const payload = (await response.json()) as { error?: string; ok?: boolean };
      if (!response.ok) {
        setError(payload.error ?? "Unable to send your message. Please try again.");
        return;
      }
      setName("");
      setEmail("");
      setPhone("");
      setSubject("");
      setMessage("");
      setFieldErrors({});
      setSuccess(true);
    } catch {
      setError("Unable to send your message. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const nameErrorId = `${formId}-name-error`;
  const emailErrorId = `${formId}-email-error`;
  const subjectErrorId = `${formId}-subject-error`;
  const messageErrorId = `${formId}-message-error`;

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("space-y-4", className)}
      noValidate
      aria-labelledby="contact-form-heading"
    >
      <h2 id="contact-form-heading" className="text-xl font-semibold tracking-tight">
        Send a message
      </h2>
      <p className="text-muted text-sm">
        For general questions only. To book a session, use Book Training.
      </p>

      {error ? <FormErrorAlert message={error} /> : null}
      {success ? (
        <p
          ref={successRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 outline-none dark:text-emerald-200"
        >
          {SUCCESS_COPY.split("\n").map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </p>
      ) : null}

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Name</span>
        <input
          name="name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (fieldErrors.name) setFieldErrors((current) => ({ ...current, name: undefined }));
          }}
          autoComplete="name"
          required
          aria-invalid={fieldErrors.name ? true : undefined}
          aria-describedby={fieldErrors.name ? nameErrorId : undefined}
          className="border-border bg-background focus-visible:ring-accent/40 min-h-12 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
        />
        {fieldErrors.name ? (
          <span id={nameErrorId} className="block text-sm text-rose-700 dark:text-rose-300">
            {fieldErrors.name}
          </span>
        ) : null}
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Email</span>
        <input
          type="email"
          name="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: undefined }));
          }}
          autoComplete="email"
          required
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? emailErrorId : undefined}
          className="border-border bg-background focus-visible:ring-accent/40 min-h-12 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
        />
        {fieldErrors.email ? (
          <span id={emailErrorId} className="block text-sm text-rose-700 dark:text-rose-300">
            {fieldErrors.email}
          </span>
        ) : null}
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Phone (optional)</span>
        <input
          type="tel"
          name="phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          autoComplete="tel"
          className="border-border bg-background focus-visible:ring-accent/40 min-h-12 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Subject</span>
        <input
          name="subject"
          value={subject}
          onChange={(event) => {
            setSubject(event.target.value);
            if (fieldErrors.subject) {
              setFieldErrors((current) => ({ ...current, subject: undefined }));
            }
          }}
          required
          aria-invalid={fieldErrors.subject ? true : undefined}
          aria-describedby={fieldErrors.subject ? subjectErrorId : undefined}
          className="border-border bg-background focus-visible:ring-accent/40 min-h-12 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
        />
        {fieldErrors.subject ? (
          <span id={subjectErrorId} className="block text-sm text-rose-700 dark:text-rose-300">
            {fieldErrors.subject}
          </span>
        ) : null}
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Message</span>
        <textarea
          name="message"
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            if (fieldErrors.message) {
              setFieldErrors((current) => ({ ...current, message: undefined }));
            }
          }}
          rows={6}
          required
          aria-invalid={fieldErrors.message ? true : undefined}
          aria-describedby={fieldErrors.message ? messageErrorId : undefined}
          className="border-border bg-background focus-visible:ring-accent/40 w-full rounded-xl border px-3 py-3 text-sm leading-relaxed outline-none focus-visible:ring-2"
        />
        {fieldErrors.message ? (
          <span id={messageErrorId} className="block text-sm text-rose-700 dark:text-rose-300">
            {fieldErrors.message}
          </span>
        ) : null}
      </label>

      <div className="relative">
        <BotProtectionFields onTurnstileToken={setTurnstileToken} />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="bg-accent text-accent-foreground hover:opacity-90 focus-visible:ring-accent/40 inline-flex min-h-12 w-full items-center justify-center rounded-full px-6 text-sm font-semibold transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 sm:w-auto"
      >
        {submitting ? "Sending…" : "Submit"}
      </button>
    </form>
  );
}

"use client";

import { FormEvent, useRef, useState } from "react";
import RichTextEditor from "@/components/RichTextEditor";
import { validateEmailList, validateFromDomain } from "@/lib/email-utils";

type AttachmentFile = {
  id: string;
  file: File;
};

type SendStatus =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; message: string; emailId?: string }
  | { type: "error"; message: string };

const MAX_ATTACHMENT_SIZE = 40 * 1024 * 1024;
const ALLOWED_FROM_DOMAIN =
  process.env.NEXT_PUBLIC_ALLOWED_FROM_DOMAIN?.trim() || "";

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition focus:border-[var(--accent)] focus:bg-[var(--input-focus-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)]";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Label({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]"
    >
      {children}
    </label>
  );
}

export default function EmailComposer() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fromEmail, setFromEmail] = useState(
    process.env.NEXT_PUBLIC_DEFAULT_FROM_EMAIL || "",
  );
  const [fromName, setFromName] = useState("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("<p></p>");
  const [plainText, setPlainText] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [status, setStatus] = useState<SendStatus>({ type: "idle" });

  const totalAttachmentSize = attachments.reduce(
    (sum, item) => sum + item.file.size,
    0,
  );

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const nextFiles = Array.from(files).map((file) => ({
      id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
      file,
    }));

    const newTotal =
      totalAttachmentSize + nextFiles.reduce((sum, f) => sum + f.file.size, 0);

    if (newTotal > MAX_ATTACHMENT_SIZE) {
      setStatus({
        type: "error",
        message: "Total attachment size cannot exceed 40MB.",
      });
      return;
    }

    setAttachments((prev) => [...prev, ...nextFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus({ type: "loading" });

    const validationErrors = [
      validateEmailList(fromEmail, "from"),
      validateFromDomain(fromEmail, ALLOWED_FROM_DOMAIN),
      validateEmailList(to, "To"),
      validateEmailList(cc, "CC"),
      validateEmailList(bcc, "BCC"),
      validateEmailList(replyTo, "Reply-To"),
    ].filter(Boolean);

    if (validationErrors.length > 0) {
      setStatus({ type: "error", message: validationErrors[0]! });
      return;
    }

    if (!fromEmail.trim() || !to.trim() || !subject.trim()) {
      setStatus({
        type: "error",
        message: "From, To, and Subject are required.",
      });
      return;
    }

    const bodyText = htmlBody.replace(/<[^>]*>/g, "").trim();
    if (!bodyText) {
      setStatus({ type: "error", message: "Email body cannot be empty." });
      return;
    }

    try {
      const encodedAttachments = await Promise.all(
        attachments.map(async (item) => ({
          filename: item.file.name,
          content: await fileToBase64(item.file),
          contentType: item.file.type || undefined,
        })),
      );

      const response = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromEmail,
          fromName,
          to,
          cc,
          bcc,
          replyTo,
          subject,
          html: htmlBody,
          text: plainText.trim() || undefined,
          scheduledAt: scheduledAt
            ? new Date(scheduledAt).toISOString()
            : undefined,
          attachments: encodedAttachments,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus({
          type: "error",
          message: data.error || "Failed to send email.",
        });
        return;
      }

      setStatus({
        type: "success",
        message: data.message,
        emailId: data.id,
      });
    } catch {
      setStatus({
        type: "error",
        message: "Network error. Please try again.",
      });
    }
  };

  const resetForm = () => {
    setTo("");
    setCc("");
    setBcc("");
    setReplyTo("");
    setSubject("");
    setHtmlBody("<p></p>");
    setPlainText("");
    setScheduledAt("");
    setAttachments([]);
    setShowCcBcc(false);
    setShowAdvanced(false);
    setStatus({ type: "idle" });
  };

  return (
    <div className="compose-card overflow-hidden rounded-2xl border">
      <div className="h-1 bg-gradient-to-r from-[var(--accent)] via-indigo-500 to-violet-500" />

      <form onSubmit={handleSubmit}>
        <div className="space-y-5 p-6 sm:p-8">
          {/* From */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="fromEmail">From</Label>
              <input
                id="fromEmail"
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder={
                  ALLOWED_FROM_DOMAIN
                    ? `you@${ALLOWED_FROM_DOMAIN}`
                    : "you@yourdomain.com"
                }
                required
                className={inputClass}
              />
              {ALLOWED_FROM_DOMAIN && (
                <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                  Only @{ALLOWED_FROM_DOMAIN} addresses are allowed
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="fromName">Display name</Label>
              <input
                id="fromName"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Your name or company"
                className={inputClass}
              />
            </div>
          </div>

          {/* Recipients */}
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <Label htmlFor="to">To</Label>
                {!showCcBcc && (
                  <button
                    type="button"
                    onClick={() => setShowCcBcc(true)}
                    className="text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
                  >
                    + Cc / Bcc
                  </button>
                )}
              </div>
              <input
                id="to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@example.com"
                required
                className={inputClass}
              />
            </div>

            {showCcBcc && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="cc">Cc</Label>
                  <input
                    id="cc"
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    placeholder="cc@example.com"
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label htmlFor="bcc">Bcc</Label>
                  <input
                    id="bcc"
                    value={bcc}
                    onChange={(e) => setBcc(e.target.value)}
                    placeholder="bcc@example.com"
                    className={inputClass}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Subject */}
          <div>
            <Label htmlFor="subject">Subject</Label>
            <input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What's this email about?"
              required
              className={inputClass}
            />
          </div>

          {/* Body */}
          <div>
            <Label>Message</Label>
            <RichTextEditor value={htmlBody} onChange={setHtmlBody} />
          </div>

          {/* Attachments */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />

            {attachments.length === 0 ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFileSelect(e.dataTransfer.files);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--dropzone-border)] bg-[var(--dropzone-bg)] px-4 py-5 text-sm text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:bg-[var(--dropzone-hover-bg)] hover:text-[var(--accent)]"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
                Drop files here or click to attach
              </button>
            ) : (
              <div className="space-y-2">
                <ul className="space-y-2">
                  {attachments.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3.5 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--surface-elevated)] text-[var(--accent)] shadow-sm ring-1 ring-[var(--border)]">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                            {item.file.name}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {formatFileSize(item.file.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(item.id)}
                        className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-red-400"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>
                    {formatFileSize(totalAttachmentSize)} of 40 MB used
                  </span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
                  >
                    + Add more
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Advanced */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <svg
                className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              {showAdvanced ? "Hide" : "Show"} advanced options
            </button>

            {showAdvanced && (
              <div className="mt-4 grid gap-4 rounded-xl bg-[var(--panel-bg)] p-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="replyTo">Reply-To</Label>
                  <input
                    id="replyTo"
                    value={replyTo}
                    onChange={(e) => setReplyTo(e.target.value)}
                    placeholder="replies@example.com"
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="plainText">Plain text fallback</Label>
                  <textarea
                    id="plainText"
                    value={plainText}
                    onChange={(e) => setPlainText(e.target.value)}
                    rows={3}
                    placeholder="Optional plain-text version for older clients"
                    className={`${inputClass} resize-none`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="scheduledAt">Schedule send</Label>
                  <input
                    id="scheduledAt"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Status */}
          {status.type === "error" && (
            <div className="flex items-start gap-2.5 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-text)]">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {status.message}
            </div>
          )}

          {status.type === "success" && (
            <div className="flex items-start gap-2.5 rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success-text)]">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium">{status.message}</p>
                {status.emailId && (
                  <p className="mt-0.5 text-xs text-[var(--success-subtext)]">
                    ID: {status.emailId}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--footer-bg)] px-6 py-4 sm:px-8">
          <button
            type="button"
            onClick={resetForm}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          >
            Discard
          </button>
          <button
            type="submit"
            disabled={status.type === "loading"}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-[var(--accent-glow)] transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status.type === "loading" ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Sending…
              </>
            ) : scheduledAt ? (
              "Schedule email"
            ) : (
              <>
                Send email
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

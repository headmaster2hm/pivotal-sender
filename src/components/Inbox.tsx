"use client";

import { useCallback, useEffect, useState } from "react";
import RichTextEditor from "@/components/RichTextEditor";
import { formatDateTime } from "@/lib/email-history";
import { parseEmailAddress } from "@/lib/email-utils";
import {
  type InboxDetail,
  type InboxItem,
  type InboxListResponse,
  type InboxSetupStatus,
  formatFileSize,
  replySubject,
} from "@/lib/inbox";

function ListItem({
  email,
  selected,
  onSelect,
}: {
  email: InboxItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const attachmentCount = email.attachments?.length ?? 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full border-b border-[var(--border)] px-4 py-3 text-left transition ${
        selected
          ? "bg-[var(--accent)]/10"
          : "hover:bg-[var(--surface-hover)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
          {parseEmailAddress(email.from)}
        </p>
        <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
          {formatDateTime(email.created_at)}
        </span>
      </div>
      <p className="mt-1 truncate text-sm text-[var(--text-primary)]">
        {email.subject || "(No subject)"}
      </p>
      {attachmentCount > 0 && (
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {attachmentCount} attachment{attachmentCount > 1 ? "s" : ""}
        </p>
      )}
    </button>
  );
}

function MessageBody({ detail }: { detail: InboxDetail }) {
  if (detail.html) {
    return (
      <div
        className="prose prose-sm max-w-none text-[var(--text-primary)] dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: detail.html }}
      />
    );
  }

  if (detail.text) {
    return (
      <pre className="whitespace-pre-wrap font-sans text-sm text-[var(--text-primary)]">
        {detail.text}
      </pre>
    );
  }

  return (
    <p className="text-sm text-[var(--text-muted)]">No message content.</p>
  );
}

export default function Inbox() {
  const [emails, setEmails] = useState<InboxItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InboxDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [setupStatus, setSetupStatus] = useState<InboxSetupStatus | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyHtml, setReplyHtml] = useState("<p></p>");
  const [replyStatus, setReplyStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const inboxDomain =
    process.env.NEXT_PUBLIC_ALLOWED_FROM_DOMAIN?.trim() || "";

  const fetchInbox = useCallback(async (after?: string) => {
    const params = new URLSearchParams({ limit: "20" });
    if (after) params.set("after", after);

    const response = await fetch(`/api/inbox?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to load inbox");
    }

    return data as InboxListResponse;
  }, []);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [inboxData, statusResponse] = await Promise.all([
        fetchInbox(),
        fetch("/api/inbox/status").then((res) => res.json()),
      ]);

      setEmails(inboxData.emails);
      setHasMore(inboxData.has_more);
      setSetupStatus(statusResponse as InboxSetupStatus);

      if (
        selectedId &&
        !inboxData.emails.some((email) => email.id === selectedId)
      ) {
        setSelectedId(null);
        setDetail(null);
        setReplyOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }, [fetchInbox, selectedId]);

  useEffect(() => {
    loadInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = async () => {
    if (!hasMore || loadingMore || emails.length === 0) return;

    setLoadingMore(true);
    try {
      const lastId = emails[emails.length - 1]?.id;
      const data = await fetchInbox(lastId);
      setEmails((prev) => [...prev, ...data.emails]);
      setHasMore(data.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more emails");
    } finally {
      setLoadingMore(false);
    }
  };

  const openEmail = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setReplyOpen(false);
    setReplyStatus("idle");
    setReplyError(null);
    setDetailLoading(true);

    try {
      const response = await fetch(`/api/inbox/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load email");
      }

      setDetail(data.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load email");
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm("Remove this message from your inbox?")) return;

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/inbox/${selectedId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete message");
      }

      setEmails((prev) => prev.filter((email) => email.id !== selectedId));
      setSelectedId(null);
      setDetail(null);
      setReplyOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete message");
    } finally {
      setDeleting(false);
    }
  };

  const handleReply = async () => {
    if (!selectedId || !detail) return;

    const bodyText = replyHtml.replace(/<[^>]*>/g, "").trim();
    if (!bodyText) {
      setReplyError("Write a reply before sending.");
      return;
    }

    setReplyStatus("sending");
    setReplyError(null);

    try {
      const response = await fetch(`/api/inbox/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: replyHtml }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send reply");
      }

      setReplyStatus("sent");
      setReplyOpen(false);
      setReplyHtml("<p></p>");
    } catch (err) {
      setReplyStatus("error");
      setReplyError(err instanceof Error ? err.message : "Failed to send reply");
    }
  };

  const startReply = () => {
    if (!detail) return;
    setReplyOpen(true);
    setReplyStatus("idle");
    setReplyError(null);
    setReplyHtml("<p></p>");
  };

  const replyFrom =
    detail?.to.find((address) =>
      address.toLowerCase().includes(`@${inboxDomain}`),
    ) || process.env.NEXT_PUBLIC_DEFAULT_FROM_EMAIL;

  return (
    <div className="compose-card overflow-hidden rounded-2xl border">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
        <div>
          <h2 className="font-semibold text-[var(--text-primary)]">Inbox</h2>
          <p className="text-sm text-[var(--text-muted)]">
            {inboxDomain
              ? `@${inboxDomain}`
              : "Received messages"}
          </p>
        </div>
        <button
          type="button"
          onClick={loadInbox}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)]"
        >
          Refresh
        </button>
      </div>

      {setupStatus && !setupStatus.configured && (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          {setupStatus.message}
        </div>
      )}

      {error && (
        <div className="border-b border-[var(--error-border)] bg-[var(--error-bg)] px-5 py-3 text-sm text-[var(--error-text)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="px-6 py-16 text-center text-sm text-[var(--text-muted)]">
          Loading inbox…
        </div>
      ) : emails.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            No messages
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            New emails to your domain will show up here.
          </p>
        </div>
      ) : (
        <div className="flex min-h-[520px] flex-col lg:flex-row">
          {/* Message list */}
          <div
            className={`border-[var(--border)] lg:w-80 lg:shrink-0 lg:border-r ${
              selectedId ? "hidden lg:block" : "block"
            }`}
          >
            <div className="max-h-[520px] overflow-y-auto">
              {emails.map((email) => (
                <ListItem
                  key={email.id}
                  email={email}
                  selected={selectedId === email.id}
                  onSelect={() => openEmail(email.id)}
                />
              ))}
            </div>
            {hasMore && (
              <div className="border-t border-[var(--border)] p-3">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full rounded-lg border border-[var(--border)] py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-60"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </div>

          {/* Reading pane */}
          <div
            className={`flex min-h-[520px] flex-1 flex-col ${
              selectedId ? "flex" : "hidden lg:flex"
            }`}
          >
            {!selectedId ? (
              <div className="flex flex-1 items-center justify-center px-6 text-sm text-[var(--text-muted)]">
                Select a message to read
              </div>
            ) : detailLoading ? (
              <div className="flex flex-1 items-center justify-center text-sm text-[var(--text-muted)]">
                Loading message…
              </div>
            ) : detail ? (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-5 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(null);
                      setDetail(null);
                      setReplyOpen(false);
                    }}
                    className="rounded-lg px-2 py-1 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-hover)] lg:hidden"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={startReply}
                    className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
                  >
                    Reply
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-lg border border-[var(--border)] px-4 py-1.5 text-sm font-medium text-[var(--error-text)] hover:bg-[var(--error-bg)] disabled:opacity-60"
                  >
                    {deleting ? "Deleting…" : "Delete"}
                  </button>
                  {replyStatus === "sent" && (
                    <span className="text-sm text-[var(--success-text)]">
                      Reply sent
                    </span>
                  )}
                </div>

                <div className="border-b border-[var(--border)] px-5 py-4">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    {detail.subject || "(No subject)"}
                  </h3>
                  <div className="mt-3 space-y-1 text-sm">
                    <p>
                      <span className="text-[var(--text-muted)]">From: </span>
                      <span className="text-[var(--text-primary)]">
                        {detail.from}
                      </span>
                    </p>
                    <p>
                      <span className="text-[var(--text-muted)]">To: </span>
                      <span className="text-[var(--text-primary)]">
                        {detail.to.join(", ")}
                      </span>
                    </p>
                    <p className="text-[var(--text-muted)]">
                      {formatDateTime(detail.created_at)}
                    </p>
                  </div>

                  {detail.attachments.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {detail.attachments.map((file) => (
                        <span
                          key={file.id}
                          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-bg)] px-3 py-1 text-xs text-[var(--text-secondary)]"
                        >
                          {file.filename || "Attachment"}
                          <span className="text-[var(--text-muted)]">
                            {formatFileSize(file.size)}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <MessageBody detail={detail} />
                </div>

                {replyOpen && (
                  <div className="border-t border-[var(--border)] bg-[var(--panel-bg)] px-5 py-4">
                    <div className="mb-3 space-y-1 text-sm">
                      <p className="font-medium text-[var(--text-primary)]">
                        Reply to {parseEmailAddress(detail.from)}
                      </p>
                      <p className="text-[var(--text-muted)]">
                        From {replyFrom} · {replySubject(detail.subject)}
                      </p>
                    </div>
                    <RichTextEditor value={replyHtml} onChange={setReplyHtml} />
                    {replyError && (
                      <p className="mt-2 text-sm text-[var(--error-text)]">
                        {replyError}
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={handleReply}
                        disabled={replyStatus === "sending"}
                        className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
                      >
                        {replyStatus === "sending" ? "Sending…" : "Send reply"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyOpen(false)}
                        className="rounded-lg px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

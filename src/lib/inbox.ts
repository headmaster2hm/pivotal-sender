export type InboundAttachment = {
  id: string;
  filename: string | null;
  size: number;
  content_type: string;
  content_id: string | null;
  content_disposition: string | null;
};

export type InboxItem = {
  id: string;
  to: string[];
  from: string;
  created_at: string;
  subject: string;
  bcc: string[] | null;
  cc: string[] | null;
  reply_to: string[] | null;
  message_id: string;
  attachments: InboundAttachment[];
};

export type InboxListResponse = {
  emails: InboxItem[];
  has_more: boolean;
};

export type InboxDetail = InboxItem & {
  html: string | null;
  text: string | null;
  headers: Record<string, string> | null;
};

export type InboxSetupStatus = {
  configured: boolean;
  domain?: string;
  receiving_enabled?: boolean;
  mx_verified?: boolean;
  mx_record?: {
    type: string;
    name: string;
    value: string;
    priority?: number;
    status: string;
  } | null;
  message?: string;
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function replySubject(subject: string): string {
  const trimmed = subject.trim() || "(No subject)";
  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

export function getMessagePreview(detail: InboxDetail): string {
  if (detail.html) {
    return detail.html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
  return detail.text?.trim() || "";
}

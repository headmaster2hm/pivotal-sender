const STORAGE_KEY = "maildesk-deleted-inbox";

export function getDeletedInboxIds(): Set<string> {
  if (typeof window === "undefined") return new Set();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();

    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

export function markInboxEmailDeleted(id: string): void {
  const ids = getDeletedInboxIds();
  ids.add(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export function filterDeletedInboxEmails<T extends { id: string }>(
  emails: T[],
): T[] {
  const deleted = getDeletedInboxIds();
  return emails.filter((email) => !deleted.has(email.id));
}

export function parseEmailList(value: string): string[] {
  return value
    .split(/[,;\n]+/)
    .map((email) => email.trim())
    .filter(Boolean);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateEmailList(
  value: string,
  fieldName: string,
): string | null {
  if (!value.trim()) return null;

  const emails = parseEmailList(value);
  const invalid = emails.filter((email) => !isValidEmail(email));

  if (invalid.length > 0) {
    return `Invalid ${fieldName} address${invalid.length > 1 ? "es" : ""}: ${invalid.join(", ")}`;
  }

  return null;
}

export function formatFromAddress(name: string, email: string): string {
  const trimmedEmail = email.trim();
  const trimmedName = name.trim();

  if (!trimmedName) return trimmedEmail;
  return `${trimmedName} <${trimmedEmail}>`;
}

export function getEmailDomain(email: string): string | null {
  const match = email.trim().toLowerCase().match(/^[^\s@]+@([^\s@]+)$/);
  return match ? match[1] : null;
}

export function isAllowedFromDomain(
  email: string,
  allowedDomain: string,
): boolean {
  const domain = getEmailDomain(email);
  const normalizedAllowed = allowedDomain.trim().toLowerCase();

  if (!domain || !normalizedAllowed) return false;
  return domain === normalizedAllowed;
}

export function validateFromDomain(
  email: string,
  allowedDomain: string,
): string | null {
  if (!allowedDomain.trim()) return null;

  if (!isAllowedFromDomain(email, allowedDomain)) {
    return `From address must use @${allowedDomain.trim().toLowerCase()}`;
  }

  return null;
}

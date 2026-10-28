/** Single rule for email matching: trimmed and lowercased. Mirrors lower(trim()) in the database. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

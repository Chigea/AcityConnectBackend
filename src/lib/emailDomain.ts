const DEFAULT_DOMAIN = "acity.edu.gh";

export function getAllowedEmailDomain(): string {
  return (process.env.ALLOWED_EMAIL_DOMAIN ?? DEFAULT_DOMAIN).toLowerCase();
}

export function isInstitutionalEmail(email: string): boolean {
  const domain = getAllowedEmailDomain();
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith(`@${domain}`);
}

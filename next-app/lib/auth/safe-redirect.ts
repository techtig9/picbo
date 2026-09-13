/**
 * Validates a user-supplied `next` destination before we redirect to it.
 *
 * Open-redirect defence. An OAuth callback carries an attacker-influenceable
 * `next` parameter straight through a trusted, freshly-authenticated request,
 * which makes it one of the highest-value open-redirect targets in the app:
 * a victim who has just signed in is exactly who a phishing page wants.
 *
 * Rejected, with the reason each one matters:
 *   "//evil.com"            protocol-relative URL — the browser treats this as absolute
 *   "https://evil.com"      absolute URL
 *   "/\evil.com"            backslash; some browsers normalise \ to / before resolving
 *   "/%2f%2fevil.com"       percent-encoded protocol-relative, decoded after our check
 *   "javascript:..."        scheme injection
 *   anything not starting with a single "/"
 */
export const DEFAULT_SIGNED_IN_DESTINATION = "/dashboard";

// Control characters (incl. CR/LF) — header/redirect injection vectors.
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

export function safeNextPath(next: string | null | undefined, fallback: string = DEFAULT_SIGNED_IN_DESTINATION): string {
  if (!next) return fallback;

  // Decode first, so an encoded "//" or "\" cannot slip past the literal
  // checks below and only become dangerous once the browser decodes it.
  let candidate = next;
  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(candidate);
      if (decoded === candidate) break;
      candidate = decoded;
    } catch {
      return fallback; // malformed encoding — never trust it
    }
  }

  const trimmed = candidate.trim();
  if (!trimmed.startsWith("/")) return fallback;   // must be site-relative
  if (trimmed.startsWith("//")) return fallback;   // protocol-relative
  if (trimmed.includes("\\")) return fallback;     // backslash-normalising browsers
  if (CONTROL_CHARS.test(trimmed)) return fallback;

  return trimmed;
}

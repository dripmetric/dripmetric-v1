import type { EmailType } from '@dripmetric/catalog';

/**
 * Email type (brief Appendix A, section B): work, free, education or disposable.
 * Intent reads it as +5 (work, inside the fit cap) or -20 (disposable).
 *
 * The lists are small on purpose for now. Brief section 12 says to use a maintained
 * open list with a compatible licence, kept in a data file; that is an M5 job, and
 * the shape here does not change when the file grows.
 */

const FREE_PROVIDERS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'ymail.com',
  'hotmail.com',
  'hotmail.co.uk',
  'outlook.com',
  'live.com',
  'msn.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'gmx.de',
  'mail.com',
  'zoho.com',
  'yandex.ru',
  'qq.com',
  '163.com',
  '126.com',
  'naver.com',
  'web.de',
  'free.fr',
  'orange.fr',
  'libero.it',
]);

const DISPOSABLE_PROVIDERS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.info',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'throwawaymail.com',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
  'getnada.com',
  'dispostable.com',
  'maildrop.cc',
  'fakeinbox.com',
  'mailnesia.com',
  'tempr.email',
  'mohmal.com',
  'emailondeck.com',
  'spamgourmet.com',
  'tempinbox.com',
  'burnermail.io',
]);

const EDUCATION_SUFFIXES = ['.edu', '.ac.uk', '.edu.au', '.ac.jp', '.edu.cn', '.ac.in', '.edu.sg'];

export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 1 || at === email.length - 1) return null;
  return email
    .slice(at + 1)
    .toLowerCase()
    .trim();
}

export function classifyEmail(email: string): EmailType | null {
  const domain = emailDomain(email);
  if (!domain) return null;
  if (DISPOSABLE_PROVIDERS.has(domain)) return 'disposable';
  if (EDUCATION_SUFFIXES.some((s) => domain.endsWith(s))) return 'education';
  if (FREE_PROVIDERS.has(domain)) return 'free';
  return 'work';
}

/** Rough email shape check. We never bounce a message for a malformed address; the
 *  type simply comes back null. */
export function looksLikeEmail(value: unknown): value is string {
  return (
    typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254
  );
}

// ============================================================
// checkIn - Authentication Utilities
// ============================================================

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a per-account default password using FUTA portal convention:
 * the user's SURNAME in BLOCK LETTERS. Each user's default is unique —
 * no globally fixed password that an attacker could try against any
 * pre-provisioned account.
 *
 * `name` is the full name as captured at creation time. Surname is the
 * FIRST token of the name (Yoruba/Nigerian "Surname Firstname" convention,
 * which is also the convention used in the FUTA portal). If the name is
 * empty or whitespace, we fall back to a fixed-but-rare string and the
 * creator must reset it manually.
 */
export function generateDefaultPassword(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    // Should never happen because callers validate name first; defensive fallback.
    return 'CHANGE_ME';
  }
  const surname = trimmed.split(/\s+/)[0];
  return surname.toUpperCase();
}

/**
 * Extract the surname (first token, uppercased) from a full name. Kept as a
 * separate helper so UI components can show the same default password the
 * backend will compute without duplicating logic.
 */
export function extractSurname(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0].toUpperCase();
}

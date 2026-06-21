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
 * Academic / honorific titles that commonly prefix a lecturer's name in the
 * Nigerian university context. These are NOT surnames and must be stripped
 * before extracting the surname token, otherwise "Prof. Chidi Nwosu" would
 * yield password "PROF." instead of "NWOSU".
 *
 * Each entry is matched case-insensitively, with or without a trailing dot.
 */
const NAME_TITLES = new Set([
  'prof', 'professor', 'dr', 'doctor',
  'mr', 'mrs', 'ms', 'miss', 'mister',
  'engr', 'engineer', 'arc', 'architect',
  'chief', 'sir', 'lady', 'rev', 'reverend',
  'brig', 'brigadier', 'col', 'colonel', 'capt', 'captain',
  'hon', 'honourable', 'honorable',
]);

/**
 * Extract the surname token from a full name, stripping leading
 * honorific titles. The surname is the LAST NON-TITLE token of the
 * name — this matches the Nigerian university naming convention where
 * names are recorded as "[Title] FirstName Surname" (e.g. "Prof. Chidi
 * Nwosu" → NWOSU, "Ayoola Damisile" → DAMISILE). Returns the empty
 * string if no usable token remains.
 *
 * Examples:
 *   "Ayoola Damisile"       → "DAMISILE"
 *   "Prof. Chidi Nwosu"     → "NWOSU"
 *   "Dr. Adebayo Okonkwo"   → "OKONKWO"
 *   "Adebisi Oluwatobi"     → "OLUWATOBI"
 *   "Stack Dev"             → "DEV"
 */
export function extractSurname(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return '';
  const tokens = trimmed.split(/\s+/).filter((t) => {
    const normalized = t.replace(/\.$/, '').toLowerCase();
    return !NAME_TITLES.has(normalized);
  });
  if (tokens.length === 0) return '';
  // Last non-title token is the surname.
  return tokens[tokens.length - 1].toUpperCase();
}

/**
 * Generate a per-account default password using the FUTA portal convention:
 * the user's SURNAME in BLOCK LETTERS. Each user's default is unique —
 * no globally fixed password that an attacker could try against any
 * pre-provisioned account. Honorific titles (Prof., Dr., Mr., etc.) are
 * stripped and the surname is taken as the last remaining token.
 *
 * If the name is empty or contains only titles, we fall back to a
 * fixed-but-rare string and the creator must reset it manually.
 */
export function generateDefaultPassword(name: string): string {
  const surname = extractSurname(name);
  return surname || 'CHANGE_ME';
}

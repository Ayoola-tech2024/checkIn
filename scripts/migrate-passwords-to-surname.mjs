// ============================================================
// checkIn — One-time migration: reset all account passwords to
// the agreed surname-in-block-caps convention.
//
// Convention (src/lib/auth.ts:generateDefaultPassword):
//   password = SURNAME.toUpperCase()  where surname = first token
//   of the account's `name` (Yoruba/Nigerian "Surname Firstname"
//   convention, matching the FUTA portal).
//
// This script is IDEMPOTENT: it always sets password_hash to
// bcrypt(surname), so re-running it is safe. It resets ALL accounts
// because the legacy default was `CheckIn@2024` and every account
// in the DB currently hashes that (or has a NULL hash).
//
// Run: node scripts/migrate-passwords-to-surname.mjs
// ============================================================

import bcrypt from 'bcryptjs';

const BASE = 'https://9djdhppd.us-east.insforge.app/api/database/records';
const KEY = '[REDACTED]';
const SALT_ROUNDS = 12; // matches src/lib/auth.ts

const headers = {
  'apikey': KEY,
  'Authorization': `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
};

// Honorific titles to strip (must match src/lib/auth.ts NAME_TITLES).
const NAME_TITLES = new Set([
  'prof', 'professor', 'dr', 'doctor',
  'mr', 'mrs', 'ms', 'miss', 'mister',
  'engr', 'engineer', 'arc', 'architect',
  'chief', 'sir', 'lady', 'rev', 'reverend',
  'brig', 'brigadier', 'col', 'colonel', 'capt', 'captain',
  'hon', 'honourable', 'honorable',
]);

function surnameOf(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;
  const tokens = trimmed.split(/\s+/).filter((t) => {
    const normalized = t.replace(/\.$/, '').toLowerCase();
    return !NAME_TITLES.has(normalized);
  });
  if (tokens.length === 0) return null;
  // Last non-title token is the surname.
  return tokens[tokens.length - 1].toUpperCase();
}

async function fetchAll(table) {
  // admins/lecturers have no matric_number; students do. Request only
  // the columns guaranteed to exist on every account table.
  const url = `${BASE}/${table}?select=id,name,email,password_hash&limit=1000`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GET ${table} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function patchPassword(table, id, passwordHash) {
  const url = `${BASE}/${table}?id=eq.${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ password_hash: passwordHash }),
  });
  if (!res.ok) {
    throw new Error(`PATCH ${table} id=${id} failed: ${res.status} ${await res.text()}`);
  }
}

async function migrateTable(table, label) {
  console.log(`\n=== Migrating ${label} (${table}) ===`);
  const rows = await fetchAll(table);
  console.log(`Found ${rows.length} ${label.toLowerCase()}.`);

  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    const surname = surnameOf(row.name);
    if (!surname) {
      console.log(`  SKIP  ${row.email || row.id}: no name`);
      skipped++;
      continue;
    }
    const hash = await bcrypt.hash(surname, SALT_ROUNDS);
    await patchPassword(table, row.id, hash);
    console.log(`  OK    ${row.email || row.id}: password="${surname}"`);
    updated++;
  }
  console.log(`${label}: ${updated} updated, ${skipped} skipped.`);
  return updated;
}

const total =
  (await migrateTable('admins', 'Admins')) +
  (await migrateTable('lecturers', 'Lecturers')) +
  (await migrateTable('students', 'Students'));

console.log(`\n=== DONE: ${total} accounts migrated to surname-based passwords ===`);
console.log('Convention: password = SURNAME (last non-title token of name, uppercase)');
console.log('Examples:');
console.log('  "Ayoola Damisile"       → DAMISILE');
console.log('  "Prof. Chidi Nwosu"     → NWOSU');
console.log('  "Dr. Adebayo Okonkwo"   → OKONKWO');

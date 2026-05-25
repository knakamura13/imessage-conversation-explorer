import { readFileSync } from 'node:fs';
import { parse as parseToml } from 'smol-toml';
import type { ParticipantsConfig, Person } from './types.js';

export function loadParticipants(path: string): ParticipantsConfig {
  const raw = readFileSync(path, 'utf-8');
  const data = parseToml(raw) as Record<string, unknown>;

  const me = parsePerson(data.me, 'me', path);
  const spouse = parsePerson(data.spouse, 'spouse', path);

  const tz = data.timezone as Record<string, unknown> | undefined;
  const iana = typeof tz?.iana === 'string' ? tz.iana : 'UTC';

  return { me, spouse, timezone: iana };
}

function parsePerson(raw: unknown, key: string, path: string): Person {
  if (raw == null || typeof raw !== 'object') {
    throw new Error(`participants.toml at ${path}: missing [${key}] table`);
  }
  const obj = raw as Record<string, unknown>;
  const legal_name = stringField(obj, 'legal_name', key, path);
  const display_name = stringField(obj, 'display_name', key, path);
  const phone_numbers = stringArrayField(obj, 'phone_numbers', key, path);
  const emails = stringArrayField(obj, 'emails', key, path);
  if (phone_numbers.length === 0 && emails.length === 0) {
    throw new Error(
      `participants.toml at ${path}: [${key}] must have at least one phone_number or email`
    );
  }
  return { legal_name, display_name, phone_numbers, emails };
}

function stringField(obj: Record<string, unknown>, name: string, key: string, path: string): string {
  const v = obj[name];
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`participants.toml at ${path}: [${key}].${name} must be a non-empty string`);
  }
  return v;
}

function stringArrayField(
  obj: Record<string, unknown>,
  name: string,
  key: string,
  path: string
): string[] {
  const v = obj[name];
  if (v == null) return [];
  if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) {
    throw new Error(`participants.toml at ${path}: [${key}].${name} must be an array of strings`);
  }
  return v as string[];
}

export function identifiers(p: Person): string[] {
  return [...p.phone_numbers, ...p.emails];
}

import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { identifiers, loadParticipants } from '../src/lib/config.js';
import { mkTmpDir } from './helpers.js';

function writeToml(contents: string): string {
  const dir = mkTmpDir();
  const path = join(dir, 'participants.toml');
  writeFileSync(path, contents, 'utf-8');
  return path;
}

describe('loadParticipants', () => {
  it('parses a valid file into a typed config', () => {
    const path = writeToml(`
      [me]
      legal_name = "Kyle Nakamura"
      display_name = "Kyle"
      phone_numbers = ["+15551112222"]
      emails = []

      [spouse]
      legal_name = "Junghyun Kim"
      display_name = "Sally"
      phone_numbers = ["+15553334444"]
      emails = ["spouse@example.com"]

      [timezone]
      iana = "America/Los_Angeles"
    `);
    const cfg = loadParticipants(path);
    expect(cfg.me.display_name).toBe('Kyle');
    expect(cfg.spouse.legal_name).toBe('Junghyun Kim');
    expect(cfg.timezone).toBe('America/Los_Angeles');
  });

  it('throws when a person has no phone numbers and no emails', () => {
    const path = writeToml(`
      [me]
      legal_name = "K"
      display_name = "K"
      phone_numbers = []
      emails = []

      [spouse]
      legal_name = "S"
      display_name = "S"
      phone_numbers = ["+15553334444"]
      emails = []
    `);
    expect(() => loadParticipants(path)).toThrow(/at least one phone_number or email/);
  });

  it('identifiers() unions phones and emails in order', () => {
    const path = writeToml(`
      [me]
      legal_name = "K"
      display_name = "K"
      phone_numbers = ["+1", "+2"]
      emails = ["a@b"]

      [spouse]
      legal_name = "S"
      display_name = "S"
      phone_numbers = ["+9"]
      emails = []
    `);
    const cfg = loadParticipants(path);
    expect(identifiers(cfg.me)).toEqual(['+1', '+2', 'a@b']);
    expect(identifiers(cfg.spouse)).toEqual(['+9']);
  });
});

import { describe, expect, it } from 'vitest';
import { COCOA_EPOCH_UNIX_S, cocoaToIso, cocoaToUnixMs } from '../src/lib/apple-epoch.js';

describe('apple-epoch', () => {
  it('returns null for null/undefined inputs', () => {
    expect(cocoaToUnixMs(null)).toBe(null);
    expect(cocoaToUnixMs(undefined)).toBe(null);
    expect(cocoaToIso(null)).toBe(null);
  });

  it('treats values > 1e12 as nanoseconds', () => {
    // 1 million seconds past cocoa epoch, expressed in ns
    const cocoaSec = 1_000_000;
    const ns = cocoaSec * 1e9; // 1e15 — well above the 1e12 threshold
    expect(cocoaToUnixMs(ns)).toBe((COCOA_EPOCH_UNIX_S + cocoaSec) * 1000);
  });

  it('treats values <= 1e12 as seconds (legacy macOS)', () => {
    const sec = 5; // 5 seconds past cocoa epoch
    expect(cocoaToUnixMs(sec)).toBe((COCOA_EPOCH_UNIX_S + 5) * 1000);
  });

  it('treats a legacy second-magnitude value as seconds (no false-positive ns)', () => {
    // Up to ~25 years past cocoa epoch in seconds is ~8e8 — must NOT be treated as ns.
    const sec = 750_000_000;
    expect(cocoaToUnixMs(sec)).toBe((COCOA_EPOCH_UNIX_S + sec) * 1000);
  });

  it('decodes bigint nanoseconds (modern macOS)', () => {
    // 2024-01-01T12:00:00Z in nanoseconds since cocoa epoch
    const target = Date.UTC(2024, 0, 1, 12, 0, 0); // unix ms
    const cocoaSec = target / 1000 - COCOA_EPOCH_UNIX_S;
    const ns = BigInt(cocoaSec) * 1_000_000_000n;
    expect(cocoaToIso(ns)).toBe('2024-01-01T12:00:00.000Z');
  });
});

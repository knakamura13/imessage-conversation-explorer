export const COCOA_EPOCH_UNIX_S = 978_307_200;

// On macOS High Sierra+, message.date is nanoseconds since 2001-01-01 UTC.
// On older versions, it's seconds. Detect by magnitude: > 1e12 → nanoseconds.
const NS_THRESHOLD = 1_000_000_000_000n;

export function cocoaToUnixMs(t: number | bigint | null | undefined): number | null {
  if (t == null) return null;
  if (typeof t === 'bigint') {
    const isNs = t > NS_THRESHOLD;
    // Convert to seconds with millisecond fidelity, then to ms.
    if (isNs) {
      // nanoseconds → ms (with rounding)
      const ms = Number(t / 1_000_000n);
      return ms + COCOA_EPOCH_UNIX_S * 1000;
    } else {
      // seconds
      return Number(t) * 1000 + COCOA_EPOCH_UNIX_S * 1000;
    }
  }
  // number path — same rule, threshold expressed as number
  const isNs = t > 1e12;
  const sec = isNs ? t / 1e9 : t;
  return Math.round((sec + COCOA_EPOCH_UNIX_S) * 1000);
}

export function cocoaToIso(t: number | bigint | null | undefined): string | null {
  const ms = cocoaToUnixMs(t);
  if (ms === null) return null;
  return new Date(ms).toISOString();
}

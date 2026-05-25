// Decode the `text` from an iMessage `attributedBody` NSKeyedArchiver/typedstream blob.
//
// The real byte layout near an NSString instance is:
//
//   ... NSString <class-meta-bytes> 0x84 0x01 0x2B <length> <utf-8 text> 0x86 0x84 ...
//
// We anchor on the `\x84\x01\x2B` ("+") instance marker — NOT on the NSString class
// name, which is followed by class-table metadata that LOOKS like length-size
// selectors but isn't.
//
// Length encoding (Cocoa typedstream varint):
//   byte < 0x80 → that byte IS the length (the common case for short strings)
//   byte == 0x81 → next 2 bytes (little-endian) are the length
//   byte == 0x82 → next 4 bytes (little-endian) are the length
//
// On any anomaly we return null (fail closed). A blob can carry multiple NSString
// instances; we scan past failed candidates and try the next one.

const NSSTRING = Buffer.from('NSString', 'utf-8');
const INSTANCE_MARKER = Buffer.from([0x84, 0x01, 0x2b]);
const SCAN_AHEAD = 32;

export function decodeAttributedBody(blob: Uint8Array | Buffer | null | undefined): string | null {
  if (blob == null || blob.byteLength === 0) return null;
  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);

  let from = 0;
  while (from < buf.length) {
    const nsAt = buf.indexOf(NSSTRING, from);
    if (nsAt === -1) return null;

    const scanStart = nsAt + NSSTRING.length;
    const scanEnd = Math.min(scanStart + SCAN_AHEAD, buf.length - INSTANCE_MARKER.length + 1);
    const markerAt = indexOfWithin(buf, INSTANCE_MARKER, scanStart, scanEnd);

    if (markerAt !== -1) {
      const lenCursor = markerAt + INSTANCE_MARKER.length;
      const decoded = tryDecode(buf, lenCursor);
      if (decoded !== null) return decoded;
    }

    // Try the next NSString instance.
    from = nsAt + NSSTRING.length;
  }
  return null;
}

function indexOfWithin(buf: Buffer, needle: Buffer, start: number, end: number): number {
  if (start >= buf.length) return -1;
  const idx = buf.indexOf(needle, start);
  if (idx === -1 || idx >= end) return -1;
  return idx;
}

function tryDecode(buf: Buffer, cursor: number): string | null {
  const lenInfo = readVarLength(buf, cursor);
  if (lenInfo === null) return null;
  const { length, next } = lenInfo;
  if (length <= 0) return null;
  const textEnd = next + length;
  if (textEnd > buf.length) return null;
  try {
    return buf.toString('utf-8', next, textEnd);
  } catch {
    return null;
  }
}

function readVarLength(buf: Buffer, cursor: number): { length: number; next: number } | null {
  if (cursor >= buf.length) return null;
  const first = buf[cursor];
  if (first < 0x80) {
    return { length: first, next: cursor + 1 };
  }
  if (first === 0x81) {
    if (cursor + 2 >= buf.length) return null;
    const length = buf.readUInt16LE(cursor + 1);
    return { length, next: cursor + 3 };
  }
  if (first === 0x82) {
    if (cursor + 4 >= buf.length) return null;
    const length = buf.readUInt32LE(cursor + 1);
    return { length, next: cursor + 5 };
  }
  return null;
}

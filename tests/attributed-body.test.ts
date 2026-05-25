import { describe, expect, it } from 'vitest';
import { decodeAttributedBody } from '../src/lib/attributed-body.js';
import { makeAttributedBody } from './fixtures/synthetic-chat-db.js';

const MARKER = Buffer.from([0x84, 0x01, 0x2b]);

function withClassMeta(textBlock: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from([0x04, 0x0b]),
    Buffer.from('NSString', 'utf-8'),
    Buffer.from([0x01, 0x95, 0x84, 0x01, 0x40]),
    textBlock
  ]);
}

describe('decodeAttributedBody', () => {
  it('returns null for null/empty input', () => {
    expect(decodeAttributedBody(null)).toBe(null);
    expect(decodeAttributedBody(undefined)).toBe(null);
    expect(decodeAttributedBody(Buffer.alloc(0))).toBe(null);
  });

  it('decodes direct-length form (length < 0x80)', () => {
    const blob = makeAttributedBody('hello world');
    expect(decodeAttributedBody(blob)).toBe('hello world');
  });

  it('decodes 0x81 + 2-byte LE length', () => {
    const text = 'x'.repeat(200);
    const utf8 = Buffer.from(text, 'utf-8');
    const len = Buffer.alloc(2);
    len.writeUInt16LE(utf8.length, 0);
    const block = Buffer.concat([MARKER, Buffer.from([0x81]), len, utf8, Buffer.from([0x86, 0x84])]);
    expect(decodeAttributedBody(withClassMeta(block))).toBe(text);
  });

  it('decodes 0x82 + 4-byte LE length', () => {
    const text = 'y'.repeat(70_000);
    const utf8 = Buffer.from(text, 'utf-8');
    const len = Buffer.alloc(4);
    len.writeUInt32LE(utf8.length, 0);
    const block = Buffer.concat([MARKER, Buffer.from([0x82]), len, utf8, Buffer.from([0x86, 0x84])]);
    expect(decodeAttributedBody(withClassMeta(block))).toBe(text);
  });

  it('returns null when no NSString anchor present', () => {
    const blob = Buffer.from([0x00, 0x01, 0x02, 0x84, 0x01, 0x2b, 0x05, 0x68, 0x65, 0x6c, 0x6c, 0x6f]);
    expect(decodeAttributedBody(blob)).toBe(null);
  });

  it('returns null when no instance marker after NSString', () => {
    const blob = Buffer.concat([
      Buffer.from([0x04, 0x0b]),
      Buffer.from('NSString', 'utf-8'),
      Buffer.from('no marker here please move along no markerrr')
    ]);
    expect(decodeAttributedBody(blob)).toBe(null);
  });

  it('returns null on declared-length overrun', () => {
    // Direct-length form claiming 200 bytes but blob has only 5 after the length.
    const block = Buffer.concat([MARKER, Buffer.from([200]), Buffer.from('short')]);
    expect(decodeAttributedBody(withClassMeta(block))).toBe(null);
  });

  it('falls through to a later NSString instance when the first fails', () => {
    const bad = Buffer.concat([
      Buffer.from([0x04, 0x0b]),
      Buffer.from('NSString', 'utf-8'),
      // metadata followed by a marker with an overrun length — must be rejected
      Buffer.from([0x01, 0x95]),
      MARKER,
      Buffer.from([0xff]) // declares 255-byte text but there's nothing after
    ]);
    const good = makeAttributedBody('second one wins');
    expect(decodeAttributedBody(Buffer.concat([bad, good]))).toBe('second one wins');
  });
});

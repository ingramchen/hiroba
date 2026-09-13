import { deflateSync } from 'node:zlib';

const CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return (bytes: Uint8Array): number => {
    let c = 0xffffffff;
    for (const byte of bytes) {
      c = (table[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type: string, body: Uint8Array): Uint8Array {
  const head = new Uint8Array(8);
  const view = new DataView(head.buffer);
  view.setUint32(0, body.length);
  for (let at = 0; at < 4; at++) {
    head[4 + at] = type.charCodeAt(at);
  }
  const crc = new Uint8Array(4);
  const typed = new Uint8Array(4 + body.length);
  typed.set(head.subarray(4, 8));
  typed.set(body, 4);
  new DataView(crc.buffer).setUint32(0, CRC(typed));
  const out = new Uint8Array(head.length + body.length + 4);
  out.set(head);
  out.set(body, head.length);
  out.set(crc, head.length + body.length);
  return out;
}

export function png(
  width: number,
  height: number,
  pixel: (x: number, y: number) => number[],
): Uint8Array {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = new Uint8Array(height * (width * 3 + 1));
  let at = 0;
  for (let y = 0; y < height; y++) {
    raw[at] = 0;
    at += 1;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y) as [number, number, number];
      raw[at] = r;
      raw[at + 1] = g;
      raw[at + 2] = b;
      at += 3;
    }
  }
  const idat = new Uint8Array(deflateSync(raw));
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', new Uint8Array(0)),
  ];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export const SKIN = [200, 140, 110];
export const BLUE = [20, 40, 200];

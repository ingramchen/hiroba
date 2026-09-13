const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface RawImage {
  width: number;
  height: number;
  channels: number;
  data: Uint8Array;
}

function readUint32(bytes: Uint8Array, at: number): number {
  return (
    ((bytes[at] as number) << 24) |
    ((bytes[at + 1] as number) << 16) |
    ((bytes[at + 2] as number) << 8) |
    (bytes[at + 3] as number)
  );
}

function isPng(bytes: Uint8Array): boolean {
  return SIGNATURE.every((byte, at) => bytes[at] === byte);
}

async function inflate(parts: Uint8Array[]): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) {
        controller.enqueue(part);
      }
      controller.close();
    },
  });
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = source.pipeThrough(new DecompressionStream('deflate')).getReader();
  for (;;) {
    const step = await reader.read();
    if (step.done) {
      break;
    }
    chunks.push(step.value);
    total += step.value.length;
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) {
    return a;
  }
  return pb <= pc ? b : c;
}

function unfilter(raw: Uint8Array, width: number, height: number, channels: number): Uint8Array {
  const stride = width * channels;
  const out = new Uint8Array(stride * height);
  let source = 0;
  for (let row = 0; row < height; row++) {
    const filter = raw[source] as number;
    source += 1;
    const line = row * stride;
    const above = line - stride;
    for (let at = 0; at < stride; at++) {
      const value = raw[source + at] as number;
      const left = at >= channels ? (out[line + at - channels] as number) : 0;
      const up = row > 0 ? (out[above + at] as number) : 0;
      const upLeft = row > 0 && at >= channels ? (out[above + at - channels] as number) : 0;
      let restored: number;
      switch (filter) {
        case 1:
          restored = value + left;
          break;
        case 2:
          restored = value + up;
          break;
        case 3:
          restored = value + ((left + up) >> 1);
          break;
        case 4:
          restored = value + paeth(left, up, upLeft);
          break;
        default:
          restored = value;
      }
      out[line + at] = restored & 0xff;
    }
    source += stride;
  }
  return out;
}

export async function decodePng(bytes: Uint8Array): Promise<RawImage | null> {
  if (bytes.length < 8 || !isPng(bytes)) {
    return null;
  }
  let at = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const data: Uint8Array[] = [];
  while (at + 8 <= bytes.length) {
    const length = readUint32(bytes, at);
    const type = String.fromCharCode(
      bytes[at + 4] as number,
      bytes[at + 5] as number,
      bytes[at + 6] as number,
      bytes[at + 7] as number,
    );
    const body = at + 8;
    if (body + length > bytes.length) {
      return null;
    }
    if (type === 'IHDR') {
      width = readUint32(bytes, body);
      height = readUint32(bytes, body + 4);
      const depth = bytes[body + 8];
      const colour = bytes[body + 9];
      const interlace = bytes[body + 12];
      if (depth !== 8 || interlace !== 0 || (colour !== 2 && colour !== 6)) {
        return null;
      }
      channels = colour === 2 ? 3 : 4;
    } else if (type === 'IDAT') {
      data.push(bytes.subarray(body, body + length));
    } else if (type === 'IEND') {
      break;
    }
    at = body + length + 4;
  }
  if (width < 1 || height < 1 || channels === 0 || data.length === 0) {
    return null;
  }
  let raw: Uint8Array;
  try {
    raw = await inflate(data);
  } catch {
    return null;
  }
  if (raw.length < height * (width * channels + 1)) {
    return null;
  }
  return { width, height, channels, data: unfilter(raw, width, height, channels) };
}

export function isSkinTone(red: number, green: number, blue: number): boolean {
  const top = Math.max(red, green, blue);
  const bottom = Math.min(red, green, blue);
  return (
    red > 95 &&
    green > 40 &&
    blue > 20 &&
    top - bottom > 15 &&
    Math.abs(red - green) > 15 &&
    red > green &&
    red > blue
  );
}

export function skinRatio(image: RawImage): number {
  const step = image.channels;
  let skin = 0;
  let counted = 0;
  for (let at = 0; at + step <= image.data.length; at += step) {
    if (step === 4 && (image.data[at + 3] as number) < 128) {
      continue;
    }
    counted += 1;
    if (
      isSkinTone(
        image.data[at] as number,
        image.data[at + 1] as number,
        image.data[at + 2] as number,
      )
    ) {
      skin += 1;
    }
  }
  return counted === 0 ? 0 : skin / counted;
}

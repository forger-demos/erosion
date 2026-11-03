export interface PngImage {
  width: number;
  height: number;
  /** Bits per sample: 8 or 16. 16-bit samples are big-endian in `data`, as PNG stores them. */
  depth: 8 | 16;
  /** Samples per pixel: 1 is greyscale, 4 is RGBA. */
  channels: 1 | 4;
  /** Row-major samples with no row padding. */
  data: Uint8Array | Uint8ClampedArray;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]!) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** A zlib stream of stored blocks: no compression, so the bytes depend on nothing but the input. */
function zlibStored(raw: Uint8Array): Uint8Array {
  const blocks = Math.max(1, Math.ceil(raw.length / 65535));
  const out = new Uint8Array(2 + raw.length + blocks * 5 + 4);
  const view = new DataView(out.buffer);
  out[0] = 0x78;
  out[1] = 0x01;
  let at = 2;
  for (let b = 0; b < blocks; b++) {
    const start = b * 65535;
    const len = Math.min(65535, raw.length - start);
    out[at] = b === blocks - 1 ? 1 : 0;
    view.setUint16(at + 1, len, true);
    view.setUint16(at + 3, len ^ 0xffff, true);
    out.set(raw.subarray(start, start + len), at + 5);
    at += 5 + len;
  }
  view.setUint32(at, adler32(raw));
  return out;
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
}

const signature = [137, 80, 78, 71, 13, 10, 26, 10];

/** Encodes an image as a PNG. The output is a pure function of the input, byte for byte. */
export function encodePng({width, height, depth, channels, data}: PngImage): Uint8Array {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error('A PNG needs a width and height of at least one pixel.');
  const rowBytes = (width * channels * depth) / 8;
  if (data.length !== rowBytes * height) throw new Error('The pixel data does not match the image size.');
  const raw = new Uint8Array((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) raw.set(data.subarray(y * rowBytes, (y + 1) * rowBytes), y * (rowBytes + 1) + 1);
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = depth;
  header[9] = channels === 1 ? 0 : 6;
  const parts = [Uint8Array.from(signature), chunk('IHDR', header), chunk('IDAT', zlibStored(raw)), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

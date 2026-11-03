import {describe, expect, test} from 'bun:test';
import {inflateSync} from 'node:zlib';
import {crc32, encodePng} from './png';
import {exportFilename, heightmapPng, shadedPng} from './images';
import {createSimulation} from '../erosion/simulation';

/** Reads back what encodePng wrote, with zlib from the runtime as an independent check. */
function decode(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  let at = 8;
  let header: {width: number; height: number; depth: number; type: number} | null = null;
  const idat: Uint8Array[] = [];
  const types: string[] = [];
  while (at < png.length) {
    const len = view.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    const body = png.subarray(at + 8, at + 8 + len);
    expect(view.getUint32(at + 8 + len)).toBe(crc32(png.subarray(at + 4, at + 8 + len)));
    types.push(type);
    if (type === 'IHDR') header = {width: view.getUint32(at + 8), height: view.getUint32(at + 12), depth: body[8]!, type: body[9]!};
    if (type === 'IDAT') idat.push(body);
    at += 12 + len;
  }
  expect(types).toEqual(['IHDR', 'IDAT', 'IEND']);
  const raw = inflateSync(Uint8Array.from(idat.flatMap((p) => Array.from(p))));
  const rowBytes = (raw.length / header!.height) - 1;
  const data = new Uint8Array(rowBytes * header!.height);
  for (let y = 0; y < header!.height; y++) {
    expect(raw[y * (rowBytes + 1)]).toBe(0);
    data.set(raw.subarray(y * (rowBytes + 1) + 1, (y + 1) * (rowBytes + 1)), y * rowBytes);
  }
  return {...header!, data};
}

describe('png encoder', () => {
  test('crc32 matches the known check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  test('a tiny 16-bit greyscale image decodes to its input', () => {
    const data = Uint8Array.from([0, 0, 1, 2, 255, 255, 128, 0, 7, 9, 0, 1]);
    const out = decode(encodePng({width: 3, height: 2, depth: 16, channels: 1, data}));
    expect(out).toMatchObject({width: 3, height: 2, depth: 16, type: 0});
    expect(Array.from(out.data)).toEqual(Array.from(data));
  });

  test('a tiny RGBA image decodes to its input', () => {
    const data = Uint8Array.from({length: 2 * 2 * 4}, (_, i) => i * 13);
    const out = decode(encodePng({width: 2, height: 2, depth: 8, channels: 4, data}));
    expect(out).toMatchObject({depth: 8, type: 6});
    expect(Array.from(out.data)).toEqual(Array.from(data));
  });

  test('data larger than one stored block still round-trips', () => {
    const data = Uint8Array.from({length: 200 * 200 * 2}, (_, i) => (i * 31) & 0xff);
    expect(Array.from(decode(encodePng({width: 200, height: 200, depth: 16, channels: 1, data})).data)).toEqual(Array.from(data));
  });

  test('a size that does not match the data is refused', () => {
    expect(() => encodePng({width: 2, height: 2, depth: 8, channels: 1, data: new Uint8Array(3)})).toThrow();
    expect(() => encodePng({width: 0, height: 2, depth: 8, channels: 1, data: new Uint8Array(0)})).toThrow();
  });
});

describe('exported images', () => {
  const n = 16;
  const run = () => {
    const sim = createSimulation({n, seed: 5, preset: 'hills'});
    sim.advance(10);
    return sim.snapshot();
  };

  test('the same seed and step export byte-identical files', () => {
    const a = run();
    const b = run();
    expect(heightmapPng(a.height, n)).toEqual(heightmapPng(b.height, n));
    expect(shadedPng(a.height, a.water, n, true)).toEqual(shadedPng(b.height, b.water, n, true));
  });

  test('the heightmap holds the bed scaled over the full range', () => {
    const height = new Float32Array(n * n);
    height[0] = 0;
    height[1] = n / 4;
    height[2] = n / 2;
    height[3] = -1;
    const {data} = decode(heightmapPng(height, n));
    const at = (i: number) => (data[i * 2]! << 8) | data[i * 2 + 1]!;
    expect([at(0), at(1), at(2), at(3)]).toEqual([0, 32768, 65535, 0]);
  });

  test('the shaded image is opaque RGBA of the grid size', () => {
    const s = run();
    const out = decode(shadedPng(s.height, s.water, n, false));
    expect(out).toMatchObject({width: n, height: n, depth: 8, type: 6});
    for (let i = 0; i < n * n; i++) expect(out.data[i * 4 + 3]).toBe(255);
  });

  test('file names carry the preset, seed and step', () => {
    expect(exportFilename('heightmap', 'alpine', 42, 300)).toBe('erosion-alpine-seed42-step300-height16.png');
    expect(exportFilename('shaded', 'alpine', 42, 300)).toBe('erosion-alpine-seed42-step300-shaded.png');
  });
});

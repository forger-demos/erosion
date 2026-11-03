import {expect, test} from 'bun:test';
import {handle} from './app';

test('health reports ok', async () => {
  const res = await handle(new Request('http://x/api/health'));
  expect(await res.json()).toEqual({ok: true});
});

test('serves the page', async () => {
  const res = await handle(new Request('http://x/'));
  expect(res.status).toBe(200);
});

test('refuses paths outside public', async () => {
  const res = await handle(new Request('http://x/../package.json'));
  expect(res.status).toBe(404);
});

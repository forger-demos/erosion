import {expect, test} from 'bun:test';
import {Glob} from 'bun';

test('src/core/relief imports nothing from the DOM, the shell or workers', async () => {
  for await (const file of new Glob('*.ts').scan({cwd: import.meta.dir})) {
    if (file.endsWith('.test.ts')) continue;
    const text = await Bun.file(`${import.meta.dir}/${file}`).text();
    expect(text).not.toMatch(/\b(document|window|HTMLCanvasElement|Worker|OffscreenCanvas)\b/);
    expect(text).not.toMatch(/from '\.\.\/\.\.\/shell/);
  }
});

const publicDir = new URL('../public/', import.meta.url);
const entries = {
  '/main.js': new URL('./shell/main.ts', import.meta.url).pathname,
  '/worker.js': new URL('./shell/simWorker.ts', import.meta.url).pathname,
} as const;

const bundles = new Map<string, Promise<string>>();

/** Page scripts are bundled from src/shell on first request, so there is no build step to forget. */
function shellBundle(path: keyof typeof entries): Promise<string> {
  let bundle = bundles.get(path);
  if (!bundle) {
    bundle = Bun.build({entrypoints: [entries[path]], target: 'browser'}).then((out) => {
      if (!out.success) throw new Error(out.logs.join('\n'));
      return out.outputs[0]!.text();
    });
    bundle.catch(() => bundles.delete(path));
    bundles.set(path, bundle);
  }
  return bundle;
}

export async function handle(req: Request): Promise<Response> {
  const {pathname} = new URL(req.url);
  if (pathname === '/api/health') return Response.json({ok: true});
  if (pathname === '/main.js' || pathname === '/worker.js') {
    return new Response(await shellBundle(pathname), {headers: {'content-type': 'text/javascript'}});
  }
  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (name.split('/').includes('..')) return new Response('not found', {status: 404});
  const file = Bun.file(new URL(name, publicDir));
  return (await file.exists()) ? new Response(file) : new Response('not found', {status: 404});
}

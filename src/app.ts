const publicDir = new URL('../public/', import.meta.url);
const shellEntry = new URL('./shell/main.ts', import.meta.url).pathname;

let bundle: Promise<string> | null = null;

/** The page script is bundled from src/shell on first request, so there is no build step to forget. */
function shellBundle(): Promise<string> {
  bundle ??= Bun.build({entrypoints: [shellEntry], target: 'browser'}).then((out) => {
    if (!out.success) throw new Error(out.logs.join('\n'));
    return out.outputs[0]!.text();
  });
  bundle.catch(() => (bundle = null));
  return bundle;
}

export async function handle(req: Request): Promise<Response> {
  const {pathname} = new URL(req.url);
  if (pathname === '/api/health') return Response.json({ok: true});
  if (pathname === '/main.js') {
    return new Response(await shellBundle(), {headers: {'content-type': 'text/javascript'}});
  }
  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (name.split('/').includes('..')) return new Response('not found', {status: 404});
  const file = Bun.file(new URL(name, publicDir));
  return (await file.exists()) ? new Response(file) : new Response('not found', {status: 404});
}

const publicDir = new URL('../public/', import.meta.url);

export async function handle(req: Request): Promise<Response> {
  const {pathname} = new URL(req.url);
  if (pathname === '/api/health') return Response.json({ok: true});
  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (name.split('/').includes('..')) return new Response('not found', {status: 404});
  const file = Bun.file(new URL(name, publicDir));
  return (await file.exists()) ? new Response(file) : new Response('not found', {status: 404});
}

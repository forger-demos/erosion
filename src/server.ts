import {handle} from './app';

const server = Bun.serve({port: Number(process.env.PORT ?? 3000), fetch: handle});
console.log(`listening on ${server.url}`);

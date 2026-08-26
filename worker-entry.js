import { onRequestGet, onRequestPost, onRequestOptions } from './functions/api/blabla/sync.js';

function makeContext(request, env, ctx) {
  return {
    request,
    env,
    params: {},
    data: {},
    waitUntil: (promise) => ctx.waitUntil(promise),
    next: () => env.ASSETS.fetch(request),
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/blabla/sync') {
      const context = makeContext(request, env, ctx);
      if (request.method === 'GET') return onRequestGet(context);
      if (request.method === 'POST') return onRequestPost(context);
      if (request.method === 'OPTIONS') return onRequestOptions(context);
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, POST, OPTIONS' } });
    }
    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ ok: false, code: 'NOT_FOUND' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    return env.ASSETS.fetch(request);
  },
};

// Körs före varje förfrågan, även för statiska filer (PDF:er m.m.).
// Allt under /boende/dokument kräver giltig sessionscookie, annars skickas
// besökaren till inloggningssidan. Är miljövariablerna inte satta nekas allt
// i den låsta delen (stänger, öppnar aldrig).

import { isProtectedPath, isConfigured, verifySession, LOGIN_PATH } from './_lib/auth.js';

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  if (!isProtectedPath(url.pathname)) return next();

  if (!isConfigured(env)) {
    return new Response('Medlemsdelen är inte konfigurerad (BOENDE_PASSWORD / SESSION_SECRET saknas).', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  if (!(await verifySession(request, env))) {
    const target = url.pathname + url.search;
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${LOGIN_PATH}?next=${encodeURIComponent(target)}`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const res = await next();
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', 'private, no-store');
  out.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return out;
}

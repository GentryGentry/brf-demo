import {
  isConfigured, checkPassword, makeSessionValue, sessionCookie, verifySession,
  safeNext, sleep, FAIL_DELAY_MS, DEFAULT_NEXT,
} from '../_lib/auth.js';
import { renderPage, esc } from '../_lib/layout.js';

const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};

function loginPage({ next, error, status = 200 }) {
  const alert = error
    ? `<p class="form-alert" role="alert">${esc(error)}</p>`
    : '';
  const body = `<section class="first">
  <div class="container narrow">
    <form class="login-card" method="post" action="/boende/logga-in" autocomplete="on">
      ${alert}
      <input type="hidden" name="next" value="${esc(next)}" />
      <div class="field">
        <label for="password">Lösenord för medlemmar</label>
        <input id="password" name="password" type="password" autocomplete="current-password" maxlength="256" required autofocus />
      </div>
      <button class="btn" type="submit">Logga in</button>
      <a class="login-back" href="/">← Till startsidan</a>
    </form>
  </div>
</section>`;
  return new Response(renderPage({
    title: 'Logga in',
    description: 'Inloggning för medlemmar i Brf Demobacken.',
    crumb: '<a href="/">Hem</a><span class="sep">/</span><a href="/boende">För boende</a><span class="sep">/</span><span>Logga in</span>',
    h1: 'Endast för <em>medlemmar</em>.',
    lede: 'Dokumenten är skyddade. Ange föreningens gemensamma lösenord för att komma in.',
    body,
  }), { status, headers: HEADERS });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get('next'));
  if (isConfigured(env) && await verifySession(request, env)) {
    return new Response(null, { status: 302, headers: { Location: next, 'Cache-Control': 'no-store' } });
  }
  if (!isConfigured(env)) {
    return loginPage({ next, status: 503, error: 'Inloggningen är inte konfigurerad ännu.' });
  }
  return loginPage({ next });
}

export async function onRequestPost({ request, env }) {
  // Enkelt CSRF-skydd utöver SameSite: en webbläsare skickar alltid Origin på POST.
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) {
    return new Response('Förbjudet', { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  let next = DEFAULT_NEXT;
  let password = '';
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > 4096) return new Response('För stor förfrågan', { status: 413 });
  try {
    const form = await request.formData();
    next = safeNext(form.get('next'));
    const p = form.get('password');
    password = typeof p === 'string' ? p : '';
  } catch {
    return loginPage({ next, status: 400, error: 'Något gick fel. Försök igen.' });
  }

  if (!isConfigured(env)) {
    return loginPage({ next, status: 503, error: 'Inloggningen är inte konfigurerad ännu.' });
  }

  if (password.length === 0 || password.length > 256 || !(await checkPassword(password, env))) {
    await sleep(FAIL_DELAY_MS);   // bromsar gissning; se README om begränsning på nätverksnivå
    return loginPage({
      next, status: 401,
      error: password.length === 0 ? 'Ange lösenordet.' : 'Fel lösenord. Kontrollera och försök igen.',
    });
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: next,
      'Set-Cookie': sessionCookie(await makeSessionValue(env)),
      'Cache-Control': 'no-store',
    },
  });
}

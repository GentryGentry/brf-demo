// Gemensam inloggningslogik för medlemsdelen. Körs i Cloudflare Pages Functions
// (Workers-runtime), använder bara Web Crypto. Inga hemligheter i koden:
// BOENDE_PASSWORD och SESSION_SECRET kommer från miljövariabler.

export const COOKIE_NAME = '__Host-boende';
export const SESSION_SECONDS = 30 * 24 * 60 * 60;
export const LOGIN_PATH = '/boende/logga-in';
export const DEFAULT_NEXT = '/boende/dokument/';
export const FAIL_DELAY_MS = 1500;

const enc = new TextEncoder();

export function isConfigured(env) {
  return typeof env.BOENDE_PASSWORD === 'string' && env.BOENDE_PASSWORD.length > 0 &&
         typeof env.SESSION_SECRET === 'string' && env.SESSION_SECRET.length >= 32;
}

// ---------- Vilka sökvägar är låsta? ----------

// Avkodar %-kodning (även dubbelkodning), gör små bokstäver och vänder
// bakåtstreck. Returnerar null om avkodningen misslyckas.
function decodePath(pathname) {
  let p = pathname;
  for (let i = 0; i < 3; i++) {
    let d;
    try { d = decodeURIComponent(p); } catch { return null; }
    if (d === p) break;
    p = d;
  }
  return p.toLowerCase().replace(/\\/g, '/');
}

// Normaliserar som en filserver skulle: slår ihop //, löser upp . och ..
export function normalizePath(pathname) {
  const p = decodePath(pathname);
  if (p === null) return null;
  const out = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { out.pop(); continue; }
    out.push(seg);
  }
  return '/' + out.join('/');
}

// Allt som börjar på /boende/dokument är låst: katalogen, index, .html-varianten
// och alla filer under den. Kontrollen görs både på den uppslösta sökvägen och på
// den avkodade sökvägen före uppslösning, så att låset inte beror på att
// filservern tolkar ".." likadant som vi. Hellre för brett än för snävt.
export function isProtectedPath(pathname) {
  const decoded = decodePath(pathname);
  if (decoded === null) return true;
  if (decoded.replace(/\/{2,}/g, '/').includes('/boende/dokument')) return true;
  const n = normalizePath(pathname);
  return n === null || n.startsWith('/boende/dokument');
}

// Tillåt bara interna mål under /boende, annars standardmålet (ingen open redirect).
export function safeNext(next) {
  if (typeof next !== 'string' || next.length > 300) return DEFAULT_NEXT;
  if (!/^\/[^/\\]/.test(next) && next !== '/') return DEFAULT_NEXT;
  if (/[\u0000-\u001f\u007f]/.test(next)) return DEFAULT_NEXT;
  const n = normalizePath(next.split(/[?#]/)[0]);
  if (n === null || !(n === '/boende' || n.startsWith('/boende/'))) return DEFAULT_NEXT;
  if (n === LOGIN_PATH || n.startsWith('/boende/logga-')) return DEFAULT_NEXT;
  return next;
}

// ---------- Krypto ----------

function b64url(buf) {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(str) {
  if (!/^[A-Za-z0-9_-]+$/.test(str)) return null;
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function hmacKey(secret, usages) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usages);
}

async function hmac(secret, message) {
  return new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret, ['sign']), enc.encode(message)));
}

// Jämförelse i konstant tid av två lika långa byte-arrayer.
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// Lösenordet jämförs inte direkt: båda sidor görs först till en HMAC med
// SESSION_SECRET som nyckel. Då är längderna lika (32 byte) och jämförelsen
// läcker varken innehåll eller längd via tidsskillnader.
export async function checkPassword(input, env) {
  const a = await hmac(env.SESSION_SECRET, 'pw:' + input);
  const b = await hmac(env.SESSION_SECRET, 'pw:' + env.BOENDE_PASSWORD);
  return timingSafeEqual(a, b);
}

// Sessionen binds till nuvarande lösenord: byts BOENDE_PASSWORD blir alla
// utfärdade cookies ogiltiga. Fingeravtrycket ligger bara i den signerade
// texten, inte i cookien.
async function passwordFingerprint(env) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(env.BOENDE_PASSWORD));
  return b64url(d);
}

async function sessionMessage(exp, env) {
  return `v1.${exp}.${await passwordFingerprint(env)}`;
}

export async function makeSessionValue(env, now = Date.now()) {
  const exp = Math.floor(now / 1000) + SESSION_SECONDS;
  const sig = await hmac(env.SESSION_SECRET, await sessionMessage(exp, env));
  return `${exp}.${b64url(sig)}`;
}

export function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export async function verifySession(request, env, now = Date.now()) {
  const value = getCookie(request, COOKIE_NAME);
  if (!value || value.length > 200) return false;
  const dot = value.indexOf('.');
  if (dot < 1) return false;
  const expStr = value.slice(0, dot);
  if (!/^\d{1,12}$/.test(expStr)) return false;
  const exp = Number(expStr);
  if (exp <= Math.floor(now / 1000)) return false;           // utgången
  if (exp > Math.floor(now / 1000) + SESSION_SECONDS) return false; // orimligt långt fram
  const sig = b64urlToBytes(value.slice(dot + 1));
  if (!sig) return false;
  // subtle.verify jämför i konstant tid
  return crypto.subtle.verify('HMAC', await hmacKey(env.SESSION_SECRET, ['verify']), sig, enc.encode(await sessionMessage(exp, env)));
}

export function sessionCookie(value) {
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearedCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

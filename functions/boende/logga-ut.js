import { clearedCookie } from '../_lib/auth.js';

// Länk (GET) och formulär (POST) gör samma sak: rensa cookien och gå till den
// öppna Boende-sidan. Att någon kan tvinga ut en medlem via GET är ofarligt.
function logout() {
  return new Response(null, {
    status: 303,
    headers: { Location: '/boende', 'Set-Cookie': clearedCookie(), 'Cache-Control': 'no-store' },
  });
}

export const onRequestGet = logout;
export const onRequestPost = logout;

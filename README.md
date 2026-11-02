# Brf Demobacken – demosajt

Statisk sajt (HTML/CSS/JS, inget byggsteg) med en lösenordsskyddad medlemsdel.
Sajten ligger i `public/`, serverlogiken i `functions/` (Cloudflare Pages Functions).

## Vad som är öppet och vad som är låst

| Sökväg | Status |
|---|---|
| `/`, `/boende`, `/boende/felanmalan`, `/boende/tvattstuga`, `/boende/ordningsregler` | Öppet |
| `/boende/dokument` och **allt under** (inkl. PDF:er) | Kräver inloggning |
| `/boende/logga-in`, `/boende/logga-ut` | Inloggning / utloggning |

Låset sitter i `functions/_middleware.js`, som körs före varje förfrågan,
även för statiska filer. Den som saknar giltig cookie skickas till inloggningen.
Det finns bara en kopia av varje dokument (under `public/boende/dokument/`).

Gemensamt lösenord för medlemmar, inga personliga konton. Rätt lösenord ger en
signerad cookie (`__Host-boende`; HttpOnly, Secure, SameSite=Lax, 30 dagar).
Byts `BOENDE_PASSWORD` eller `SESSION_SECRET` loggas alla ut.

## Köra lokalt

```bash
cp .dev.vars.example .dev.vars   # byt värdena; filen checkas inte in
npx wrangler@3 pages dev public --compatibility-date=2024-09-23
```

Öppna http://localhost:8788. Slumpa en hemlighet med `openssl rand -base64 48`.

## Hemligheter i hostingen (Cloudflare Pages)

Dashboard: *Workers & Pages → projektet → Settings → Variables and Secrets*,
lägg till som **Secret** (för både Production och Preview):

| Namn | Värde |
|---|---|
| `BOENDE_PASSWORD` | Medlemmarnas lösenord |
| `SESSION_SECRET` | Minst 32 slumpmässiga tecken |

Eller med CLI: `npx wrangler@3 pages secret put BOENDE_PASSWORD --project-name <projekt>`.
Saknas variablerna (eller är `SESSION_SECRET` kortare än 32 tecken) nekas hela
den låsta delen med 503. Den öppnas aldrig av misstag.

## Publicera på Cloudflare Pages

Så är demon uppsatt (`demo.danielssongentry.se`, DNS hos Hostinger):

1. Pages-projekt `brf-demo` kopplat till GitHub-repot (välj *Pages*, inte Workers; i
   dashboarden ligger det bakom länken "Continue to Pages").
2. Build command: *tomt*. Build output directory: `public`. Production branch: `main`.
3. Secrets `BOENDE_PASSWORD` och `SESSION_SECRET` under *Settings → Variables and
   Secrets* (Production). Kör *Retry deployment* efter ändring, annars gäller de inte.
4. Custom domain: *brf-demo → Custom domains → Set up a custom domain*. Hos
   DNS-leverantören läggs en CNAME `demo` → `brf-demo.pages.dev`.
5. GitHub Pages är avstängt för repot.

Varje push till `main` bygger och publicerar automatiskt.

## Begränsningar (medvetna)

- Repot är publikt. Dokumenten är låsta på sajten men syns i git-historiken.
  Demodokumenten är fiktiva. Riktiga dokument kräver privat repo eller
  separat lagring (t.ex. R2) bakom samma middleware.
- Skyddet mot gissning är en fast fördröjning (1,5 s) på varje felaktigt försök.
  Det hindrar inte parallella försök. Cloudflares WAF-regler för rate limiting
  kräver att hela domänen ligger hos Cloudflare, vilket den inte gör här (DNS hos
  Hostinger). För en kund: välj ett långt lösenord och bygg en spärr
  (t.ex. lås efter fem fel på 15 minuter) med Cloudflare KV, eller flytta DNS.
- Demon använder enkla värden. Hemligheter som visats i chatt eller dokument
  återanvänds aldrig åt en kund.
- Ett gemensamt lösenord kan inte återkallas per person. Byt lösenordet när någon
  flyttar eller lämnar styrelsen.

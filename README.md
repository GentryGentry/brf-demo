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

1. Skapa ett Pages-projekt kopplat till GitHub-repot.
2. Build command: *tomt*. Build output directory: `public`.
3. Lägg in secrets enligt ovan, deploya.
4. Först när det fungerar på `*.pages.dev`: peka `demo.danielssongentry.se` mot projektet
   (Custom domains) och stäng av GitHub Pages i repoinställningarna.

> Slå **inte** ihop till `main` så länge GitHub Pages är live. Sajten har flyttats
> till `public/`, och GitHub Pages skulle då både gå sönder och servera
> `public/boende/dokument/*` öppet på `/public/boende/dokument/...`.

## Begränsningar (medvetna)

- Repot är publikt. Dokumenten är låsta på sajten men syns i git-historiken.
  Demodokumenten är fiktiva. Riktiga dokument kräver privat repo eller
  separat lagring (t.ex. R2) bakom samma middleware.
- Skyddet mot gissning är en fast fördröjning (1,5 s) på varje felaktigt försök.
  Det hindrar inte parallella försök. För skarp drift: lägg en rate limiting-regel
  i Cloudflare (WAF) på `POST /boende/logga-in` och välj ett långt lösenord.
- Ett gemensamt lösenord kan inte återkallas per person. Byt lösenordet när någon
  flyttar eller lämnar styrelsen.

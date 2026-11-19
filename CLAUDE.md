# Actigate (ticketplatform) en de festival-POS demo

Deze repo bevat twee dingen:

1. **Actigate**: self-service ticketplatform van The Grape Agency. Een organisator maakt zelf een account, richt events en tickets in, zet zijn huisstijl erop, plakt een embed-code op zijn eigen site en verkoopt. Mappen: `start/` (landingspagina), `dashboard/`, `t/` (shop, ticketpagina, scanner, ontwerpsysteem), `embed.js`, `entree-config.js`.
2. **De oudere festival-POS demo**: `admin/`, `pos/`, `meekijk/`, `index.html`, `shop.html`, `tickets.html`. Gebouwde bestanden die `deploy.sh` vanaf Milans Mac uit een lokale map overschrijft. Niet met de hand aanpassen.

De technische namen heten nog `entree` (functies `entree_*`, edge function `entree`, `window.ENTREE`). Dat is bewust zo gelaten; alleen de zichtbare naam is Actigate.

## Waar het draait

- **actigate.nl**: Vercel-project `actigate` (team "thegrapeagency's projects"), gekoppeld aan deze repo. Elke merge naar `main` gaat direct live. `vercel.json` stuurt `/` door naar `/start/`. `www` stuurt door naar het hoofddomein. DNS staat bij Hostnet.
- **GitHub Pages** (`thegrapeagency.github.io/festival-pos-demo`): dezelfde bestanden, blijft bestaan voor de POS-demo en oudere links. Zet hier geen eigen domein op: dat verhuist ook de kassa-demo en breekt de hoogte-afstemming van shops die op het oude adres zijn ingebed.
- **Backend**: Supabase-project `nvdw-partnerportal`, schema `festival_pos`. De code staat in de repo `Thegrapeagency/Nachtvandewijn-website`: `supabase/migrations/2026111*_entree_*.sql`, `supabase/functions/entree/` (`index.ts`, `handler.ts`, `assistant.ts`) en de lokale testomgeving in `supabase/entree-dev/` (README met het volledige API-contract). Alles is uitgerold en gemerged.

## Voorkant

Statische HTML, CSS en vanilla JavaScript (ES-modules), geen build-stap, geen packages.

- `entree-config.js`: Supabase-adres, publieke sleutel, `BRAND_NAME`, `BASE_URL` (leeg = automatisch).
- `t/platform.css`: ontwerpsysteem. Petrol, crème en een zacht oranje accent. Barlow Condensed (vet, hoofdletters) voor koppen en Barlow voor tekst: robuust en stoer, niet chic. De signatuur is het kader: doorlopende lijnen met vakken en een oranje merkteken op de hoeken (zie `start/start.css`). Geen poort-ornament, ruiten of dubbele lijnen op nieuwe schermen. Het beeldmerk is een ticket met een getrapte poort (`t/platform.js`).
- Kleuren gebruik je via rollen, niet direct via het palet: `--ink`, `--ink2`, `--head`, `--link`, `--paper`, `--cream`, `--sand`, `--raise`, `--line`, `--edge-*`, `--on-dark`. Het blok `:root[data-theme="dark"]` zet ze om naar donker. Vaste petrolvlakken (bovenbalk, hero) gebruiken `--petrol-800/900/950` met `--on-dark` als tekstkleur.
- `t/theme.js`: licht of donker, volgt het apparaat en onthoudt een eigen keuze. Staat in de `<head>`.
- De shop, de ticketpagina en de scanner (`t/`) draaien in de huisstijl van de organisator en wisselen niet mee met licht en donker.
- `dashboard/js/`: `app.js` (kader en routes), `api.js`, `ui.js`, `store.js`, `auth.js`, `home.js`, `event.js`, `brand.js`, `palette.js`, `orders.js`, `payouts.js`, `assistant.js`, `tracking.js`, `voorbeeld.js`.
- Voorbeeldmodus: `dashboard/?voorbeeld=nieuw|actief|inloggen|aanmelden` toont het dashboard met voorbeelddata, zonder serververzoeken. Handig om schermen te bekijken en te screenshotten zonder backend.

## Backend in het kort

- Alle logica zit in Postgres-functies `festival_pos.entree_*` met één jsonb-parameter, `security definer`, met een eigen controle op de organisatie. Rechten: niets voor anonieme bezoekers, dashboardfuncties voor ingelogde gebruikers, de rest alleen voor de edge function.
- Edge function `entree`, acties via `?a=`: shop, order, status, demo-pay, webhook, scan, reset-request, reset-confirm, connect, disconnect, refund, resend, transfer, assistant.
- Een event dat niet live staat, is alleen met een voorbeeldlink te openen. Bestellingen daar zijn testbestellingen en tellen nergens in mee.
- Betalen: eigen Mollie-sleutel van de organisator, of via het platform met een wekelijkse uitbetaling. Dat laatste staat uit tot `ENTREE_MOLLIE_API_KEY` en `ENTREE_PLATFORM_PAYMENTS=on` bij de function staan.
- Chat-assistent in het dashboard (Claude, via de officiële SDK). Alleen ticketing: events, tickets, kortingscodes, huisstijl. Geen verwijderen, terugbetalen of betaalinstellingen; live zetten alleen via een bevestigknop. Begrensd per dag en per maand per organisatie.
- Trackinglinks (`via=<code>`) en ticket overdragen. Voor TicketSwap is geen openbare API gevonden; dat vraagt een partnerschap.

## Testen

In `Nachtvandewijn-website/supabase/entree-dev/`: een lokale Postgres plus `server.mjs` (nabootsing van Supabase, Mollie, mail en Claude). `./reset-db.sh`, daarna `node server.mjs`, daarna `api-test.mjs`, `e2e-public.mjs` en `e2e-dashboard.mjs`. Controleer gewijzigde JavaScript minstens met `node --check` en bekijk schermen in beide weergaven via de voorbeeldmodus.

## Schrijfstijl

Nederlands, je-vorm. Geen gedachtestreepjes in zinnen, geen clichés, geen retorische vragen. Concreet boven abstract. Beweer in de app niets over beveiliging of opslag wat de code niet waarmaakt.

## Open punten (stand 19 november 2026)

- `ENTREE_BASE_URL` staat nog niet op `https://actigate.nl`. Daardoor verwijzen ticketmails en wachtwoordmails nog naar het GitHub Pages-adres. Instellen als secret bij de edge function, of het standaardadres in `handler.ts` aanpassen en opnieuw uitrollen.
- Twee testorganisaties met de naam `Actigate rooktest …` en hun twee `rooktest-…@example.com`-logins staan nog in productie. Verwijderen is goedgekeurd, maar de bevestiging in Supabase verliep twee keer.
- Het Vercel-team staat op Hobby; voor een betaald platform is Pro nodig.
- Mailen vanaf `@actigate.nl` vraagt DNS-records van Resend. SPF staat nu op alleen Hostnet met `-all` en DMARC op `reject`.
- Wie platformbeheerder is, is niet nagekeken (`platform_admins` plus een rij in `admins`).
- Niet getest: een betaling met een echte Mollie-sleutel, een echte telefoon (iOS Safari, camera-scanner), de chat-assistent en de pop-ups in de donkere weergave.
- Nog te beslissen: of de assistent bij "verwijder" alleen uitlegt in plaats van het ticket op inactief te zetten, en of een overgedragen ticket ongeldig wordt als de oorspronkelijke bestelling wordt terugbetaald.
- Het record `*.actigate.nl` in de DNS is niet nodig.

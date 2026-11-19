// Voorbeeldmodus ("klantweergave"): het echte dashboard met verzonnen gegevens.
// Aan met ?voorbeeld=nieuw|actief|inloggen|aanmelden op de dashboard-URL. In deze modus
// gaat er geen enkel verzoek naar de server en blijft de echte sessie onaangeroerd:
// api.js stuurt alle aanroepen naar dit bestand, dat antwoordt uit gegevens in het geheugen.
// Alle cijfers (omzet, tellers, saldo) worden uit dezelfde lijst bestellingen berekend,
// met dezelfde regels als de server, zodat ze onderling altijd kloppen.
// Na herladen is alles weer zoals het begon.

const WAARDEN = ['nieuw', 'actief', 'inloggen', 'aanmelden'];
let gekozen = null;
try { gekozen = new URLSearchParams(location.search).get('voorbeeld'); } catch { /* geen adres: gewone modus */ }
export const VOORBEELD = WAARDEN.includes(gekozen) ? gekozen : null;
export const VOORBEELD_EMAIL = 'organisator@example.com';
const MELDING = 'Dit is een voorbeeld; hier gebeurt niets.';

// Een fout zoals de server hem zou geven. api.js maakt er een ApiError van.
class Fout { constructor(code, message) { this.code = code; this.message = message || ''; } }
const alleenVoorbeeld = (uitleg) => new Fout('voorbeeld', uitleg ? `${MELDING} ${uitleg}` : MELDING);

// ---------- kleine hulpjes ----------
const UUR = 36e5, DAG = 864e5;
const iso = (ms) => new Date(ms).toISOString();
const kopie = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const pauze = () => new Promise((r) => setTimeout(r, 90));
let teller = 0;
const nieuwId = (soort) => `vb-${soort}-${(++teller).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
// Vaste reeks "toevallige" getallen: elk tabblad begint met precies hetzelfde voorbeeld.
function reeks(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const middernacht = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
// De weekgrens van de uitbetaling: maandag 00:00.
const maandag = (ms) => { const d = new Date(middernacht(ms)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
const ymd = (ms) => { const d = new Date(ms), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
// De eerste zaterdag op of na een vaste dag, minstens een aantal dagen vooruit.
function zaterdag(maand, dag, uur, vooruit) {
  for (let jaar = new Date().getFullYear(); ; jaar++) {
    const d = new Date(jaar, maand, dag, uur, 0, 0, 0);
    d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
    if (d.getTime() > Date.now() + vooruit * DAG) return d.getTime();
  }
}
const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const tekens = (r, n, set) => Array.from({ length: n }, () => set[Math.floor(r() * set.length)]).join('');
const HEX = '0123456789abcdef', CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ---------- de gegevens ----------
let db = null;
let sessieMail = VOORBEELD_EMAIL;
function data() {
  if (!db) db = VOORBEELD === 'actief' ? bouwActief() : bouwNieuw('Stichting Zomerfeest');
  return db;
}

function leeg(orgNaam) {
  return {
    org: { id: 'vb-org', name: orgNaam, slug: slugify(orgNaam) || 'organisatie', contact_email: '' },
    payments: { payout_mode: 'own', has_key: false, key_mode: null, iban: '', holder: '' },
    fee_cents: 100,
    events: [], types: [], codes: [], scan_links: [], orders: [], links: [], payouts: [],
  };
}
function nieuwEvent(d, velden) {
  const basis = slugify(velden.name) || 'event';
  let slug = basis, n = 1;
  while (d.events.some((e) => e.slug === slug)) slug = `${basis}-${++n}`;
  const e = { id: nieuwId('event'), name: velden.name, slug, starts_at: null, ends_at: null, location: '', description: '', capacity: null,
    shop_live: false, archived: false, created_at: iso(Date.now()), shop: {}, preview_token: 'voorbeeld', ...velden, slug };
  d.events.push(e);
  return e;
}

// Direct na het aanmelden: één leeg concept met de naam van de organisatie, nog geen betaalkeuze.
function bouwNieuw(orgNaam) {
  const d = leeg(orgNaam);
  nieuwEvent(d, { name: orgNaam });
  return d;
}

const LOGO = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="22" fill="#c8553d"/><circle cx="60" cy="60" r="20" fill="#fbf6ec"/><g stroke="#fbf6ec" stroke-width="7" stroke-linecap="round"><path d="M60 16v12M60 92v12M16 60h12M92 60h12M29 29l8 8M83 83l8 8M91 29l-8 8M37 83l-8 8"/></g></svg>');
const VOORNAMEN = ['Sanne', 'Daan', 'Noor', 'Thijs', 'Lotte', 'Ruben', 'Fleur', 'Jesse', 'Iris', 'Bram', 'Maud', 'Koen', 'Esmee', 'Stijn', 'Yara', 'Luuk', 'Nina', 'Joris', 'Femke', 'Sem', 'Hanna', 'Tim', 'Merel', 'Gijs'];
const ACHTERNAMEN = ['de Boer', 'Visser', 'Bakker', 'van Dam', 'Smit', 'Mulder', 'de Groot', 'Bos', 'Vos', 'Peters', 'Hendriks', 'van Leeuwen', 'Dekker', 'Brouwer', 'de Wit', 'Dijkstra', 'Smits', 'de Graaf', 'van der Meer', 'Kok', 'Jacobs', 'Vermeulen', 'van den Berg', 'Postma'];
const DIEET = ['Vegetarisch', 'Geen noten', 'Glutenvrij', 'Veganistisch'];
const VRAAG_DIEET = 'Heb je dieetwensen?', VRAAG_NIEUWS = 'Houd me op de hoogte van volgende edities';

// Een bestelling doorrekenen zoals de server dat doet: korting over de regels waar de code voor geldt,
// servicekosten per persoon op betaalde tickets, en geen servicekosten als er niets te betalen is.
function reken(d, regels, code) {
  const type = (id) => d.types.find((t) => t.id === id);
  const sub = regels.reduce((s, i) => s + i.qty * i.unit_price_cents, 0);
  let korting = 0;
  if (code) {
    const geldig = regels.filter((i) => !code.applies_to || code.applies_to.includes(i.type_id)).reduce((s, i) => s + i.qty * i.unit_price_cents, 0);
    korting = code.kind === 'percent' ? Math.round(geldig * code.value / 100) : Math.min(code.value, geldig);
  }
  const personen = regels.filter((i) => i.unit_price_cents > 0).reduce((s, i) => s + i.qty * (type(i.type_id).admits || 1), 0);
  const fee = sub - korting > 0 ? personen * d.fee_cents : 0;
  return { discount_cents: korting, fee_cents: fee, total_cents: sub - korting + fee };
}

// Een actieve klant: een live event met verkopen via het platform, en een tweede event als concept.
function bouwActief() {
  const r = reeks(20270620);
  const nu = Date.now(), vandaag = middernacht(nu);
  const d = leeg('Stichting Zomerfeest');
  d.org.contact_email = 'info@example.com';
  d.payments = { payout_mode: 'platform', has_key: false, key_mode: null, iban: 'NL91ABNA0417164300', holder: 'Stichting Zomerfeest' };

  const start = zaterdag(5, 20, 14, 30);
  const dagLabel = new Date(start).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase());
  const ev = nieuwEvent(d, {
    id: 'vb-event-zomerfeest', name: 'Zomerfeest in het Park', starts_at: iso(start), ends_at: iso(start + 9 * UUR), location: 'Stadspark, Parkweg 1, Voorbeeldstad',
    description: 'Een middag en avond met livemuziek, eten van lokale koks en spelletjes voor jong en oud. Neem je eigen kleed mee.',
    capacity: 600, shop_live: true, created_at: iso(vandaag - 31 * DAG + 10 * UUR),
    shop: {
      brand: { primary: '#c8553d', bg: '#fbf6ec', surface: '#ffffff', text: '#23302b', font_heading: 'Fraunces', font_body: 'DM Sans', radius: 14, logo_url: LOGO, layout: 'list' },
      intro: 'Koop hier je tickets voor het Zomerfeest. Kinderen tot en met 12 jaar mogen gratis mee, maar hebben wel een eigen ticket nodig.',
      ticket_note: 'Laat je ticket bij de ingang scannen. Het terrein gaat om 13:30 uur open.',
      website_url: 'https://example.com', contact_email: 'info@example.com', lang: 'nl', show_remaining: true,
      fields: [{ key: 'vdieet', label: VRAAG_DIEET, type: 'text', required: false, options: [] }, { key: 'vnieuws', label: VRAAG_NIEUWS, type: 'checkbox', required: false, options: [] }],
    },
  });
  const soort = (id, name, price_cents, capacity, extra) => {
    const t = { id, event_id: ev.id, name, description: '', price_cents, capacity, min_per_order: 1, max_per_order: 10, admits: 1, hidden: false, vat_rate: 9,
      valid_label: dagLabel, active: true, sort: d.types.length + 1, sale_starts_at: null, sale_ends_at: null, ...extra };
    d.types.push(t);
    return t;
  };
  const vroeg = soort('vb-type-vroeg', 'Early bird', 1750, 60, { description: 'Voor de snelle beslissers. Op is op.' });
  const regulier = soort('vb-type-regulier', 'Regulier', 2250, 400, { description: 'Toegang voor één persoon.' });
  const duo = soort('vb-type-duo', 'Duoticket', 4000, 50, { description: 'Eén ticket voor twee personen.', admits: 2, max_per_order: 5 });
  const kind = soort('vb-type-kind', 'Kinderticket', 0, 100, { description: 'Voor kinderen tot en met 12 jaar, alleen samen met een volwassene.', max_per_order: 6 });
  const gast = soort('vb-type-gast', 'Gastenlijst', 0, 40, { description: 'Alleen zichtbaar met de code voor genodigden.', hidden: true, max_per_order: 2 });

  const vroeg10 = { id: 'vb-code-vroeg10', event_id: ev.id, code: 'VROEG10', kind: 'percent', value: 10, max_uses: null, used_count: 0, active: true, starts_at: null, ends_at: iso(vandaag - 16 * DAG), applies_to: null };
  const zomer5 = { id: 'vb-code-zomer5', event_id: ev.id, code: 'ZOMER5', kind: 'amount', value: 500, max_uses: 25, used_count: 0, active: true, starts_at: null, ends_at: null, applies_to: [regulier.id] };
  const gasten = { id: 'vb-code-gasten', event_id: ev.id, code: 'GENODIGD', kind: 'percent', value: 100, max_uses: 40, used_count: 0, active: true, starts_at: null, ends_at: null, applies_to: [gast.id] };
  d.codes.push(vroeg10, zomer5, gasten);

  d.scan_links.push(
    { id: 'vb-scan-1', event_id: ev.id, label: 'Hoofdingang', token: tekens(r, 24, HEX), active: true, last_used_at: null },
    { id: 'vb-scan-2', event_id: ev.id, label: 'Ingang parkeerterrein', token: tekens(r, 24, HEX), active: true, last_used_at: null });

  const link = (code, label, clicks, dagen) => ({ id: 'vb-link-' + code, event_id: ev.id, code, label, clicks, created_at: iso(vandaag - dagen * DAG + 9 * UUR) });
  d.links.push(link('instagram-bio', 'Instagram-bio', 438, 27), link('nieuwsbrief', 'Nieuwsbrief', 264, 27), link('poster-met-qr', 'Poster met QR', 92, 24), link('partnerpagina', 'Partnerpagina', 57, 20));

  const bestelling = (wanneer, regels, opt = {}) => {
    const naam = `${VOORNAMEN[Math.floor(r() * VOORNAMEN.length)]} ${ACHTERNAMEN[Math.floor(r() * ACHTERNAMEN.length)]}`;
    const som = reken(d, regels, opt.code);
    const betaald = opt.status === 'pending' ? null : wanneer + (40 + Math.floor(r() * 140)) * 1000;
    const o = {
      id: nieuwId('order'), event_id: ev.id, order_token: tekens(r, 32, HEX), status: opt.status || 'paid', is_test: !!opt.test,
      buyer_name: naam, buyer_email: slugify(naam).replace(/-/g, '.') + '@example.com', ...som, discount_code: opt.code ? opt.code.code : null,
      created_at: iso(wanneer), paid_at: betaald ? iso(betaald) : null, refunded_at: null, custom: opt.custom || {}, source: opt.source || 'shop',
      tracking_code: opt.via || null, mail_sent_at: betaald ? iso(betaald + 4000) : null, payout_id: null, refund_payout_id: null,
      items: regels.map((i) => ({ ...i })), tickets: [],
    };
    if (betaald) for (const i of regels) for (let k = 0; k < i.qty; k++) o.tickets.push({ id: nieuwId('ticket'), code: tekens(r, 12, CODE), status: 'valid', holder_name: naam, used_at: null, type_id: i.type_id });
    if (opt.code && betaald && !opt.test) opt.code.used_count++;
    d.orders.push(o);
    return o;
  };
  const regel = (t, qty) => ({ type_id: t.id, name: t.name, qty, unit_price_cents: t.price_cents });

  // Verkoop van de afgelopen weken: een drukke start met early birds, daarna een rustige stroom.
  const PER_DAG = [5, 6, 4, 3, 3, 2, 2, 1, 2, 3, 1, 1, 2, 0, 2, 1, 3, 2, 1, 2, 1, 2, 3, 2, 2, 1, 2];
  let vroegOver = vroeg.capacity;
  PER_DAG.forEach((aantal, idx) => {
    const terug = PER_DAG.length - 1 - idx;
    for (let k = 0; k < aantal; k++) {
      let wanneer = vandaag - terug * DAG + (8 + r() * 14.5) * UUR;
      if (wanneer > nu - 30 * 60000) wanneer = nu - (30 + r() * 150) * 60000;
      const basis = () => (vroegOver > 0 ? vroeg : regulier);
      const neem = (t, qty) => { if (t === vroeg) { qty = Math.min(qty, vroegOver); vroegOver -= qty; } return regel(t, qty); };
      const x = r();
      let regels, code = null;
      if (x < 0.5) regels = [neem(basis(), [1, 2, 2, 2, 3, 4][Math.floor(r() * 6)])];
      else if (x < 0.68) regels = [regel(duo, r() < 0.85 ? 1 : 2)];
      else if (x < 0.84) regels = [neem(basis(), 2), regel(kind, 1 + Math.floor(r() * 2))];
      else if (terug >= 17) { regels = [neem(basis(), 1 + Math.floor(r() * 2))]; code = vroeg10; }
      else { regels = [regel(regulier, 1 + Math.floor(r() * 2))]; code = zomer5; }
      const v = r();
      const via = v < 0.3 ? 'instagram-bio' : v < 0.52 ? 'nieuwsbrief' : v < 0.6 ? (terug <= 24 ? 'poster-met-qr' : null) : v < 0.66 ? (terug <= 20 ? 'partnerpagina' : null) : null;
      const custom = {};
      if (r() < 0.2) custom[VRAAG_DIEET] = DIEET[Math.floor(r() * DIEET.length)];
      if (r() < 0.45) custom[VRAAG_NIEUWS] = true;
      bestelling(wanneer, regels, { code, via, custom, source: via === 'instagram-bio' || via === 'poster-met-qr' ? 'shop' : r() < 0.45 ? 'embed' : 'shop' });
    }
  });

  // Uitbetalingen van de twee vorige weken. Wat daarna betaald is, staat nog open als saldo.
  const grens = maandag(nu);
  const betaalUit = (tot) => {
    const set = d.orders.filter((o) => o.status === 'paid' && !o.is_test && !o.payout_id && Date.parse(o.paid_at) < tot);
    if (!set.length) return;
    const klaar = tot + DAG + 10.2 * UUR;
    const p = { id: nieuwId('payout'), amount_cents: set.reduce((s, o) => s + o.total_cents - o.fee_cents, 0), orders: set.length, created_at: iso(klaar),
      reference: `ENTREE-${ymd(klaar).replace(/-/g, '')}-${tekens(r, 6, HEX).toUpperCase()}`, iban: d.payments.iban };
    set.forEach((o) => { o.payout_id = p.id; });
    d.payouts.push(p);
  };
  betaalUit(grens - 14 * DAG);
  betaalUit(grens - 7 * DAG);

  // Eén terugbetaalde bestelling (nog niet uitbetaald, dus zonder gevolgen voor eerdere uitbetalingen).
  const open = d.orders.filter((o) => o.status === 'paid' && !o.payout_id && !o.discount_code);
  const terug = open.find((o) => Date.parse(o.paid_at) < nu - 2 * DAG) || open[0];
  if (terug) {
    terug.status = 'refunded';
    terug.refunded_at = iso(Math.min(nu - 20 * 60000, Date.parse(terug.paid_at) + 1.6 * DAG));
    terug.tickets.forEach((t) => { t.status = 'void'; });
  }
  // Eén bestelling die nog op de betaling wacht, en de testbestelling van de organisator zelf.
  bestelling(nu - 14 * 60000, [regel(regulier, 2)], { status: 'pending', source: 'embed' });
  const test = bestelling(vandaag - 28 * DAG + 16.4 * UUR, [regel(regulier, 1)], { test: true });
  test.buyer_name = 'Test Bestelling'; test.buyer_email = VOORBEELD_EMAIL; test.tickets.forEach((t) => { t.holder_name = test.buyer_name; });

  // Tweede event: een concept dat nog niet af is.
  const bios = zaterdag(7, 22, 20, 30);
  const ev2 = nieuwEvent(d, { id: 'vb-event-bioscoop', name: 'Openluchtbioscoop in het Park', starts_at: iso(bios), ends_at: null, location: 'Stadspark, Parkweg 1, Voorbeeldstad',
    description: '', created_at: iso(vandaag - 3 * DAG + 15 * UUR) });
  d.types.push({ id: 'vb-type-bios', event_id: ev2.id, name: 'Regulier', description: 'Toegang voor één persoon.', price_cents: 1250, capacity: 150, min_per_order: 1, max_per_order: 10, admits: 1, hidden: false, vat_rate: 9,
    valid_label: '', active: true, sort: 1, sale_starts_at: null, sale_ends_at: null });
  return d;
}

// ---------- afgeleide cijfers (zelfde regels als de server) ----------
const telt = (o) => o.status === 'paid' && !o.is_test;
const netto = (o) => o.total_cents - o.fee_cents;
const geldig = (o) => o.tickets.filter((t) => t.status !== 'void').length;
function betaalwijze(d) {
  const p = d.payments;
  if (p.payout_mode === 'platform') return p.iban && p.holder ? 'platform' : 'none';
  return p.has_key ? p.key_mode || 'live' : 'none';
}
function verkocht(d, typeId) {
  const kort = Date.now() - 30 * 60000;
  return d.orders.filter((o) => !o.is_test && (o.status === 'paid' || (o.status === 'pending' && Date.parse(o.created_at) > kort)))
    .reduce((s, o) => s + o.items.filter((i) => i.type_id === typeId).reduce((n, i) => n + i.qty, 0), 0);
}
const eigenEvent = (d, id) => { const e = d.events.find((x) => x.id === id); if (!e) throw new Fout('forbidden'); return e; };
const typeUit = (d, t) => ({ id: t.id, name: t.name, description: t.description, price_cents: t.price_cents, capacity: t.capacity, min_per_order: t.min_per_order, max_per_order: t.max_per_order,
  admits: t.admits, hidden: t.hidden, vat_rate: t.vat_rate, valid_label: t.valid_label, active: t.active, sort: t.sort, sale_starts_at: t.sale_starts_at, sale_ends_at: t.sale_ends_at,
  sold: verkocht(d, t.id), has_orders: d.orders.some((o) => o.items.some((i) => i.type_id === t.id)) });
const orderRij = (o) => ({ id: o.id, ref: o.order_token.slice(0, 8).toUpperCase(), status: o.status, is_test: o.is_test, buyer_name: o.buyer_name, buyer_email: o.buyer_email,
  total_cents: o.total_cents, fee_cents: o.fee_cents, discount_cents: o.discount_cents, discount_code: o.discount_code, created_at: o.created_at, paid_at: o.paid_at, custom: o.custom, source: o.source,
  items: o.items.map((i) => ({ name: i.name, qty: i.qty, unit_price_cents: i.unit_price_cents })), tickets: o.tickets.length, used: o.tickets.filter((t) => t.status === 'used').length });
function saldo(d, tot) {
  return d.orders.filter((o) => telt(o) && !o.payout_id && (tot == null || Date.parse(o.paid_at) < tot)).reduce((s, o) => s + netto(o), 0);
}

// ---------- de functies van het dashboard ----------
const RPC = {
  entree_state(d) {
    const p = d.payments;
    return {
      role: 'admin', org: { ...d.org, ticketing: true },
      payments: { mode: betaalwijze(d), payout_mode: p.payout_mode, has_key: p.has_key, key_mode: p.key_mode, iban: p.iban, holder: p.holder, platform_available: true },
      is_platform: false, fee_cents: d.fee_cents,
      events: d.events.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map((e) => {
        const paid = d.orders.filter((o) => o.event_id === e.id && telt(o));
        const brand = (e.shop && e.shop.brand) || {};
        return { id: e.id, name: e.name, slug: e.slug, starts_at: e.starts_at, ends_at: e.ends_at, location: e.location, shop_live: e.shop_live, archived: e.archived, created_at: e.created_at,
          logo_url: brand.logo_url || null, primary: brand.primary || null, types: d.types.filter((t) => t.event_id === e.id && t.active).length,
          tickets: paid.reduce((s, o) => s + geldig(o), 0), revenue_cents: paid.reduce((s, o) => s + netto(o), 0) };
      }),
    };
  },
  entree_org_save(d, p) {
    const naam = String(p.name || '').trim();
    if (naam) d.org.name = naam.slice(0, 80);
    if ('contact_email' in p) {
      const m = String(p.contact_email || '').trim().toLowerCase();
      if (m && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)) throw new Fout('bad_email');
      d.org.contact_email = m;
    }
    return { ok: true };
  },
  entree_event_save(d, p) {
    if (!p.id) {
      const naam = String(p.name || '').trim().slice(0, 80);
      if (!naam) throw new Fout('name_required');
      const e = nieuwEvent(d, { name: naam, starts_at: p.starts_at || null, ends_at: p.ends_at || null, location: String(p.location || ''), description: String(p.description || ''), capacity: p.capacity ?? null, shop: p.shop || {} });
      return { ok: true, id: e.id, slug: e.slug };
    }
    const e = eigenEvent(d, p.id);
    if ('name' in p) { const naam = String(p.name || '').trim().slice(0, 80); if (!naam) throw new Fout('name_required'); e.name = naam; }
    for (const k of ['starts_at', 'ends_at', 'capacity']) if (k in p) e[k] = p[k] ?? null;
    for (const k of ['location', 'description']) if (k in p) e[k] = String(p[k] || '');
    if ('shop' in p) e.shop = kopie(p.shop) || {};
    if ('archived' in p) { e.archived = !!p.archived; if (e.archived) e.shop_live = false; }
    if ('shop_live' in p) {
      if (p.shop_live) {
        const aan = d.types.filter((t) => t.event_id === e.id && t.active);
        if (!aan.length) throw new Fout('no_types');
        if (aan.some((t) => t.price_cents > 0) && betaalwijze(d) === 'none') throw new Fout('no_payments');
      }
      e.shop_live = !!p.shop_live;
    }
    return { ok: true, id: e.id, slug: e.slug };
  },
  entree_event_get(d, p) {
    const e = eigenEvent(d, p.event_id);
    const orders = d.orders.filter((o) => o.event_id === e.id), paid = orders.filter(telt);
    const dagen = new Map();
    const sinds = Date.now() - 60 * DAG;
    for (const o of paid) {
      if (Date.parse(o.paid_at) <= sinds) continue;
      const k = ymd(Date.parse(o.paid_at)), rij = dagen.get(k) || { day: k, tickets: 0, revenue_cents: 0 };
      rij.tickets += o.items.reduce((s, i) => s + i.qty, 0); rij.revenue_cents += netto(o);
      dagen.set(k, rij);
    }
    return {
      event: kopie({ id: e.id, name: e.name, slug: e.slug, starts_at: e.starts_at, ends_at: e.ends_at, location: e.location, description: e.description, capacity: e.capacity,
        shop_live: e.shop_live, archived: e.archived, shop: e.shop, preview_token: e.preview_token }),
      types: d.types.filter((t) => t.event_id === e.id).sort((a, b) => a.sort - b.sort).map((t) => typeUit(d, t)),
      codes: d.codes.filter((c) => c.event_id === e.id).map(({ event_id, ...c }) => c),
      scan_links: d.scan_links.filter((l) => l.event_id === e.id).map(({ event_id, ...l }) => l),
      stats: {
        orders: paid.length, revenue_cents: paid.reduce((s, o) => s + netto(o), 0), fee_cents: paid.reduce((s, o) => s + o.fee_cents, 0),
        refunded: orders.filter((o) => o.status === 'refunded' && !o.is_test).length, test_orders: orders.filter((o) => o.is_test && o.status === 'paid').length,
        tickets: paid.reduce((s, o) => s + geldig(o), 0), checked_in: paid.reduce((s, o) => s + o.tickets.filter((t) => t.status === 'used').length, 0),
        by_day: [...dagen.values()].sort((a, b) => a.day.localeCompare(b.day)),
      },
      pay_mode: betaalwijze(d), fee_cents: d.fee_cents,
    };
  },
  entree_type_save(d, p) {
    const VELDEN = ['name', 'description', 'price_cents', 'capacity', 'min_per_order', 'max_per_order', 'admits', 'hidden', 'vat_rate', 'valid_label', 'active', 'sort', 'sale_starts_at', 'sale_ends_at'];
    let t = p.id ? d.types.find((x) => x.id === p.id) : null;
    if (p.id && !t) throw new Fout('forbidden');
    const naam = String((p.name ?? (t && t.name)) || '').trim().slice(0, 80);
    if (!naam) throw new Fout('name_required');
    const prijs = Number(p.price_cents ?? (t ? t.price_cents : 0));
    if (!(prijs >= 0 && prijs <= 1000000)) throw new Fout('bad_price');
    if (Number(p.min_per_order ?? 1) > Number(p.max_per_order ?? 50)) throw new Fout('min_above_max');
    if (!t) {
      const e = eigenEvent(d, p.event_id);
      const eigen = d.types.filter((x) => x.event_id === e.id);
      t = { id: nieuwId('type'), event_id: e.id, name: naam, description: '', price_cents: 0, capacity: null, min_per_order: 1, max_per_order: 10, admits: 1, hidden: false, vat_rate: 9, valid_label: '',
        active: true, sort: eigen.reduce((m, x) => Math.max(m, x.sort), 0) + 1, sale_starts_at: null, sale_ends_at: null };
      d.types.push(t);
    }
    for (const k of VELDEN) if (k in p && p[k] !== undefined) t[k] = p[k];
    t.name = naam; t.price_cents = prijs;
    return { ok: true, id: t.id };
  },
  entree_type_delete(d, p) {
    const t = d.types.find((x) => x.id === p.id);
    if (!t) throw new Fout('forbidden');
    if (d.orders.some((o) => o.items.some((i) => i.type_id === t.id))) { t.active = false; return { ok: true, archived: true }; }
    d.types = d.types.filter((x) => x !== t);
    return { ok: true, archived: false };
  },
  entree_code_save(d, p) {
    let c = p.id ? d.codes.find((x) => x.id === p.id) : null;
    if (p.id && !c) throw new Fout('forbidden');
    const e = eigenEvent(d, c ? c.event_id : p.event_id);
    const code = String(p.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,30}$/.test(code)) throw new Fout('bad_code_format');
    if (d.codes.some((x) => x !== c && x.event_id === e.id && x.code === code)) throw new Fout('code_exists');
    const waarde = Number(p.value);
    if (!(waarde > 0) || (p.kind === 'percent' && waarde > 100)) throw new Fout('bad_value');
    if (!c) { c = { id: nieuwId('code'), event_id: e.id, used_count: 0 }; d.codes.push(c); }
    Object.assign(c, { code, kind: p.kind === 'amount' ? 'amount' : 'percent', value: waarde, max_uses: p.max_uses ?? null, active: p.active !== false, starts_at: p.starts_at || null, ends_at: p.ends_at || null,
      applies_to: Array.isArray(p.applies_to) && p.applies_to.length ? p.applies_to.slice() : null });
    return { ok: true, id: c.id };
  },
  entree_code_delete(d, p) { d.codes = d.codes.filter((c) => c.id !== p.id); return { ok: true }; },
  entree_scanlink_save(d, p) {
    if ((p.action || 'create') === 'create') {
      const e = eigenEvent(d, p.event_id);
      if (d.scan_links.filter((l) => l.event_id === e.id).length >= 25) throw new Fout('too_many');
      d.scan_links.push({ id: nieuwId('scan'), event_id: e.id, label: String(p.label || 'Ingang').trim().slice(0, 60) || 'Ingang', token: tekens(Math.random, 24, HEX), active: true, last_used_at: null });
      return { ok: true };
    }
    const l = d.scan_links.find((x) => x.id === p.id);
    if (!l) throw new Fout('forbidden');
    if (p.action === 'delete') d.scan_links = d.scan_links.filter((x) => x !== l);
    else { if (p.label != null) l.label = String(p.label).trim().slice(0, 60) || l.label; if (p.active != null) l.active = !!p.active; }
    return { ok: true };
  },
  entree_orders(d, p) {
    const e = eigenEvent(d, p.event_id);
    const q = String(p.q || '').trim().toLowerCase(), status = p.status || null;
    const limit = Math.min(Number(p.limit) || 50, 5000), offset = Math.max(Number(p.offset) || 0, 0);
    const lijst = d.orders.filter((o) => o.event_id === e.id
      && ((status == null && ['paid', 'refunded', 'pending'].includes(o.status)) || (status === 'test' && o.is_test) || o.status === status)
      && (status === 'test' || !o.is_test)
      && (!q || o.buyer_name.toLowerCase().includes(q) || o.buyer_email.toLowerCase().includes(q) || o.order_token.startsWith(q) || o.tickets.some((t) => t.code.toLowerCase().startsWith(q))))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return { total: lijst.length, orders: lijst.slice(offset, offset + limit).map(orderRij) };
  },
  entree_order_get(d, p) {
    const o = d.orders.find((x) => x.id === p.order_id);
    if (!o) throw new Fout('forbidden');
    const naam = (id) => (d.types.find((t) => t.id === id) || {}).name || '';
    return { ...orderRij(o), order_token: o.order_token, refunded_at: o.refunded_at, mail_sent_at: o.mail_sent_at, has_payment: o.total_cents > 0,
      tickets: o.tickets.map((t) => ({ id: t.id, code: t.code, status: t.status, holder_name: t.holder_name, used_at: t.used_at, type: naam(t.type_id) })) };
  },
  entree_ticket_set(d, p) {
    let t = null;
    for (const o of d.orders) { t = o.tickets.find((x) => x.id === p.ticket_id); if (t) break; }
    if (!t) throw new Fout('forbidden');
    const a = p.action;
    if (a === 'void') t.status = 'void';
    else if (a === 'restore' && t.status === 'void') { t.status = 'valid'; t.used_at = null; }
    else if (a === 'checkin' && t.status === 'valid') { t.status = 'used'; t.used_at = iso(Date.now()); }
    else if (a === 'undo_checkin' && t.status === 'used') { t.status = 'valid'; t.used_at = null; }
    else throw new Fout('bad_action');
    return { ok: true };
  },
  entree_payout_save(d, p) {
    if (p.mode === 'platform') {
      const iban = String(p.iban || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), houder = String(p.holder || '').trim();
      if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) throw new Fout('bad_iban');
      if (houder.length < 2) throw new Fout('bad_holder');
      Object.assign(d.payments, { payout_mode: 'platform', iban, holder: houder });
      return { ok: true, mode: 'platform' };
    }
    d.payments.payout_mode = 'own';
    // Zonder sleutel kunnen betaalde tickets niet meer verkocht worden: die events gaan offline, net als op de server.
    if (betaalwijze(d) === 'none') d.events.forEach((e) => { if (d.types.some((t) => t.event_id === e.id && t.active && t.price_cents > 0)) e.shop_live = false; });
    return { ok: true, mode: 'own' };
  },
  entree_payouts(d) {
    const grens = maandag(Date.now());
    return { balance_cents: saldo(d, null), next_cents: saldo(d, grens), next_date: ymd(grens + 7 * DAG + 12 * UUR),
      history: d.payouts.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map((x) => ({ ...x })) };
  },
  entree_tracking(d, p) {
    const e = eigenEvent(d, p.event_id);
    const paid = d.orders.filter((o) => o.event_id === e.id && telt(o));
    const links = d.links.filter((l) => l.event_id === e.id);
    const codes = new Set(links.map((l) => l.code));
    const los = paid.filter((o) => o.source !== 'transfer' && (!o.tracking_code || !codes.has(o.tracking_code)));
    return {
      links: links.map((l) => {
        const eigen = paid.filter((o) => o.tracking_code === l.code);
        return { id: l.id, code: l.code, label: l.label, clicks: l.clicks, created_at: l.created_at, orders: eigen.length, tickets: eigen.reduce((s, o) => s + geldig(o), 0), revenue_cents: eigen.reduce((s, o) => s + netto(o), 0) };
      }),
      untracked: { orders: los.length, revenue_cents: los.reduce((s, o) => s + netto(o), 0) },
    };
  },
  entree_tracking_save(d, p) {
    const label = String(p.label || '').trim().slice(0, 60);
    if ((p.action || 'create') === 'create') {
      const e = eigenEvent(d, p.event_id);
      if (!label) throw new Fout('name_required');
      const eigen = d.links.filter((l) => l.event_id === e.id);
      if (eigen.length >= 100) throw new Fout('too_many');
      let basis = slugify(p.code || label).slice(0, 36);
      if (basis.length < 2) basis = 'link';
      let code = basis, n = 1;
      while (eigen.some((l) => l.code === code)) code = `${basis}-${++n}`;
      const l = { id: nieuwId('link'), event_id: e.id, code, label, clicks: 0, created_at: iso(Date.now()) };
      d.links.push(l);
      return { ok: true, id: l.id, code };
    }
    const l = d.links.find((x) => x.id === p.id);
    if (!l) throw new Fout('forbidden');
    if (p.action === 'delete') d.links = d.links.filter((x) => x !== l);
    else { if (!label) throw new Fout('name_required'); l.label = label; }
    return { ok: true, id: l.id, code: l.code };
  },
  entree_assistant_check() { return { enabled: true, daily_limit: 40, remaining_today: 40, platform_budget_left: true }; },
  // Platformbeheer bestaat in het voorbeeld niet: een klant ziet dat ook niet.
  entree_platform_payouts() { throw new Fout('forbidden'); },
  entree_platform_payout_pay() { throw new Fout('forbidden'); },
};

// Acties die buiten dit tabblad iets zouden doen. In het voorbeeld gebeurt er niets.
const FN = {
  connect: 'Bij een echte klant controleren we hier de Mollie-sleutel en koppelen we het account.',
  disconnect: 'Bij een echte klant wordt de Mollie-sleutel hier verwijderd.',
  refund: 'Bij een echte klant boeken we het bedrag terug en worden de tickets ongeldig.',
  resend: 'Bij een echte klant krijgt de koper de ticketmail opnieuw.',
  transfer: 'Bij een echte klant krijgt de nieuwe houder een nieuw ticket per mail.',
  assistant: 'De assistent antwoordt in het voorbeeld niet. Bij een echte klant voert hij uit wat je hier typt.',
  'reset-request': 'Bij een echte klant sturen we een mail met een link om een nieuw wachtwoord te kiezen.',
  'reset-confirm': 'Bij een echte klant wordt hier het nieuwe wachtwoord opgeslagen.',
};

// ---------- wat api.js aanroept ----------
export async function voorbeeldRpc(naam, p) {
  await pauze();
  const job = RPC[naam];
  if (!job) throw alleenVoorbeeld();
  return kopie(job(data(), kopie(p) || {}));
}
export async function voorbeeldFn(actie) {
  await pauze();
  throw alleenVoorbeeld(FN[actie]);
}
export async function voorbeeldUpload() {
  await pauze();
  throw alleenVoorbeeld('Bij een echte klant wordt het bestand hier geüpload.');
}
// Inloggen en aanmelden vanaf het voorbeeldscherm: je komt in het dashboard van een nieuwe klant.
export async function voorbeeldLogin(email) {
  await pauze();
  sessieMail = email || VOORBEELD_EMAIL;
  data();
  return sessieMail;
}
export async function voorbeeldSignup(orgNaam, email) {
  await pauze();
  sessieMail = email || VOORBEELD_EMAIL;
  db = bouwNieuw(String(orgNaam || '').trim().slice(0, 80) || 'Stichting Zomerfeest');
}

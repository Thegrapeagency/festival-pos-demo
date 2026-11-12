// Alle communicatie met de server: sessie, dashboard-functies, uploads.
const C = window.ENTREE || {};
export const SB = String(C.SUPABASE_URL || '').replace(/\/+$/, '');
export const ANON = C.ANON_KEY || '';
export const FN = SB + '/functions/v1/entree';
export const BASE = String(C.BASE_URL || (location.origin + location.pathname.replace(/\/dashboard(\/.*)?$/, ''))).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const GENERIC = 'Er ging iets mis. Probeer het opnieuw.';
const NETWORK = 'Geen verbinding met de server. Controleer je internet en probeer het opnieuw.';
const LOST = 'Je sessie is verlopen. Log opnieuw in.';

// Foutcodes van de server in gewone taal.
const ERR = {
  forbidden: 'Je hebt hier geen toegang toe.',
  'permission denied': 'Je hebt hier geen toegang toe.',
  name_required: 'Vul een naam in.',
  no_types: 'Je kunt pas live als er minstens één ticket actief is. Voeg een ticket toe of zet er een aan.',
  no_payments: 'Je hebt betaalde tickets, maar nog geen betalingen gekoppeld. Koppel eerst je Mollie-account bij Instellingen.',
  code_exists: 'Deze code bestaat al bij dit event. Kies een andere code.',
  bad_code_format: 'Een code bestaat uit 2 tot 30 letters, cijfers, streepjes of underscores, zonder spaties.',
  bad_value: 'Vul een korting in die groter is dan 0. Een percentage is maximaal 100.',
  min_above_max: 'Het minimum per bestelling is hoger dan het maximum.',
  bad_price: 'Vul een prijs in tussen € 0 en € 10.000.',
  bad_date: 'Een van de datums klopt niet. Kies de datum opnieuw.',
  not_paid: 'Alleen betaalde bestellingen kun je terugbetalen.',
  too_many: 'Je hebt het maximum van 25 scanlinks bereikt. Verwijder er eerst een.',
  bad_action: 'Dat kan niet met dit ticket. Laad de bestelling opnieuw en probeer het nog een keer.',
  bad_email: 'Vul een geldig e-mailadres in.',
  bad_key: 'Dit lijkt geen Mollie API-sleutel. Hij begint met live_ of test_.',
  rate_limited: 'Te veel pogingen. Probeer het over een paar minuten opnieuw.',
  'invalid input': 'Een van de ingevulde waarden klopt niet. Controleer de getallen en datums.',
  'out of range': 'Een van de getallen is te groot.',
  violates: 'Een van de ingevulde waarden is niet toegestaan. Controleer het formulier.',
};
export function explain(code) {
  const c = String(code || '');
  for (const k of Object.keys(ERR)) if (c.includes(k)) return ERR[k];
  return GENERIC;
}

// ---------- sessie ----------
const KEY = 'entree_session';
function read() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
let session = read();
let lostCb = null;
export function onSessionLost(cb) { lostCb = cb; }
export function hasSession() { return !!(session && session.access_token); }
export function sessionEmail() { return session ? session.email || '' : ''; }

function store(tok) {
  session = {
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    expires_at: Date.now() + (Number(tok.expires_in) || 3600) * 1000,
    email: (tok.user && tok.user.email) || (session && session.email) || '',
  };
  try { localStorage.setItem(KEY, JSON.stringify(session)); } catch { /* privémodus: sessie alleen in dit tabblad */ }
}
function drop(notify) {
  const had = !!session;
  session = null;
  try { localStorage.removeItem(KEY); } catch { /* niets */ }
  if (notify && had && lostCb) lostCb();
}

async function http(url, init) {
  try { return await fetch(url, init); } catch { throw new ApiError('network', NETWORK); }
}
async function parse(r) {
  const text = await r.text();
  try { return text ? JSON.parse(text) : null; } catch { return null; }
}

let refreshing = null;
function refresh() {
  if (!refreshing) {
    refreshing = (async () => {
      // Een ander tabblad kan de sessie al ververst hebben.
      const other = read();
      if (other && session && other.access_token !== session.access_token && other.expires_at - Date.now() > 60000) { session = other; return; }
      if (!session || !session.refresh_token) { drop(true); throw new ApiError('session', LOST); }
      const r = await http(SB + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      if (!r.ok) {
        if (r.status >= 400 && r.status < 500) { drop(true); throw new ApiError('session', LOST); }
        throw new ApiError('server', GENERIC);
      }
      store(await r.json());
    })().finally(() => { refreshing = null; });
  }
  return refreshing;
}
async function token() {
  if (!session) throw new ApiError('session', LOST);
  if (session.expires_at - Date.now() < 60000) await refresh();
  return session.access_token;
}

async function authed(url, init) {
  for (let attempt = 0; ; attempt++) {
    const t = await token();
    const r = await http(url, { ...init, headers: { ...(init.headers || {}), apikey: ANON, Authorization: 'Bearer ' + t } });
    const body = await parse(r);
    const msg = (body && body.message) || '';
    // "permission denied" krijg je ook als de server het token niet meer herkent: één keer verversen.
    const expired = r.status === 401 || /JWT/i.test(msg) || (attempt === 0 && /permission denied/i.test(msg));
    if (expired && attempt === 0) { session.expires_at = 0; await refresh(); continue; }
    if (expired) { drop(true); throw new ApiError('session', LOST); }
    return { r, body };
  }
}

// ---------- login ----------
const pub = { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' };
const sentence = (s) => typeof s === 'string' && /\s/.test(s);

export async function login(email, password) {
  const r = await http(SB + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  const body = await parse(r);
  if (!r.ok || !body || !body.access_token) {
    throw new ApiError('login', r.status === 400 || r.status === 401 ? 'Het e-mailadres of wachtwoord klopt niet.' : r.status === 429 ? ERR.rate_limited : GENERIC);
  }
  store(body);
}
export async function signup(org_name, email, password, website) {
  const r = await http(SB + '/functions/v1/signup', {
    method: 'POST', headers: pub,
    body: JSON.stringify({ org_name, event_name: '', email, password, modules: ['ticketing'], website: website || '' }),
  });
  const body = await parse(r);
  if (!r.ok || !body || !body.ok) throw new ApiError('signup', body && sentence(body.error) ? body.error : GENERIC);
}
export async function logout() {
  const t = session && session.access_token;
  drop(false);
  if (t) { try { await fetch(SB + '/auth/v1/logout', { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + t } }); } catch { /* lokaal al uitgelogd */ } }
}

// ---------- functies ----------
export async function rpc(name, p = {}) {
  const { r, body } = await authed(`${SB}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Profile': 'festival_pos' }, body: JSON.stringify({ p }),
  });
  if (!r.ok) throw new ApiError((body && body.message) || 'http_' + r.status, explain(body && body.message));
  return body;
}
function fnError(r, body) {
  const code = (body && (body.code || body.error)) || 'http_' + r.status;
  return new ApiError(code, body && sentence(body.error) ? body.error : explain(code));
}
export async function fn(action, payload = {}) {
  const { r, body } = await authed(`${FN}?a=${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!r.ok) throw fnError(r, body);
  return body || {};
}
export async function fnPublic(action, payload = {}) {
  const r = await http(`${FN}?a=${action}`, { method: 'POST', headers: pub, body: JSON.stringify(payload) });
  const body = await parse(r);
  if (!r.ok) throw fnError(r, body);
  return body || {};
}
export async function upload(orgId, filename, blob, mime) {
  const path = `${encodeURIComponent(orgId)}/${encodeURIComponent(filename)}`;
  const { r } = await authed(`${SB}/storage/v1/object/shop-assets/${path}`, { method: 'POST', headers: { 'Content-Type': mime, 'x-upsert': 'true' }, body: blob });
  if (!r.ok) throw new ApiError('upload', r.status === 413 ? 'Dit bestand is te groot. Kies een kleiner bestand.' : 'Het uploaden lukte niet. Probeer het opnieuw.');
  return `${SB}/storage/v1/object/public/shop-assets/${path}`;
}

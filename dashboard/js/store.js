// Gedeelde toestand van het dashboard.
import { rpc, BASE } from './api.js';

export const S = {
  state: null,        // antwoord van entree_state
  ev: null,           // antwoord van entree_event_get voor het open event
  evId: null,
  render: () => {},   // wordt gezet door app.js
  brandDrafts: new Map(),   // onopgeslagen huisstijl per event
  fieldDrafts: new Map(),   // onopgeslagen vragen per event
  payoutHistory: false,     // er zijn eerdere uitbetalingen (ook als de organisator nu eigen Mollie gebruikt)
};

export async function loadState() {
  S.state = await rpc('entree_state');
  // Wie eerder via het platform is uitbetaald en nu eigen Mollie gebruikt, houdt zijn uitbetalingen in het menu.
  const p = S.state.payments || {};
  if (!S.payoutHistory && !S.payoutChecked && p.payout_mode !== 'platform' && p.iban) {
    S.payoutChecked = true;
    rpc('entree_payouts').then((d) => {
      if (d && ((d.history && d.history.length) || d.balance_cents)) { S.payoutHistory = true; if (!document.querySelector('.modal-back') && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) S.render(); }
    }).catch(() => {});
  }
  return S.state;
}
export async function loadEvent(id) {
  const d = await rpc('entree_event_get', { event_id: id });
  S.ev = d; S.evId = id;
  return d;
}
// Betalingen zijn geregeld bij een eigen Mollie-sleutel (test of live) of bij uitbetaling via het platform.
export const payReady = (mode) => mode === 'live' || mode === 'test' || mode === 'platform';
export const showPayouts = () => !!(S.state && S.state.payments && (S.state.payments.payout_mode === 'platform' || S.payoutHistory));
export const isPlatformAdmin = () => !!(S.state && S.state.is_platform === true);
export function go(hash) { if (location.hash === hash) S.render(); else location.hash = hash; }
export const shopUrl = (slug) => `${BASE}/t/?e=${encodeURIComponent(slug)}`;
export const previewUrl = (ev) => `${shopUrl(ev.slug)}&preview=${encodeURIComponent(ev.preview_token || '')}`;
export const scanUrl = (token) => `${BASE}/t/scan.html?k=${encodeURIComponent(token)}`;
export const ticketUrl = (token) => `${BASE}/t/ticket.html?order=${encodeURIComponent(token)}`;

const mem = {};
export const local = {
  get(k) { try { return localStorage.getItem(k); } catch { return mem[k] || null; } },
  set(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch { /* alleen in geheugen */ } },
};

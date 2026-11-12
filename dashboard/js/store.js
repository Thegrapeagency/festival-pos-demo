// Gedeelde toestand van het dashboard.
import { rpc, BASE } from './api.js';

export const S = {
  state: null,        // antwoord van entree_state
  ev: null,           // antwoord van entree_event_get voor het open event
  evId: null,
  render: () => {},   // wordt gezet door app.js
  brandDrafts: new Map(),   // onopgeslagen huisstijl per event
  fieldDrafts: new Map(),   // onopgeslagen vragen per event
};

export async function loadState() { S.state = await rpc('entree_state'); return S.state; }
export async function loadEvent(id) {
  const d = await rpc('entree_event_get', { event_id: id });
  S.ev = d; S.evId = id;
  return d;
}
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

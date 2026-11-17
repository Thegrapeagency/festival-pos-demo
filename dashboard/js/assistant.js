// De chat-assistent: een knop rechtsonder en een paneel waarin de organisator typt
// wat hij wil regelen. De server voert het uit; live zetten of pauzeren vraagt hier
// altijd een klik. Antwoorden worden als platte tekst getoond, nooit als HTML.
import { rpc, fn } from './api.js';
import { h, icon, ornament, notice, BRAND } from './ui.js';
import { S, loadState } from './store.js';

const MAX_CHARS = 1000;      // de server weigert langere berichten
const WARN_AT = 900;
const KEEP = 30;             // zoveel berichten bewaren we in dit tabblad
const LOW = 10;              // onder dit aantal tonen we wat er vandaag nog over is
const TIMEOUT = 75000;
const STORE = 'entree_assistant_chat';
const EXAMPLES = [
  'Maak een ticket voor de zaterdag van € 75, 700 beschikbaar',
  'Laat de early birds twee weken langer lopen',
  'Zet de kleur van mijn shop op #1F5F68',
  'Maak een kortingscode VROEG10 voor 10% korting',
];
const BLOCKED = {
  daily_limit: ['Je berichten voor vandaag zijn op. Morgen kun je weer verder.', 'Niet beschikbaar'],
  budget: ['De assistent is deze maand niet meer beschikbaar. In het dashboard kun je alles zelf instellen.', 'Niet beschikbaar'],
  disabled: ['De assistent staat op dit moment uit.', 'Niet beschikbaar'],
};

let status = null;       // null = nog niet gevraagd, 'pending', of het antwoord van entree_assistant_check
let checkSeq = 0;
let msgs = [];           // { id, role, kind: 'text'|'error'|'confirm'|'brand', text, ... }
let owner = null;        // organisatie waar het gesprek bij hoort
let open = false;
let busy = false;
let blocked = null;      // sleutel uit BLOCKED
let remaining = null;
let pending = null;      // AbortController van het lopende verzoek
let ui = null;
let idSeq = 0;

const mobile = () => window.matchMedia('(max-width:640px)').matches;
const newId = () => 'm' + Date.now().toString(36) + (++idSeq);

// ---------- bewaren (alleen in dit tabblad) ----------
function persist() {
  if (msgs.length > KEEP) msgs = msgs.slice(-KEEP);
  try { sessionStorage.setItem(STORE, JSON.stringify({ owner, msgs })); } catch { /* dan alleen in het geheugen */ }
}
function restore(org) {
  if (owner === org) return;
  owner = org; msgs = [];
  try {
    const d = JSON.parse(sessionStorage.getItem(STORE));
    if (d && d.owner === org && Array.isArray(d.msgs)) {
      msgs = d.msgs.filter((m) => m && typeof m.text === 'string' && (m.role === 'user' || m.role === 'assistant')).slice(-KEEP);
      // een bevestiging die halverwege was, kan opnieuw
      msgs.forEach((m) => { if (m.confirm && m.confirm.state === 'busy') m.confirm.state = 'open'; });
    }
  } catch { /* niets bewaard */ }
}
function forget() {
  msgs = [];
  try { sessionStorage.removeItem(STORE); } catch { /* niets */ }
}

// ---------- waar kijkt de organisator naar ----------
function route() {
  const parts = (location.hash || '#/').replace(/^#\/?/, '').split('/');
  return { page: parts[0] || 'home', id: parts[1] || '', tab: parts[2] || 'overzicht' };
}
function currentEvent() {
  const r = route();
  if (r.page !== 'event' || !r.id || S.evId !== r.id || !S.ev || !S.ev.event) return null;
  return { id: r.id, name: S.ev.event.name || '' };
}

// ---------- opbouw ----------
function build() {
  const fab = h('button', { class: 'assist-fab', type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': 'assist-panel', onclick: () => setOpen(true) },
    ornament('mark', 'assist-fab-orn'), h('span', null, `Vraag het ${BRAND}`));

  const fresh = h('button', { class: 'assist-new', type: 'button', onclick: newChat }, icon('plus', 15), h('span', null, 'Nieuw gesprek'));
  const close = h('button', { class: 'icon-btn assist-close', type: 'button', 'aria-label': 'Assistent sluiten', title: 'Sluiten', onclick: () => setOpen(false) }, icon('x', 20));
  const head = h('header', { class: 'assist-head' },
    h('div', { class: 'assist-title' }, ornament('mark', 'assist-title-orn'), h('h2', { id: 'assist-title' }, 'Assistent')), fresh, close);

  const emptyEl = h('div', { class: 'assist-empty' },
    ornament('burst', 'assist-burst'),
    h('h3', null, 'Zeg wat je wilt regelen'),
    h('p', { class: 'assist-lead' }, 'Typ in gewone woorden wat er moet veranderen aan je tickets, kortingscodes, eventgegevens of huisstijl, dan pas ik het voor je aan.'),
    h('p', { class: 'assist-label', id: 'assist-ex' }, 'Voorbeelden om mee te beginnen'),
    h('ul', { class: 'assist-examples', 'aria-labelledby': 'assist-ex' }, EXAMPLES.map((t) => h('li', null,
      h('button', { type: 'button', class: 'assist-example', onclick: () => useExample(t) }, h('span', null, t), icon('right', 15))))),
    h('div', { class: 'assist-limits' },
      h('p', null, h('strong', null, 'Wat ik niet doe: '), 'iets verwijderen, terugbetalen of je betaalinstellingen wijzigen. Dat doe je zelf in het dashboard.'),
      h('p', null, 'De verkoop live zetten of pauzeren stel ik alleen voor. Het gebeurt pas als jij op Bevestigen klikt.')));
  const log = h('div', { class: 'assist-log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions', 'aria-label': 'Gesprek met de assistent' });
  const live = h('div', { class: 'sr', role: 'status' });
  const typing = h('div', { class: 'assist-msg is-assistant assist-typing', hidden: true },
    h('span', { class: 'assist-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
    h('span', { class: 'assist-wait', hidden: true }, 'Dit kan tot een halve minuut duren.'));
  const scroll = h('div', { class: 'assist-scroll', tabindex: '0', 'aria-label': 'Berichten' }, emptyEl, log, typing, live);

  const input = h('textarea', { id: 'assist-input', rows: '1', placeholder: 'Typ wat je wilt regelen', 'aria-describedby': 'assist-hint assist-count', autocomplete: 'off' });
  const sendBtn = h('button', { class: 'assist-send', type: 'submit', 'aria-label': 'Bericht versturen', title: 'Versturen' }, icon('send', 19));
  const form = h('form', { class: 'assist-form', novalidate: true, onsubmit: (e) => { e.preventDefault(); send(); } },
    h('label', { class: 'sr', for: 'assist-input' }, 'Je bericht aan de assistent'), input, sendBtn);
  const ctx = h('p', { class: 'assist-ctx', hidden: true });
  const hint = h('span', { id: 'assist-hint' }, 'Enter verstuurt, Shift+Enter is een nieuwe regel');
  const left = h('span', { class: 'assist-left', hidden: true });
  const count = h('span', { id: 'assist-count', class: 'assist-count', 'aria-live': 'polite' });
  const meta = h('div', { class: 'assist-meta' }, h('span', { class: 'assist-meta-l' }, left, hint), count);
  const block = h('div', { class: 'assist-block', role: 'status', hidden: true });
  const foot = h('div', { class: 'assist-foot' }, block, ctx, form, meta);

  const panel = h('aside', { class: 'assist', id: 'assist-panel', role: 'dialog', 'aria-labelledby': 'assist-title', hidden: true }, head, scroll, foot);
  const root = h('div', { class: 'assist-root', hidden: true }, fab, panel);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });
  input.addEventListener('input', paintComposer);
  panel.addEventListener('keydown', (e) => {
    // Op een telefoon vult het paneel het scherm: houd de focus er dan in.
    if (e.key !== 'Tab' || !mobile()) return;
    const f = [...panel.querySelectorAll('a[href],button:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  // Een link in het gesprek opent een pagina van het dashboard; op een telefoon moet het paneel dan weg.
  log.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('a[href^="#"]') && mobile()) setOpen(false, false); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !open || e.defaultPrevented || document.querySelector('.modal-back')) return;
    const a = document.activeElement;
    const elsewhere = a && !panel.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
    if (!elsewhere) setOpen(false);
  });

  document.body.append(root);
  ui = { root, fab, panel, scroll, emptyEl, log, typing, live, meta, input, sendBtn, ctx, hint, left, count, block, fresh, close, nodes: new Map(), waitTimer: null };
}

// ---------- tekenen ----------
function bubble(m) {
  if (m.kind === 'confirm') return confirmCard(m);
  if (m.kind === 'brand') return brandCard(m);
  const cls = 'assist-msg ' + (m.role === 'user' ? 'is-user' : 'is-assistant') + (m.kind === 'error' ? ' is-error' : '');
  const who = h('span', { class: 'sr' }, m.role === 'user' ? 'Jij: ' : m.kind === 'error' ? 'Melding: ' : 'Assistent: ');
  const text = h('span', { class: 'assist-text' });
  text.textContent = m.text; // altijd platte tekst
  return h('div', { class: cls }, who, text);
}

function confirmCard(m) {
  const c = m.confirm, name = c.event_name || 'je event';
  const title = c.live ? `Verkoop van ${name} live zetten` : `Verkoop van ${name} pauzeren`;
  const card = h('div', { class: 'assist-card is-' + c.state }, h('h3', null, title));
  if (c.state === 'done') {
    card.append(h('p', { class: 'assist-card-ok' }, icon('check', 16), c.live ? 'Je shop staat live. Kopers kunnen nu bestellen.' : 'De verkoop is gepauzeerd.'));
    return card;
  }
  if (c.state === 'cancelled') {
    card.append(h('p', { class: 'muted' }, 'Geannuleerd. Er is niets gewijzigd.'));
    return card;
  }
  card.append(h('p', null, c.live ? 'Vanaf dat moment kan iedereen met de link tickets kopen.' : 'Kopers zien dan dat de verkoop nog niet open is. Bestaande tickets blijven geldig.'));
  if (c.state === 'failed') {
    card.append(
      c.code === 'no_types' ? notice('warn', h('strong', null, 'Live zetten kan nog niet. '), 'Er staat geen enkel ticket aan. Voeg een ticket toe of zet er een aan. ', h('a', { href: `#/event/${c.event_id}/tickets` }, 'Naar Tickets'))
        : c.code === 'no_payments' ? notice('warn', h('strong', null, 'Live zetten kan nog niet. '), 'Je hebt betaalde tickets, maar je hebt nog niet gekozen hoe je betaald wilt worden. Kies voor een wekelijkse uitbetaling of koppel je eigen Mollie-account. Je kunt je tickets ook gratis maken. ', h('a', { href: '#/settings' }, 'Betalingen regelen'))
          : notice('warn', c.note || 'Dat lukte niet. Probeer het opnieuw.'));
  }
  const yes = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => confirmLive(m, yes) }, c.state === 'failed' ? 'Opnieuw proberen' : 'Bevestigen');
  const no = h('button', { class: 'btn', type: 'button', onclick: () => { c.state = 'cancelled'; persist(); repaint(m); focusInput(); } }, 'Annuleren');
  if (c.state === 'busy') { yes.disabled = true; yes.classList.add('is-busy'); no.disabled = true; }
  card.append(h('div', { class: 'assist-card-actions' }, no, yes));
  return card;
}

function brandCard(m) {
  const card = h('div', { class: 'assist-card is-brand' }, h('h3', null, 'De huisstijl is aangepast'));
  if (m.done) { card.append(h('p', { class: 'assist-card-ok' }, icon('check', 16), 'De huisstijl is herladen.')); return card; }
  card.append(h('p', null, m.text));
  card.append(h('div', { class: 'assist-card-actions' }, h('button', { class: 'btn', type: 'button', onclick: () => {
    S.brandDrafts.delete(m.event_id);
    m.done = true; persist(); repaint(m);
    if (S.evId === m.event_id) S.render();
    focusInput();
  } }, 'Huisstijl herladen')));
  return card;
}

// Alleen toevoegen wat nieuw is, zodat een schermlezer niet het hele gesprek opnieuw voorleest.
function paintLog() {
  const ids = new Set(msgs.map((m) => m.id));
  for (const [id, node] of ui.nodes) if (!ids.has(id)) { node.remove(); ui.nodes.delete(id); }
  for (const m of msgs) if (!ui.nodes.has(m.id)) { const n = bubble(m); ui.nodes.set(m.id, n); ui.log.append(n); }
  ui.emptyEl.hidden = msgs.length > 0 || busy;
  ui.fresh.disabled = !msgs.length || busy;
}
function repaint(m) {
  const old = ui.nodes.get(m.id);
  if (!old) return;
  const n = bubble(m);
  ui.nodes.set(m.id, n); old.replaceWith(n);
}
function toBottom() { ui.scroll.scrollTop = ui.scroll.scrollHeight; }

function paintComposer() {
  const { input, sendBtn, count, left, hint, block, ctx } = ui;
  const n = input.value.length, over = n - MAX_CHARS;
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight + 2, 150) + 'px';
  count.textContent = over > 0 ? `${over} ${over === 1 ? 'teken' : 'tekens'} te lang` : n >= WARN_AT ? `${n} van ${MAX_CHARS} tekens` : '';
  count.className = 'assist-count' + (over > 0 ? ' is-over' : n >= WARN_AT ? ' is-warn' : '');
  if (over > 0) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  input.disabled = !!blocked;
  sendBtn.disabled = !!blocked || busy || over > 0 || !input.value.trim();
  sendBtn.classList.toggle('is-busy', busy);
  block.hidden = !blocked;
  if (blocked) block.replaceChildren(notice('info', BLOCKED[blocked][0]));
  input.placeholder = blocked ? BLOCKED[blocked][1] : 'Typ wat je wilt regelen';
  const low = !blocked && remaining != null && remaining < LOW;
  left.hidden = !low; hint.hidden = low;
  ui.meta.hidden = !!blocked;
  if (low) left.textContent = remaining === 1 ? 'Nog 1 bericht vandaag' : `Nog ${remaining} berichten vandaag`;
  const ev = currentEvent();
  ctx.hidden = !ev || !!blocked;
  if (ev) ctx.replaceChildren(h('span', null, 'Je kijkt naar '), h('strong', null, ev.name));
}

function setBusy(v) {
  busy = v;
  ui.typing.hidden = !v;
  ui.live.textContent = v ? 'De assistent is bezig met je antwoord.' : '';
  const wait = ui.typing.querySelector('.assist-wait');
  wait.hidden = true;
  clearTimeout(ui.waitTimer);
  if (v) ui.waitTimer = setTimeout(() => { wait.hidden = false; toBottom(); }, 6000);
  paintLog(); paintComposer();
}

function focusInput() {
  if (!open) return;
  if (blocked) ui.close.focus(); else ui.input.focus({ preventScroll: true });
}

function setOpen(v, focus = true) {
  open = v;
  ui.panel.hidden = !v;
  ui.fab.hidden = v;
  ui.fab.setAttribute('aria-expanded', String(v));
  document.body.classList.toggle('has-assist', v);
  if (v) { paintLog(); paintComposer(); if (msgs.length) toBottom(); if (focus) focusInput(); }
  else if (focus && !ui.root.hidden) ui.fab.focus();
}

// ---------- acties ----------
function push(m) {
  m.id = newId();
  msgs.push(m);
  persist(); paintLog(); toBottom();
  return m;
}

function useExample(text) {
  ui.input.value = text;
  paintComposer();
  ui.input.focus();
  ui.input.setSelectionRange(text.length, text.length);
}

function newChat() {
  if (busy) return;
  forget(); paintLog(); paintComposer();
  ui.scroll.scrollTop = 0;
  focusInput();
}

// Alleen geslaagde beurten gaan als geheugen mee, als platte tekst.
function history() {
  return msgs.filter((m) => m.kind === 'text' && !m.failed).map((m) => ({ role: m.role, content: m.text }));
}

async function send() {
  const text = ui.input.value.trim();
  if (busy || blocked || !text || ui.input.value.length > MAX_CHARS) return;
  const ev = currentEvent();
  const payload = { message: text, history: history() };
  if (ev) payload.event_id = ev.id;
  const mine = push({ role: 'user', kind: 'text', text });
  ui.input.value = '';
  setBusy(true); toBottom();

  const ctrl = new AbortController();
  pending = ctrl;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, TIMEOUT);
  try {
    const d = await fn('assistant', payload, { signal: ctrl.signal });
    if (pending !== ctrl) return; // uitgelogd of gewist terwijl het antwoord onderweg was
    if (typeof d.remaining_today === 'number') remaining = d.remaining_today;
    const confirm = d.confirm && d.confirm.action === 'set_live' && d.confirm.event_id ? d.confirm : null;
    const reply = String(d.reply == null ? '' : d.reply).trim();
    if (reply || !confirm) push({ role: 'assistant', kind: 'text', text: reply || 'Daar heb ik geen antwoord op. Probeer het in andere woorden.' });
    if (confirm) push({ role: 'assistant', kind: 'confirm', text: '', confirm: { event_id: String(confirm.event_id), live: confirm.live === true, event_name: String(confirm.event_name || ''), state: 'open' } });
    if (Array.isArray(d.changed) && d.changed.length) await refreshChanged(d.changed.map(String));
  } catch (e) {
    if (pending !== ctrl || (e && e.code === 'session')) return;
    mine.failed = true;
    const code = String((e && e.code) || '');
    if (timedOut) {
      push({ role: 'assistant', kind: 'error', text: 'Het antwoord bleef te lang weg. Het kan zijn dat je opdracht wel is uitgevoerd. Kijk dat eerst na voordat je het opnieuw vraagt.' });
      loadState().then(() => softRender()).catch(() => {});
    } else {
      push({ role: 'assistant', kind: 'error', text: (e && e.message) || 'Er ging iets mis. Probeer het opnieuw.' });
      if (BLOCKED[code]) blocked = code;
      // geen verbinding: zet de tekst terug zodat je hem niet opnieuw hoeft te typen
      else if (code === 'network' && !ui.input.value) ui.input.value = text;
    }
  } finally {
    clearTimeout(timer);
    if (pending === ctrl) {
      pending = null;
      if (remaining === 0 && !blocked) blocked = 'daily_limit';
      persist();
      setBusy(false); toBottom();
      const a = document.activeElement;
      if (open && (!a || a === document.body || ui.panel.contains(a))) focusInput();
    }
  }
}

async function confirmLive(m, btn) {
  const c = m.confirm;
  if (c.state === 'busy' || btn.disabled) return;
  c.state = 'busy'; repaint(m);
  try {
    await rpc('entree_event_save', { id: c.event_id, shop_live: c.live });
    c.state = 'done';
  } catch (e) {
    if (e && e.code === 'session') return;
    const code = String((e && e.code) || '');
    c.state = 'failed';
    c.code = code.includes('no_types') ? 'no_types' : code.includes('no_payments') ? 'no_payments' : '';
    c.note = (e && e.message) || '';
  }
  persist(); repaint(m); toBottom();
  if (c.state === 'done') await refreshChanged([c.event_id]);
  focusInput();
}

// ---------- het dashboard verversen na een wijziging ----------
// De huisstijl zonder de vragen: daar gaat een concept op de huisstijlpagina over.
function shopSig(d) {
  const shop = { ...((d && d.event && d.event.shop) || {}) };
  delete shop.fields;
  return JSON.stringify(shop);
}
// Opnieuw tekenen, maar niet onder een open venster of terwijl je op de pagina zelf iets typt.
function softRender() {
  const a = document.activeElement;
  const typing = a && !ui.panel.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
  if (document.querySelector('.modal-back') || typing) return;
  S.render();
}
async function refreshChanged(ids) {
  const evId = S.evId;
  let shopChanged = false;
  const state = loadState().catch(() => {});
  if (evId && ids.includes(evId)) {
    try {
      const d = await rpc('entree_event_get', { event_id: evId });
      if (S.evId === evId) { shopChanged = shopSig(d) !== shopSig(S.ev); S.ev = d; }
    } catch { if (S.evId === evId) { S.evId = null; S.ev = null; } }
  }
  await state;
  if (!ui) return;
  const draft = evId && S.brandDrafts.get(evId);
  if (shopChanged && draft && draft.dirty) {
    // Eigen conceptwijzigingen niet stilzwijgend overschrijven: de organisator kiest zelf.
    push({ role: 'assistant', kind: 'brand', event_id: evId,
      text: 'Je hebt bij Huisstijl zelf nog onopgeslagen wijzigingen. Die heb ik laten staan, dus je ziet mijn aanpassing daar nog niet. Herlaad je de huisstijl, dan zie je hem wel en vervallen je eigen concepten. Sla je jouw concept op, dan vervangt dat mijn aanpassing.' });
    const r = route();
    if (r.page === 'event' && r.id === evId && r.tab === 'huisstijl') return;
  }
  softRender();
}

// ---------- aan en uit ----------
function check() {
  if (status) return;
  status = 'pending';
  const my = ++checkSeq;
  rpc('entree_assistant_check').then((d) => {
    if (my !== checkSeq) return;
    status = d && d.enabled === true ? d : { enabled: false };
    if (status.enabled) {
      remaining = typeof d.remaining_today === 'number' ? d.remaining_today : null;
      blocked = d.platform_budget_left === false ? 'budget' : remaining === 0 ? 'daily_limit' : null;
    }
    assistantSync(lastAllowed);
  }).catch(() => { if (my === checkSeq) status = { enabled: false }; });
}

let lastAllowed = false;
// Wordt na elke keer tekenen aangeroepen door app.js.
export function assistantSync(allowed) {
  lastAllowed = !!allowed;
  if (!allowed) { if (ui) { ui.root.hidden = true; document.body.classList.remove('has-assist'); } return; }
  check();
  if (!status || status === 'pending' || !status.enabled) { if (ui) ui.root.hidden = true; return; }
  if (!ui) build();
  restore(S.state && S.state.org ? S.state.org.id : '');
  ui.root.hidden = false;
  document.body.classList.toggle('has-assist', open);
  paintLog(); paintComposer();
}

// Uitloggen of een verlopen sessie: gesprek weg, bij de volgende login opnieuw vragen of de assistent aan staat.
export function assistantReset() {
  checkSeq++;
  if (pending) { const p = pending; pending = null; p.abort(); }
  status = null; owner = null; blocked = null; remaining = null; busy = false; open = false; lastAllowed = false;
  forget();
  document.body.classList.remove('has-assist');
  if (ui) { clearTimeout(ui.waitTimer); ui.root.remove(); ui = null; }
}

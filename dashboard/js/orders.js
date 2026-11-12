// Tab Bestellingen: zoeken, filteren, detail, terugbetalen en export.
import { rpc, fn } from './api.js';
import { h, icon, toast, guard, badge, notice, empty, spinner, openModal, confirmDialog, euro, num, fmtDate, fmtShort, debounce, download } from './ui.js';
import { S, loadEvent, loadState, ticketUrl } from './store.js';

const PAGE = 25;
const FILTERS = [['', 'Alle'], ['paid', 'Betaald'], ['refunded', 'Terugbetaald'], ['pending', 'Openstaand'], ['test', 'Test']];
const STATUS = { paid: ['Betaald', 'green'], refunded: ['Terugbetaald', 'grey'], pending: ['Openstaand', 'amber'], canceled: ['Geannuleerd', 'grey'], expired: ['Verlopen', 'grey'] };
const SOURCE = { shop: 'Shoplink', embed: 'Shop op je site' };
const view = { evId: null, q: '', status: '', offset: 0 };

function statusBadges(o) {
  const [label, kind] = STATUS[o.status] || ['Onbekend', 'grey'];
  return [badge(label, kind), o.is_test ? badge('Test', 'purple') : null];
}
const lines = (o) => (o.items || []).map((i) => `${i.qty}x ${i.name}`).join(', ');
const answer = (v) => (v === true ? 'Ja' : v === false ? 'Nee' : v == null ? '' : String(v));

export function tabOrders() {
  const e = S.ev.event;
  if (view.evId !== e.id) Object.assign(view, { evId: e.id, q: '', status: '', offset: 0 });
  const listEl = h('div', { class: 'orders-list', 'aria-live': 'polite' }, spinner('Bestellingen laden'));
  const pager = h('div', { class: 'pager' });
  let seq = 0;

  async function load() {
    const my = ++seq;
    listEl.classList.add('is-loading');
    let r;
    try { r = await rpc('entree_orders', { event_id: e.id, q: view.q, status: view.status || null, limit: PAGE, offset: view.offset }); }
    catch (ex) {
      if (my !== seq || ex.code === 'session') return;
      listEl.classList.remove('is-loading');
      listEl.replaceChildren(h('div', { class: 'card pad' }, notice('warn', ex.message), h('div', { class: 'form-actions start' }, h('button', { class: 'btn', type: 'button', onclick: load }, 'Opnieuw proberen'))));
      return;
    }
    if (my !== seq || !listEl.isConnected) return;
    listEl.classList.remove('is-loading');
    if (!r.orders.length) {
      pager.replaceChildren();
      listEl.replaceChildren(h('div', { class: 'card' }, view.q || view.status
        ? empty('search', 'Niets gevonden', 'Er zijn geen bestellingen die bij je zoekopdracht of filter passen.', h('button', { class: 'btn', type: 'button', onclick: () => { view.q = ''; view.status = ''; view.offset = 0; S.render(); } }, 'Filters wissen'))
        : empty('list', 'Nog geen bestellingen', 'Zodra iemand tickets koopt, staat de bestelling hier. Doe een testbestelling via het voorbeeld van je shop om te zien hoe het werkt.')));
      return;
    }
    listEl.replaceChildren(h('div', { class: 'card otable' },
      h('div', { class: 'orow ohead', 'aria-hidden': 'true' }, ['Bestelling', 'Koper', 'Tickets', 'Totaal', 'Status'].map((t) => h('span', null, t))),
      r.orders.map((o) => h('button', { class: 'orow', type: 'button', onclick: () => orderModal(o.id, load) },
        h('span', { class: 'o-ref' }, h('strong', { class: 'mono' }, o.ref), h('small', null, fmtShort(o.paid_at || o.created_at))),
        h('span', { class: 'o-buyer' }, h('strong', null, o.buyer_name), h('small', null, o.buyer_email)),
        h('span', { class: 'o-items' }, h('span', null, lines(o) || 'Geen regels'), o.tickets ? h('small', null, `${o.used} van ${o.tickets} ingecheckt`) : null),
        h('span', { class: 'o-total' }, euro(o.total_cents)),
        h('span', { class: 'o-status' }, statusBadges(o))))));
    const from = view.offset + 1, to = view.offset + r.orders.length;
    const prev = h('button', { class: 'btn btn-sm', type: 'button', disabled: view.offset === 0, onclick: () => { view.offset = Math.max(0, view.offset - PAGE); load(); } }, icon('left', 15), 'Vorige');
    const next = h('button', { class: 'btn btn-sm', type: 'button', disabled: to >= r.total, onclick: () => { view.offset += PAGE; load(); } }, 'Volgende', icon('right', 15));
    pager.replaceChildren(...[h('span', { class: 'muted' }, `${num(from)} tot ${num(to)} van ${num(r.total)}`), r.total > PAGE ? h('div', { class: 'row' }, prev, next) : null].filter(Boolean));
  }

  const search = h('input', { type: 'search', value: view.q, placeholder: 'Zoek op naam, e-mail, bestelnummer of ticketcode', 'aria-label': 'Bestellingen zoeken' });
  search.addEventListener('input', debounce(() => { view.q = search.value.trim(); view.offset = 0; load(); }, 280));
  const chips = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Filter op status' }, FILTERS.map(([k, l]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(view.status === k), class: 'chip' + (view.status === k ? ' is-on' : ''), onclick: (ev) => {
    view.status = k; view.offset = 0;
    chips.querySelectorAll('.chip').forEach((c) => { const on = c === ev.currentTarget; c.classList.toggle('is-on', on); c.setAttribute('aria-checked', String(on)); });
    load();
  } }, l)));
  const exp = h('button', { class: 'btn', type: 'button', onclick: () => guard(exp, () => exportCsv(e)) }, icon('download', 16), 'Exporteer CSV');
  load();
  return h('div', { class: 'stack' },
    h('div', { class: 'tab-head' }, h('div', null, h('h2', null, 'Bestellingen'), h('p', { class: 'muted' }, 'Klik op een bestelling voor de tickets, de antwoorden en terugbetalen.')), exp),
    h('div', { class: 'orders-tools' }, h('div', { class: 'search' }, icon('search', 17), search), chips),
    listEl, pager);
}

// ---------- detail ----------
function orderModal(id, onChange) {
  let changed = false;
  const m = openModal({ title: 'Bestelling', side: true, body: spinner('Bestelling laden'), onClose: () => { if (changed) { onChange(); loadEvent(S.evId).catch(() => {}); loadState().catch(() => {}); } } });
  const act = async (btn, job, msg) => { const r = await guard(btn, job); if (r !== undefined) { changed = true; if (msg) toast(msg); await draw(); } return r; };

  async function draw() {
    let o;
    try { o = await rpc('entree_order_get', { order_id: id }); }
    catch (ex) { if (ex.code !== 'session') m.setBody(notice('warn', ex.message)); return; }
    const sub = (o.items || []).reduce((t, i) => t + i.qty * i.unit_price_cents, 0);
    const custom = Object.entries(o.custom || {}).filter(([, v]) => v !== '' && v != null);
    const row = (k, v, cls) => h('div', { class: 'sum-row' + (cls ? ' ' + cls : '') }, h('span', null, k), h('span', null, v));

    const tickets = (o.tickets || []).map((t) => {
      const st = t.status === 'used' ? badge('Ingecheckt', 'green') : t.status === 'void' ? badge('Ongeldig', 'grey') : badge('Geldig', 'blue');
      const b = (label, action, msg, cls) => { const x = h('button', { class: 'btn btn-sm' + (cls ? ' ' + cls : ''), type: 'button', onclick: () => act(x, () => rpc('entree_ticket_set', { ticket_id: t.id, action }), msg) }, label); return x; };
      const actions = o.status !== 'paid' ? [] : t.status === 'valid' ? [b('Inchecken', 'checkin', 'Ticket ingecheckt.'), b('Ongeldig maken', 'void', 'Ticket ongeldig gemaakt.', 'btn-danger-ghost')]
        : t.status === 'used' ? [b('Inchecken ongedaan maken', 'undo_checkin', 'Inchecken ongedaan gemaakt.')] : [b('Herstellen', 'restore', 'Ticket is weer geldig.')];
      return h('li', { class: 'tk' },
        h('div', { class: 'tk-main' }, h('div', { class: 'trow-name' }, h('strong', null, t.type), st), h('p', { class: 'trow-meta' }, h('span', { class: 'mono' }, t.code), t.holder_name ? ' · ' + t.holder_name : '', t.used_at ? ' · ingecheckt ' + fmtShort(t.used_at) : '')),
        actions.length ? h('div', { class: 'row wrap' }, actions) : null);
    });

    const resend = h('button', { class: 'btn', type: 'button', onclick: async () => {
      const r = await guard(resend, () => fn('resend', { order_id: o.id }));
      if (!r) return;
      if (r.ok) { changed = true; toast(`Ticketmail opnieuw gestuurd naar ${o.buyer_email}.`); await draw(); }
      else toast('De mail versturen lukte niet. Probeer het over een minuut opnieuw.', 'err');
    } }, icon('mail', 16), 'Ticketmail opnieuw sturen');
    const open = h('a', { class: 'btn', href: ticketUrl(o.order_token), target: '_blank', rel: 'noopener' }, icon('external', 16), 'Ticketpagina openen');
    const refund = h('button', { class: 'btn btn-danger-ghost', type: 'button', onclick: async () => {
      const free = o.total_cents === 0;
      const yes = await confirmDialog({ title: 'Bestelling terugbetalen', danger: true, confirmLabel: free ? 'Bestelling annuleren' : `${euro(o.total_cents)} terugbetalen`,
        text: [free ? 'Dit is een gratis bestelling. Er wordt niets teruggeboekt.' : o.is_test ? 'Dit is een testbestelling. Er is niets echt betaald, dus er wordt niets teruggeboekt.' : `We boeken ${euro(o.total_cents)} terug via Mollie naar de rekening van ${o.buyer_name}. Dat is het hele bedrag, inclusief servicekosten.`,
          'Alle tickets van deze bestelling worden ongeldig. Dit kun je niet terugdraaien.'] });
      if (!yes) return;
      const r = await guard(refund, () => fn('refund', { order_id: o.id }));
      if (!r) return;
      changed = true;
      await draw();
      if (r.mollie === 'failed') {
        m.body.prepend(notice('danger', h('strong', null, 'Het terugboeken bij Mollie is niet gelukt. '), 'De bestelling staat op terugbetaald en de tickets zijn ongeldig, maar de koper heeft het geld nog niet terug. Doe de terugbetaling zelf in je Mollie-dashboard.'));
        toast('Let op: het terugboeken bij Mollie is niet gelukt.', 'err');
      } else toast(r.mollie === 'ok' ? 'Terugbetaald. Het geld staat binnen een paar werkdagen bij de koper.' : 'Bestelling geannuleerd. Er hoefde niets teruggeboekt te worden.');
    } }, 'Terugbetalen');

    m.setBody(h('div', { class: 'order' },
      h('div', { class: 'order-top' }, h('div', null, h('p', { class: 'order-ref mono' }, o.ref), h('p', { class: 'muted' }, fmtDate(o.paid_at || o.created_at))), h('div', { class: 'row' }, statusBadges(o))),
      h('section', null, h('h3', null, 'Koper'),
        h('p', null, h('strong', null, o.buyer_name)), h('p', null, h('a', { href: 'mailto:' + o.buyer_email }, o.buyer_email)),
        h('p', { class: 'muted small' }, [SOURCE[o.source] ? 'Besteld via: ' + SOURCE[o.source] : '', o.mail_sent_at ? 'Ticketmail verstuurd op ' + fmtShort(o.mail_sent_at) : o.status === 'paid' ? 'Ticketmail nog niet verstuurd' : '', o.refunded_at ? 'Terugbetaald op ' + fmtShort(o.refunded_at) : ''].filter(Boolean).join(' · '))),
      h('section', null, h('h3', null, 'Bestelling'),
        h('div', { class: 'sum' },
          (o.items || []).map((i) => row(`${i.qty}x ${i.name}`, euro(i.qty * i.unit_price_cents))),
          o.discount_cents ? row(`Korting${o.discount_code ? ' (' + o.discount_code + ')' : ''}`, '- ' + euro(o.discount_cents)) : null,
          row('Servicekosten', euro(o.fee_cents)),
          row('Totaal', euro(o.total_cents), 'sum-total'),
          o.fee_cents ? h('p', { class: 'hint' }, `Voor jou: ${euro(o.total_cents - o.fee_cents)}. De servicekosten factureert Entree achteraf.`) : null)),
      custom.length ? h('section', null, h('h3', null, 'Antwoorden'), h('dl', { class: 'answers' }, custom.map(([k, v]) => [h('dt', null, k), h('dd', null, answer(v))]))) : null,
      h('section', null, h('h3', null, `Tickets (${tickets.length})`), tickets.length ? h('ul', { class: 'tk-list' }, tickets) : h('p', { class: 'muted' }, o.status === 'pending' ? 'De tickets worden gemaakt zodra de betaling binnen is.' : 'Bij deze bestelling horen geen tickets.')),
      h('section', { class: 'order-actions' }, o.status === 'paid' ? resend : null, o.status === 'paid' || o.status === 'refunded' ? open : null, o.status === 'paid' ? refund : null)));
    void sub;
  }
  draw();
}

// ---------- export ----------
const csvCell = (v) => { const s = v == null ? '' : String(v); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : /^[=+\-@]/.test(s) ? "'" + s : s; };
const money = (c) => ((Number(c) || 0) / 100).toFixed(2).replace('.', ',');
const stamp = (iso) => { if (!iso) return ''; const d = new Date(iso); const p = (n) => String(n).padStart(2, '0'); return isNaN(d) ? '' : `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; };

async function exportCsv(e) {
  const all = [];
  for (let offset = 0; ; offset += 1000) {
    const r = await rpc('entree_orders', { event_id: e.id, limit: 1000, offset });
    all.push(...r.orders);
    if (all.length >= r.total || !r.orders.length) break;
  }
  if (!all.length) { toast('Er zijn nog geen bestellingen om te exporteren.', 'err'); return; }
  const questions = [];
  all.forEach((o) => Object.keys(o.custom || {}).forEach((k) => { if (!questions.includes(k)) questions.push(k); }));
  const head = ['Bestelnummer', 'Datum', 'Betaald op', 'Naam', 'E-mail', 'Regels', 'Aantal tickets', 'Ingecheckt', 'Korting', 'Kortingscode', 'Servicekosten', 'Totaal', 'Status', 'Via', ...questions];
  const rows = all.map((o) => [o.ref, stamp(o.created_at), stamp(o.paid_at), o.buyer_name, o.buyer_email, lines(o), o.tickets, o.used, money(o.discount_cents), o.discount_code || '',
    money(o.fee_cents), money(o.total_cents), (STATUS[o.status] || [o.status])[0], SOURCE[o.source] || o.source || '', ...questions.map((q) => answer((o.custom || {})[q]))]);
  const csv = '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n';
  download(`bestellingen-${e.slug}-${new Date().toISOString().slice(0, 10)}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  toast(`${num(all.length)} ${all.length === 1 ? 'bestelling' : 'bestellingen'} geëxporteerd.`);
}

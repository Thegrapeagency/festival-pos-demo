// Tab Trackinglinks: voor elke plek waar je je tickets deelt een eigen link,
// met kliks, bestellingen, tickets en omzet per link.
import { rpc, ApiError } from './api.js';
import { h, icon, toast, guard, field, setError, notice, empty, spinner, openModal, confirmDialog, euro, num, copyText, copyRow, qrNode, qrDownloadSvg, qrDownloadPng } from './ui.js';
import { S, shopUrl, local } from './store.js';

const SORTS = [['revenue', 'Omzet'], ['clicks', 'Kliks'], ['orders', 'Bestellingen'], ['tickets', 'Tickets'], ['conv', 'Conversie'], ['name', 'Naam'], ['new', 'Nieuwste eerst']];
const EXAMPLES = ['Instagram-bio', 'Nieuwsbrief', 'Poster met QR', 'Partner'];
const view = { evId: null, sort: 'revenue', data: null, created: null };

export const trackUrl = (slug, code) => `${shopUrl(slug)}&via=${encodeURIComponent(code)}`;
const siteKey = (evId) => 'entree_site_url_' + evId;
const conv = (l) => (Number(l.clicks) > 0 ? Number(l.orders) / Number(l.clicks) : null);
const pct = (x) => (x * 100).toLocaleString('nl-NL', { maximumFractionDigits: x < 0.1 ? 1 : 0 }) + '%';

// Het adres van de eigen ticketpagina met ?via=<code> erachter. Leeg bij een adres dat niet klopt.
export function ownSiteLink(address, code) {
  let a = String(address || '').trim();
  if (!a || /\s/.test(a)) return '';
  if (!/^https?:\/\//i.test(a)) a = 'https://' + a;
  try {
    const u = new URL(a);
    if (!/^https?:$/.test(u.protocol) || (!u.hostname.includes('.') && u.hostname !== 'localhost')) return '';
    u.searchParams.set('via', code);
    return u.toString();
  } catch { return ''; }
}

function sorted(links, key) {
  const val = { revenue: (l) => Number(l.revenue_cents), clicks: (l) => Number(l.clicks), orders: (l) => Number(l.orders), tickets: (l) => Number(l.tickets), conv: (l) => { const c = conv(l); return c == null ? -1 : c; } }[key];
  const newest = (a, b) => String(b.created_at).localeCompare(String(a.created_at));
  return links.slice().sort((a, b) => {
    if (key === 'name') return String(a.label).localeCompare(String(b.label), 'nl', { sensitivity: 'base' }) || newest(a, b);
    if (key === 'new') return newest(a, b);
    return val(b) - val(a) || newest(a, b);
  });
}

// Opslaan met een eigen melding voor het maximum (de algemene melding gaat over scanlinks).
async function save(p) {
  try { return await rpc('entree_tracking_save', p); }
  catch (ex) {
    if (String(ex.code || '').includes('too_many')) throw new ApiError('too_many', 'Je hebt het maximum van 100 trackinglinks bereikt. Verwijder eerst een link die je niet meer gebruikt.');
    if (String(ex.code || '').includes('name_required')) throw new ApiError('name_required', 'Geef de link een naam.');
    throw ex;
  }
}

function qrModal(e, l) {
  const url = trackUrl(e.slug, l.code);
  const file = `${e.slug}-${l.code}-qr`;
  openModal({ title: 'QR-code', body: h('div', { class: 'tl-qr' },
    h('p', null, 'Deze QR-code opent je shop via de link ', h('strong', null, l.label), '. Zet hem op een poster of flyer, dan zie je hoeveel kliks en bestellingen dat oplevert.'),
    h('div', { class: 'qr-box' }, qrNode(url, 200),
      h('div', { class: 'row center' },
        h('button', { class: 'btn btn-sm', type: 'button', onclick: () => qrDownloadPng(url, file + '.png') }, icon('download', 15), 'PNG'),
        h('button', { class: 'btn btn-sm', type: 'button', onclick: () => qrDownloadSvg(url, file + '.svg') }, icon('download', 15), 'SVG'))),
    h('p', { class: 'hint mono tl-break' }, url)) });
}

function siteModal(e, l) {
  const key = siteKey(e.id);
  const addr = h('input', { type: 'url', inputmode: 'url', autocomplete: 'off', spellcheck: false, placeholder: 'https://jouwsite.nl/tickets', value: local.get(key) || '' });
  const out = h('input', { type: 'text', readonly: true, class: 'mono', onfocus: () => out.select() });
  const copy = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => copyText(out.value, 'Link gekopieerd') }, icon('copy', 16), 'Kopieer');
  const sync = () => {
    const typed = addr.value.trim();
    const link = ownSiteLink(typed, l.code);
    out.value = link;
    out.placeholder = link ? '' : 'Vul eerst het adres hierboven in';
    copy.disabled = !link;
    setError(addr, typed && !link ? 'Dit adres klopt niet. Vul het adres van je ticketpagina in, bijvoorbeeld https://jouwsite.nl/tickets.' : '');
    if (link || !typed) local.set(key, typed);
  };
  addr.addEventListener('input', sync);
  const body = h('div', { class: 'tl-site' },
    h('p', null, 'Staat de shop op je eigen website, deel dan het adres van je eigen ticketpagina met ', h('span', { class: 'mono' }, '?via=' + l.code), ' erachter. De shop op je pagina neemt dat vanzelf over, zodat kliks en bestellingen meetellen bij ', h('strong', null, l.label), '.'),
    field('Adres van je ticketpagina', addr, { hint: 'De pagina op je eigen site waar de shop staat. We onthouden dit adres voor dit event.' }),
    field('Link om te delen', out, { wrap: (c) => h('div', { class: 'copy-row' }, c, copy) }));
  openModal({ title: 'Link voor je eigen site', body });
  sync();
}

function renameModal(l, done) {
  const name = h('input', { type: 'text', maxlength: '60', value: l.label });
  const saveBtn = h('button', { class: 'btn btn-primary', type: 'submit', form: 'tl-rename' }, 'Opslaan');
  const form = h('form', { id: 'tl-rename', novalidate: true, onsubmit: async (ev) => {
    ev.preventDefault();
    const v = name.value.trim();
    setError(name, v ? '' : 'Geef de link een naam.');
    if (!v) { name.focus(); return; }
    if (v === l.label) { m.close(); return; }
    const ok = await guard(saveBtn, async () => { await save({ action: 'update', id: l.id, label: v }); return true; });
    if (ok) { m.close(); toast('Naam opgeslagen.'); done(); }
  } }, field('Naam', name, { hint: 'Alleen de naam verandert. De link zelf blijft gelijk, dus wat je al gedeeld hebt blijft werken.' }));
  const m = openModal({ title: 'Link hernoemen', body: form, footer: [h('button', { class: 'btn', type: 'button', onclick: () => m.close() }, 'Annuleren'), saveBtn] });
  name.select();
}

export function tabTracking() {
  const e = S.ev.event;
  if (view.evId !== e.id) Object.assign(view, { evId: e.id, data: null, created: null });
  const listEl = h('div', { class: 'tl-list', 'aria-live': 'polite' });
  const createdEl = h('div', { class: 'tl-created', hidden: true });
  let seq = 0;

  const name = h('input', { type: 'text', maxlength: '60', placeholder: 'Bijvoorbeeld: Instagram-bio' });
  const addBtn = h('button', { class: 'btn btn-primary', type: 'submit' }, icon('plus', 17), 'Link maken');
  const form = h('form', { novalidate: true, onsubmit: async (ev) => {
    ev.preventDefault();
    const v = name.value.trim();
    setError(name, v ? '' : 'Geef de link een naam, bijvoorbeeld de plek waar je hem deelt.');
    if (!v) { name.focus(); return; }
    const r = await guard(addBtn, () => save({ action: 'create', event_id: e.id, label: v }));
    if (!r) return;
    name.value = '';
    view.created = r.id;
    toast('Link gemaakt.');
    await load();
  } }, field('Naam van de nieuwe link', name, { hint: 'Noem de plek waar je de link deelt. De naam zie je alleen zelf.', wrap: (c) => h('div', { class: 'copy-row' }, c, addBtn) }));

  function drawCreated(links) {
    const l = view.created ? links.find((x) => x.id === view.created) : null;
    if (!l) { view.created = null; createdEl.hidden = true; createdEl.replaceChildren(); return; }
    const row = copyRow(`Je nieuwe link: ${l.label}`, trackUrl(e.slug, l.code), { toast: 'Link gekopieerd', hint: 'Deel precies deze link. Elke klik en elke bestelling die erop volgt, tellen we hieronder bij deze link.' });
    createdEl.replaceChildren(row);
    createdEl.hidden = false;
  }

  function draw() {
    const d = view.data;
    const links = sorted(d.links || [], view.sort);
    drawCreated(links);
    if (!links.length) {
      listEl.replaceChildren(h('div', { class: 'card' }, empty('link', 'Nog geen trackinglinks', 'Geef hierboven je eerste link een naam en klik op Link maken. Je kunt ook met een van deze voorbeelden beginnen.',
        h('div', { class: 'chips tl-examples' }, EXAMPLES.map((x) => h('button', { class: 'chip', type: 'button', onclick: () => { name.value = x; setError(name, ''); name.focus(); } }, x))))));
      return;
    }
    const stat = (label, value, cls) => h('span', { class: 'tl-stat' + (cls ? ' ' + cls : '') }, h('small', null, label), h('b', null, value));
    const blank = () => h('span', { class: 'tl-stat is-blank', 'aria-hidden': 'true' });
    const rows = links.map((l) => {
      const url = trackUrl(e.slug, l.code);
      const c = conv(l);
      const copy = h('button', { class: 'btn btn-sm', type: 'button', onclick: () => copyText(url, 'Link gekopieerd') }, icon('copy', 15), 'Kopieer link');
      const del = h('button', { class: 'icon-btn icon-danger', type: 'button', 'aria-label': `${l.label} verwijderen`, title: 'Verwijderen', onclick: async () => {
        const yes = await confirmDialog({ title: `${l.label} verwijderen`, danger: true, confirmLabel: 'Verwijderen', text: [
          'Kliks en bestellingen via deze link tellen we daarna niet meer. Wie de link nog gebruikt, komt gewoon in je shop.',
          'De cijfers van deze link zijn na het verwijderen niet meer per link zichtbaar. De bestellingen zelf blijven staan bij Bestellingen.'] });
        if (!yes) return;
        const ok = await guard(del, async () => { await save({ action: 'delete', id: l.id }); return true; });
        if (ok) { toast('Trackinglink verwijderd.'); await load(); }
      } }, icon('trash', 17));
      return h('li', { class: 'tl-row' + (l.id === view.created ? ' is-new' : '') },
        h('div', { class: 'tl-main' }, h('strong', null, l.label)),
        stat('Kliks', num(l.clicks)), stat('Bestellingen', num(l.orders)), stat('Tickets', num(l.tickets)), stat('Omzet', euro(l.revenue_cents)),
        stat('Conversie', c == null ? 'Geen kliks' : pct(c), c == null ? 'is-none' : ''),
        h('span', { class: 'tl-url mono' }, url),
        h('div', { class: 'tl-actions' }, copy,
          h('button', { class: 'btn btn-sm', type: 'button', onclick: () => qrModal(e, l) }, icon('qr', 15), 'QR-code'),
          h('button', { class: 'btn btn-sm', type: 'button', onclick: () => siteModal(e, l) }, icon('code', 15), 'Voor je eigen site'),
          h('span', { class: 'tl-actions-end' },
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': `${l.label} hernoemen`, title: 'Hernoemen', onclick: () => renameModal(l, load) }, icon('edit', 17)), del)));
    });
    const u = d.untracked || {};
    const sort = h('select', { id: 'tl-sort', value: view.sort, onchange: () => { view.sort = sort.value; draw(); } }, SORTS.map(([k, label]) => h('option', { value: k }, label)));
    listEl.replaceChildren(
      h('div', { class: 'section-head tl-head-row' }, h('h2', null, links.length === 1 ? '1 link' : `${num(links.length)} links`),
        h('div', { class: 'tl-sort' }, h('label', { for: 'tl-sort' }, 'Sorteren op'), sort)),
      h('ul', { class: 'card list tl-table' },
        h('li', { class: 'tl-row tl-head', 'aria-hidden': 'true' }, ['Link', 'Kliks', 'Bestellingen', 'Tickets', 'Omzet', 'Conversie'].map((t) => h('span', null, t))),
        rows,
        h('li', { class: 'tl-row tl-rest' },
          h('div', { class: 'tl-main' }, h('strong', null, 'Zonder trackinglink')),
          blank(), stat('Bestellingen', num(u.orders)), blank(), stat('Omzet', euro(u.revenue_cents)), blank(),
          h('span', { class: 'tl-url' }, 'Bestellingen die niet via een van je links binnenkwamen.'))),
      h('p', { class: 'hint tl-foot' }, 'Omzet is zonder servicekosten. Conversie is het aantal bestellingen gedeeld door het aantal kliks. Dezelfde bezoeker telt één keer per half uur als klik.'));
  }

  async function load() {
    const my = ++seq;
    if (!view.data) listEl.replaceChildren(spinner('Trackinglinks laden'));
    let r;
    try { r = await rpc('entree_tracking', { event_id: e.id }); }
    catch (ex) {
      if (my !== seq || ex.code === 'session' || !listEl.isConnected) return;
      listEl.replaceChildren(h('div', { class: 'card pad' }, notice('warn', ex.message), h('div', { class: 'form-actions start' }, h('button', { class: 'btn', type: 'button', onclick: load }, 'Opnieuw proberen'))));
      return;
    }
    if (my !== seq || view.evId !== e.id) return;
    view.data = r;
    if (listEl.isConnected) draw();
  }

  if (view.data) draw();
  load();
  return h('div', { class: 'stack' },
    h('div', { class: 'tab-head' }, h('div', null, h('h2', null, 'Trackinglinks'),
      h('p', { class: 'muted' }, 'Maak voor elke plek waar je je tickets deelt een eigen link: je Instagram-bio, je nieuwsbrief, een poster met QR-code of een partner. Dan zie je per link hoeveel kliks, bestellingen, tickets en omzet het opleverde.'))),
    e.shop_live ? null : notice('info', h('strong', null, 'Je shop staat nog niet live. '), 'Je kunt je links al klaarzetten. Kliks en bestellingen tellen mee zodra de verkoop open is.'),
    h('section', { class: 'card pad tl-new' }, h('h2', null, 'Nieuwe link'), form, createdEl),
    listEl);
}

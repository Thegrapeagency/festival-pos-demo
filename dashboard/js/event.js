// Eén event: kader met tabs, en de tabs Overzicht, Gegevens, Tickets,
// Kortingscodes, Vragen, Op je site en Scannen.
import { rpc, BASE } from './api.js';
import { h, icon, toast, guard, field, toggle, setError, badge, notice, empty, openModal, confirmDialog, euro, euroShort, centsToInput, parseEuro, num, intOrNull,
  fmtDate, fmtShort, toLocalInput, fromLocalInput, copyRow, copyText, qrNode, qrDownloadSvg, qrDownloadPng } from './ui.js';
import { S, loadEvent, loadState, shopUrl, previewUrl, scanUrl, local, payReady } from './store.js';
import { statusBadge } from './home.js';
import { tabBrand, brandDirty } from './brand.js';
import { tabOrders } from './orders.js';

const TABS = [
  ['overzicht', 'Overzicht', 'chart'], ['gegevens', 'Gegevens', 'calendar'], ['tickets', 'Tickets', 'ticket'], ['codes', 'Kortingscodes', 'tag'],
  ['huisstijl', 'Huisstijl', 'palette'], ['vragen', 'Vragen', 'help'], ['site', 'Op je site', 'code'], ['bestellingen', 'Bestellingen', 'list'], ['scannen', 'Scannen', 'scan'],
];

// Na een wijziging: event opnieuw ophalen en het scherm opnieuw tekenen.
export async function refresh() {
  await loadEvent(S.evId);
  loadState().catch(() => {});
  S.render();
}
const tabHref = (tab) => `#/event/${S.evId}/${tab}`;
const embedKey = () => 'entree_embed_' + S.evId;

export function viewEvent(tab) {
  const d = S.ev, e = d.event;
  if (!TABS.some((t) => t[0] === tab)) tab = 'overzicht';
  const fieldDraft = S.fieldDrafts.get(e.id);
  const dot = (k) => ((k === 'huisstijl' && brandDirty(e.id)) || (k === 'vragen' && fieldDraft && fieldDraft.dirty) ? ' has-dot' : '');
  const nav = h('nav', { class: 'tabs', 'aria-label': 'Onderdelen van dit event' },
    TABS.map(([k, label, ic]) => h('a', { href: tabHref(k), class: 'tab' + (k === tab ? ' is-on' : '') + dot(k), 'aria-current': k === tab ? 'page' : null }, icon(ic, 17), h('span', null, label))));
  const view = e.shop_live
    ? h('a', { class: 'btn', href: shopUrl(e.slug), target: '_blank', rel: 'noopener' }, icon('external', 16), 'Bekijk shop')
    : h('a', { class: 'btn', href: previewUrl(e), target: '_blank', rel: 'noopener' }, icon('eye', 16), 'Bekijk voorbeeld');
  const meta = [e.starts_at ? fmtDate(e.starts_at) : 'Nog geen datum', e.location].filter(Boolean).join(' · ');
  const body = { overzicht: tabOverview, gegevens: tabDetails, tickets: tabTickets, codes: tabCodes, huisstijl: tabBrand, vragen: tabQuestions, site: tabSite, bestellingen: tabOrders, scannen: tabScan }[tab]();
  setTimeout(() => { const on = nav.querySelector('.is-on'); if (on && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = on.offsetLeft - 16; }, 0);
  return h('div', { class: 'page page-event' },
    h('a', { class: 'back', href: '#/' }, icon('left', 16), 'Alle events'),
    h('div', { class: 'page-head' }, h('div', { class: 'ev-title' }, h('div', { class: 'ev-title-row' }, h('h1', null, e.name), statusBadge(e)), h('p', { class: 'muted' }, meta)), view),
    h('div', { class: 'ev-layout' }, nav, h('section', { class: 'tab-body tab-' + tab, 'aria-label': TABS.find((t) => t[0] === tab)[1] }, body)));
}

// ---------- Overzicht ----------
let liveError = null; // { id, code }

function checklist() {
  const d = S.ev, e = d.event, shop = e.shop || {}, brand = shop.brand || {};
  const active = d.types.filter((t) => t.active);
  const paid = active.some((t) => t.price_cents > 0);
  return [
    { done: !!(e.name && e.starts_at && e.location), title: 'Vul de gegevens van je event in', text: 'Naam, datum en locatie staan op de shop en op het ticket.', tab: 'gegevens', cta: 'Gegevens invullen' },
    { done: active.length > 0, title: 'Zet minstens één ticket aan', text: active.length ? `${active.length} ${active.length === 1 ? 'ticket staat' : 'tickets staan'} aan.` : 'Maak een ticket met een prijs en een aantal.', tab: 'tickets', cta: 'Tickets inrichten' },
    { done: !!(brand.logo_url || brand.primary), title: 'Stel je huisstijl in', text: 'Upload je logo of stijlgids. Kleuren en lettertypes stellen we voor.', tab: 'huisstijl', cta: 'Huisstijl instellen' },
    paid || !active.length
      ? { done: payReady(d.pay_mode), title: 'Kies hoe je betaald wilt worden',
        text: d.pay_mode === 'test' ? 'Mollie staat in testmodus. Koppel je Live API key om echt te verkopen.' : d.pay_mode === 'platform' ? 'Je laat ons wekelijks uitbetalen.' : d.pay_mode === 'live' ? 'Je eigen Mollie-account is gekoppeld.' : 'Voor betaalde tickets kies je tussen een wekelijkse uitbetaling van ons of je eigen Mollie-account.',
        href: '#/settings', cta: 'Betalingen regelen' }
      : { done: true, title: 'Betalingen regelen is niet nodig', text: 'Je hebt alleen gratis tickets. Voeg je later een betaald ticket toe, kies dan hoe je betaald wilt worden.', href: '#/settings', cta: 'Betalingen regelen' },
    { done: d.stats.test_orders > 0, title: 'Doe een testbestelling', text: 'Open het voorbeeld van je shop en bestel een ticket. Je betaalt niets en ziet precies wat je koper krijgt.', href: previewUrl(e), ext: true, cta: 'Voorbeeld openen' },
    { done: e.shop_live, title: 'Zet de verkoop live', text: 'Vanaf dat moment kan iedereen met de link tickets kopen.', tab: 'overzicht', cta: null },
    { done: !!local.get(embedKey()), title: 'Zet de shop op je site', text: 'Plak de code op je website of deel de link op je socials.', tab: 'site', cta: 'Code en link bekijken' },
  ];
}

function liveCard() {
  const d = S.ev, e = d.event;
  if (e.archived) {
    const b = h('button', { class: 'btn', type: 'button', onclick: async () => {
      const ok = await guard(b, async () => { await rpc('entree_event_save', { id: e.id, archived: false }); return true; });
      if (ok) { toast('Event teruggezet. Het staat weer bij je events.'); await refresh(); }
    } }, 'Terugzetten uit archief');
    return h('div', { class: 'live-card is-off' }, h('div', null, h('h2', null, 'Dit event is gearchiveerd'), h('p', null, 'De verkoop staat uit en het event staat onderaan je overzicht. Bestellingen blijven bewaard.')), b);
  }
  const setLive = async (btn, on) => {
    liveError = null;
    if (!on) {
      const yes = await confirmDialog({ title: 'Verkoop pauzeren', confirmLabel: 'Pauzeren', text: 'Kopers zien dan dat de verkoop nog niet open is. Bestaande tickets blijven geldig. Je kunt de verkoop elk moment weer openzetten.' });
      if (!yes) return;
    }
    if (btn.disabled) return;
    btn.disabled = true; btn.classList.add('is-busy');
    try {
      await rpc('entree_event_save', { id: e.id, shop_live: on });
      toast(on ? 'Je shop staat live. Kopers kunnen nu bestellen.' : 'De verkoop is gepauzeerd.');
      await refresh();
    } catch (ex) {
      btn.disabled = false; btn.classList.remove('is-busy');
      const code = String(ex.code || '');
      if (code.includes('no_types') || code.includes('no_payments')) { liveError = { id: e.id, code: code.includes('no_types') ? 'no_types' : 'no_payments' }; S.render(); }
      else if (ex.code !== 'session') toast(ex.message, 'err');
    }
  };
  if (e.shop_live) {
    const b = h('button', { class: 'btn', type: 'button', onclick: () => setLive(b, false) }, 'Verkoop pauzeren');
    return h('div', { class: 'live-card is-on' },
      h('div', null, h('h2', null, h('span', { class: 'pulse', 'aria-hidden': 'true' }), 'Je verkoop staat open'),
        h('p', null, 'Iedereen met de link kan tickets kopen: ', h('a', { href: shopUrl(e.slug), target: '_blank', rel: 'noopener' }, shopUrl(e.slug).replace(/^https?:\/\//, ''))),
        d.pay_mode === 'test' ? h('p', { class: 'warn-text' }, icon('alert', 15), 'Mollie staat in testmodus: betalingen zijn niet echt.') : null),
      b);
  }
  const b = h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: () => setLive(b, true) }, 'Live zetten');
  const err = liveError && liveError.id === e.id ? liveError.code : null;
  return h('div', { class: 'live-card' },
    h('div', null, h('h2', null, 'Je shop staat nog niet open'),
      h('p', null, 'Alleen jij kunt de shop nu zien, via het voorbeeld. Zet hem live als je tickets en huisstijl kloppen.'),
      err === 'no_types' ? notice('warn', h('strong', null, 'Live zetten kan nog niet. '), 'Er staat geen enkel ticket aan. Voeg een ticket toe of zet er een aan. ', h('a', { href: tabHref('tickets') }, 'Naar Tickets')) : null,
      err === 'no_payments' ? notice('warn', h('strong', null, 'Live zetten kan nog niet. '), 'Je hebt betaalde tickets, maar je hebt nog niet gekozen hoe je betaald wilt worden. Kies voor een wekelijkse uitbetaling of koppel je eigen Mollie-account. Je kunt je tickets ook gratis maken. ', h('a', { href: '#/settings' }, 'Betalingen regelen')) : null),
    b);
}

function salesChart(byDay) {
  const map = new Map((byDay || []).map((r) => [r.day, r]));
  if (!map.size) return h('p', { class: 'chart-empty' }, 'Nog geen verkopen. Zodra de eerste bestelling binnen is, zie je hier de verkoop per dag.');
  const key = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const first = new Date([...map.keys()].sort()[0] + 'T12:00:00');
  const span = Math.min(60, Math.max(14, Math.round((today - first) / 864e5) + 1));
  const days = [];
  for (let i = span - 1; i >= 0; i--) { const dt = new Date(today); dt.setDate(dt.getDate() - i); const k = key(dt); const r = map.get(k); days.push({ dt, tickets: r ? Number(r.tickets) : 0, revenue: r ? Number(r.revenue_cents) : 0 }); }
  const max = Math.max(1, ...days.map((x) => x.tickets));
  const lab = (dt) => dt.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  const tip = h('div', { class: 'chart-tip', hidden: true });
  const plot = h('div', { class: 'chart-plot' }, days.map((x, i) => {
    const show = () => { tip.replaceChildren(h('strong', null, `${num(x.tickets)} ${x.tickets === 1 ? 'ticket' : 'tickets'}`), h('span', null, `${lab(x.dt)} · ${euro(x.revenue)}`)); tip.hidden = false; tip.style.left = `${((i + 0.5) / days.length) * 100}%`; };
    return h('div', { class: 'chart-col', tabindex: '0', 'aria-label': `${lab(x.dt)}: ${x.tickets} tickets, ${euro(x.revenue)}`, onmouseenter: show, onfocus: show, onmouseleave: () => { tip.hidden = true; }, onblur: () => { tip.hidden = true; } },
      h('div', { class: 'chart-bar' + (x.tickets ? '' : ' is-zero'), style: { height: x.tickets ? `${Math.max(3, (x.tickets / max) * 100)}%` : '2px' } }));
  }));
  return h('div', { class: 'chart' },
    h('div', { class: 'chart-y', 'aria-hidden': 'true' }, h('span', null, num(max)), h('span', null, '0')),
    h('div', { class: 'chart-area' }, plot, tip,
      h('div', { class: 'chart-x', 'aria-hidden': 'true' }, h('span', null, lab(days[0].dt)), h('span', null, lab(days[Math.floor(days.length / 2)].dt)), h('span', null, 'Vandaag'))),
    h('table', { class: 'sr' }, h('caption', null, 'Verkochte tickets per dag'),
      h('thead', null, h('tr', null, h('th', null, 'Dag'), h('th', null, 'Tickets'), h('th', null, 'Omzet'))),
      h('tbody', null, days.filter((x) => x.tickets).map((x) => h('tr', null, h('td', null, lab(x.dt)), h('td', null, x.tickets), h('td', null, euro(x.revenue)))))));
}

function tabOverview() {
  const d = S.ev, st = d.stats;
  const items = checklist();
  const doneCount = items.filter((i) => i.done).length;
  const next = items.findIndex((i) => !i.done);
  const list = h('ol', { class: 'check' }, items.map((it, i) => {
    const cta = it.cta && !it.done ? h('a', { class: 'btn btn-sm' + (i === next ? ' btn-primary' : ''), href: it.href || tabHref(it.tab), target: it.ext ? '_blank' : null, rel: it.ext ? 'noopener' : null }, it.cta, it.ext ? icon('external', 14) : null) : null;
    return h('li', { class: (it.done ? 'is-done' : '') + (i === next ? ' is-next' : '') },
      h('span', { class: 'check-mark', 'aria-hidden': 'true' }, it.done ? icon('check', 15) : String(i + 1)),
      h('div', { class: 'check-text' }, h('strong', null, it.title, h('span', { class: 'sr' }, it.done ? ' (klaar)' : ' (nog te doen)')), h('p', null, it.text)), cta);
  }));
  const kpi = (label, value, sub) => h('div', { class: 'kpi' }, h('p', { class: 'kpi-label' }, label), h('p', { class: 'kpi-value' }, value), sub ? h('p', { class: 'kpi-sub' }, sub) : null);
  const types = d.types.filter((t) => t.active || t.sold > 0);
  return h('div', { class: 'stack' },
    liveCard(),
    h('section', { class: 'card pad' },
      h('div', { class: 'card-head' }, h('h2', null, 'Zo ga je live'), h('span', { class: 'muted' }, `${doneCount} van ${items.length} klaar`)),
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(items.length), 'aria-valuenow': String(doneCount), 'aria-label': 'Voortgang' }, h('span', { style: { width: `${(doneCount / items.length) * 100}%` } })),
      list),
    h('div', { class: 'kpis' },
      kpi('Tickets verkocht', num(st.tickets)),
      kpi('Omzet', euro(st.revenue_cents), 'Zonder servicekosten'),
      kpi('Bestellingen', num(st.orders), st.refunded ? `${num(st.refunded)} terugbetaald` : null),
      kpi('Ingecheckt', `${num(st.checked_in)} / ${num(st.tickets)}`, st.tickets ? `${Math.round((st.checked_in / st.tickets) * 100)}% binnen` : null)),
    h('section', { class: 'card pad' }, h('div', { class: 'card-head' }, h('h2', null, 'Verkochte tickets per dag')), salesChart(st.by_day)),
    h('section', { class: 'card pad' }, h('div', { class: 'card-head' }, h('h2', null, 'Verkoop per ticket'), h('a', { href: tabHref('tickets') }, 'Tickets beheren')),
      types.length ? h('ul', { class: 'type-bars' }, types.map((t) => {
        const pct = t.capacity ? Math.min(100, (t.sold / t.capacity) * 100) : 0;
        return h('li', null,
          h('div', { class: 'type-bars-top' }, h('span', null, t.name, t.active ? null : badge('Uit', 'grey')), h('span', { class: 'muted' }, t.capacity != null ? `${num(t.sold)} van ${num(t.capacity)}` : `${num(t.sold)} verkocht · onbeperkt`)),
          t.capacity != null ? h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(pct)), 'aria-label': `${t.name} verkocht` }, h('span', { class: pct >= 100 ? 'is-full' : '', style: { width: pct + '%' } })) : null);
      })) : h('p', { class: 'chart-empty' }, 'Je hebt nog geen tickets aangezet.')));
}

// ---------- Gegevens ----------
function tabDetails() {
  const e = S.ev.event;
  const name = h('input', { type: 'text', maxlength: '80', required: true, value: e.name || '' });
  const start = h('input', { type: 'datetime-local', value: toLocalInput(e.starts_at) });
  const end = h('input', { type: 'datetime-local', value: toLocalInput(e.ends_at) });
  const loc = h('input', { type: 'text', maxlength: '160', value: e.location || '' });
  const desc = h('textarea', { rows: '5', maxlength: '2000', value: e.description || '' });
  const cap = h('input', { type: 'text', inputmode: 'numeric', value: e.capacity == null ? '' : String(e.capacity), placeholder: 'Onbeperkt' });
  const save = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Opslaan');
  const form = h('form', { class: 'card pad', novalidate: true, onsubmit: async (ev) => {
    ev.preventDefault();
    const n = name.value.trim(), c = intOrNull(cap.value), s = fromLocalInput(start.value), en = fromLocalInput(end.value);
    setError(name, n ? '' : 'Geef je event een naam.');
    setError(cap, Number.isNaN(c) ? 'Vul een heel getal in, of laat het veld leeg voor onbeperkt.' : '');
    const order = !s || !en || new Date(en) > new Date(s);
    setError(end, order ? '' : 'Het einde ligt voor het begin. Kies een later tijdstip.');
    if (!n || Number.isNaN(c) || !order) return;
    const ok = await guard(save, async () => { await rpc('entree_event_save', { id: e.id, name: n, starts_at: s, ends_at: en, location: loc.value.trim(), description: desc.value.trim(), capacity: c }); return true; });
    if (ok) { toast('Gegevens opgeslagen.'); await refresh(); }
  } },
    h('h2', null, 'Gegevens van je event'),
    field('Naam', name),
    h('div', { class: 'grid2' }, field('Begint op', start), field('Eindigt op', end, { optional: true })),
    field('Locatie', loc, { hint: 'Naam van de plek en de plaats, zoals het op het ticket moet staan.' }),
    field('Omschrijving', desc, { optional: true, hint: 'Korte tekst over je event. Staat bovenaan de shop.' }),
    field('Totale capaciteit', cap, { optional: true, hint: 'Het maximum aantal personen voor alle tickets samen. Leeg is onbeperkt. Een duoticket telt voor twee.' }),
    h('p', { class: 'hint' }, 'De link van je shop blijft ', h('span', { class: 'mono' }, shopUrl(e.slug).replace(/^https?:\/\//, '')), ', ook als je de naam aanpast.'),
    h('div', { class: 'form-actions' }, save));

  const arch = h('button', { class: e.archived ? 'btn' : 'btn btn-danger-ghost', type: 'button', onclick: async () => {
    if (!e.archived) {
      const yes = await confirmDialog({ title: 'Event archiveren', confirmLabel: 'Archiveren', danger: true, text: ['De verkoop stopt direct en het event verhuist naar Gearchiveerd, onderaan je overzicht.', 'Bestellingen en tickets blijven bewaard. Je kunt het event later terugzetten.'] });
      if (!yes) return;
    }
    const ok = await guard(arch, async () => { await rpc('entree_event_save', { id: e.id, archived: !e.archived }); return true; });
    if (ok) { toast(e.archived ? 'Event teruggezet.' : 'Event gearchiveerd.'); await refresh(); }
  } }, e.archived ? 'Terugzetten uit archief' : 'Event archiveren');
  return h('div', { class: 'stack narrow' }, form,
    h('section', { class: 'card pad' }, h('h2', null, e.archived ? 'Dit event is gearchiveerd' : 'Archiveren'),
      h('p', { class: 'muted' }, e.archived ? 'Zet het terug om het weer te bewerken en de verkoop te openen.' : 'Is je event voorbij of gaat het niet door? Archiveer het, dan staat het niet meer tussen je lopende events.'),
      h('div', { class: 'form-actions' }, arch)));
}

// ---------- Tickets ----------
const typePayload = (t) => ({
  id: t.id, name: t.name, description: t.description || '', price_cents: t.price_cents, capacity: t.capacity == null ? null : t.capacity,
  min_per_order: t.min_per_order, max_per_order: t.max_per_order, admits: t.admits, hidden: !!t.hidden, vat_rate: Number(t.vat_rate),
  valid_label: t.valid_label || '', active: !!t.active, sort: t.sort, sale_starts_at: t.sale_starts_at || null, sale_ends_at: t.sale_ends_at || null,
});

function typeModal(t) {
  const isNew = !t;
  const e = S.ev.event;
  t = t || { name: '', description: '', price_cents: null, capacity: null, min_per_order: 1, max_per_order: 10, admits: 1, hidden: false, vat_rate: 9, valid_label: '', active: true, sale_starts_at: null, sale_ends_at: null };
  const name = h('input', { type: 'text', maxlength: '80', required: true, value: t.name, placeholder: 'Bijvoorbeeld: Regulier' });
  const desc = h('textarea', { rows: '2', maxlength: '400', value: t.description || '' });
  const price = h('input', { type: 'text', inputmode: 'decimal', value: t.price_cents == null ? '' : centsToInput(t.price_cents), placeholder: '0,00' });
  const vat = h('select', { value: String(Number(t.vat_rate)) }, [['9', '9% (toegang tot evenementen)'], ['21', '21%'], ['0', '0% of vrijgesteld']].map(([v, l]) => h('option', { value: v }, l)));
  const cap = h('input', { type: 'text', inputmode: 'numeric', value: t.capacity == null ? '' : String(t.capacity), placeholder: 'Onbeperkt' });
  const admits = h('input', { type: 'number', min: '1', max: '20', step: '1', value: String(t.admits || 1) });
  const min = h('input', { type: 'number', min: '1', max: '50', step: '1', value: String(t.min_per_order || 1) });
  const max = h('input', { type: 'number', min: '1', max: '50', step: '1', value: String(t.max_per_order || 10) });
  const valid = h('input', { type: 'text', maxlength: '80', value: t.valid_label || '', placeholder: 'Bijvoorbeeld: Zaterdag 14 juni' });
  const ss = h('input', { type: 'datetime-local', value: toLocalInput(t.sale_starts_at) });
  const se = h('input', { type: 'datetime-local', value: toLocalInput(t.sale_ends_at) });
  const active = toggle('Actief', t.active, null, 'Staat het ticket uit, dan is het niet te koop.');
  const hidden = toggle('Verborgen', t.hidden, null, 'Alleen zichtbaar voor kopers met een kortingscode die voor dit ticket geldt.');
  const save = h('button', { class: 'btn btn-primary', type: 'submit', form: 'type-form' }, isNew ? 'Ticket toevoegen' : 'Opslaan');
  const form = h('form', { id: 'type-form', novalidate: true, onsubmit: async (ev) => {
    ev.preventDefault();
    const n = name.value.trim(), p = parseEuro(price.value), c = intOrNull(cap.value);
    const a = parseInt(admits.value, 10), mi = parseInt(min.value, 10), ma = parseInt(max.value, 10);
    const s = fromLocalInput(ss.value), en = fromLocalInput(se.value);
    const errs = [
      [name, n ? '' : 'Geef het ticket een naam.'],
      [price, Number.isNaN(p) ? 'Vul een prijs in, bijvoorbeeld 12,50. Vul 0 in voor een gratis ticket.' : p > 1000000 ? 'De prijs is maximaal € 10.000.' : ''],
      [cap, Number.isNaN(c) ? 'Vul een heel getal in, of laat het veld leeg voor onbeperkt.' : ''],
      [admits, a >= 1 && a <= 20 ? '' : 'Kies een aantal van 1 tot en met 20.'],
      [min, mi >= 1 && mi <= 50 ? '' : 'Kies een aantal van 1 tot en met 50.'],
      [max, !(ma >= 1 && ma <= 50) ? 'Kies een aantal van 1 tot en met 50.' : mi > ma ? 'Het maximum is lager dan het minimum.' : ''],
      [se, s && en && new Date(en) <= new Date(s) ? 'Het einde van de verkoop ligt voor de start.' : ''],
    ];
    let bad = null;
    for (const [el, msg] of errs) { setError(el, msg); if (msg && !bad) bad = el; }
    if (bad) { bad.focus(); return; }
    const payload = { name: n, description: desc.value.trim(), price_cents: p, capacity: c, min_per_order: mi, max_per_order: ma, admits: a, hidden: hidden.input.checked,
      vat_rate: Number(vat.value), valid_label: valid.value.trim(), active: active.input.checked, sale_starts_at: s, sale_ends_at: en };
    if (isNew) payload.event_id = e.id; else { payload.id = t.id; payload.sort = t.sort; }
    const ok = await guard(save, async () => { await rpc('entree_type_save', payload); return true; });
    if (ok) { m.close(); toast(isNew ? 'Ticket toegevoegd.' : 'Ticket opgeslagen.'); await refresh(); }
  } },
    field('Naam', name),
    field('Omschrijving', desc, { optional: true, hint: 'Wat krijgt de koper? Bijvoorbeeld: toegang en een welkomstdrankje.' }),
    h('div', { class: 'grid2' },
      field('Prijs', price, { hint: 'In euro, inclusief btw. 0 is gratis.', wrap: (c) => h('div', { class: 'affix' }, h('span', { 'aria-hidden': 'true' }, '€'), c) }),
      field('Btw-tarief', vat)),
    h('div', { class: 'grid2' },
      field('Aantal beschikbaar', cap, { hint: 'Leeg is onbeperkt.' }),
      field('Personen per ticket', admits, { hint: 'Een duoticket is 2.' })),
    h('div', { class: 'grid2' }, field('Minimaal per bestelling', min), field('Maximaal per bestelling', max)),
    field('Geldig op', valid, { optional: true, hint: 'Staat op het ticket. Handig bij dagkaarten of tijdsloten.' }),
    h('div', { class: 'grid2' }, field('Verkoop start', ss, { optional: true, hint: 'Leeg is direct.' }), field('Verkoop eindigt', se, { optional: true, hint: 'Leeg is tot je het uitzet.' })),
    h('div', { class: 'switches' }, active, hidden),
    !isNew && t.sold > 0 ? notice('info', `Er zijn al ${num(t.sold)} van dit ticket verkocht. Een nieuwe prijs geldt alleen voor nieuwe bestellingen.`) : null);
  const m = openModal({ title: isNew ? 'Nieuw ticket' : 'Ticket bewerken', side: true, body: form, footer: [h('button', { class: 'btn', type: 'button', onclick: () => m.close() }, 'Annuleren'), save] });
}

function tabTickets() {
  const d = S.ev, types = d.types;
  const add = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => typeModal(null) }, icon('plus', 17), 'Nieuw ticket');
  const move = async (btn, i, dir) => {
    const order = types.slice(); const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    const ok = await guard(btn, async () => {
      const jobs = [];
      order.forEach((t, idx) => { if (t.sort !== idx + 1) jobs.push(rpc('entree_type_save', { ...typePayload(t), sort: idx + 1 })); });
      await Promise.all(jobs); return true;
    });
    if (ok) await refresh();
  };
  const rows = types.map((t, i) => {
    const pct = t.capacity ? Math.min(100, (t.sold / t.capacity) * 100) : 0;
    const sw = toggle('', t.active, async (on) => {
      sw.input.disabled = true;
      try { await rpc('entree_type_save', { ...typePayload(t), active: on }); toast(on ? `${t.name} staat aan.` : `${t.name} staat uit.`); await refresh(); }
      catch (ex) { sw.input.checked = !on; sw.input.disabled = false; if (ex.code !== 'session') toast(ex.message, 'err'); }
    });
    sw.input.setAttribute('aria-label', `${t.name} actief`);
    const up = h('button', { class: 'icon-btn', type: 'button', 'aria-label': `${t.name} omhoog`, disabled: i === 0, onclick: () => move(up, i, -1) }, icon('up', 17));
    const down = h('button', { class: 'icon-btn', type: 'button', 'aria-label': `${t.name} omlaag`, disabled: i === types.length - 1, onclick: () => move(down, i, 1) }, icon('down', 17));
    const dup = h('button', { class: 'icon-btn', type: 'button', 'aria-label': `${t.name} dupliceren`, title: 'Dupliceren', onclick: async () => {
      const p = typePayload(t); delete p.id; delete p.sort;
      const ok = await guard(dup, async () => { await rpc('entree_type_save', { ...p, event_id: d.event.id, name: (t.name + ' (kopie)').slice(0, 80), active: false }); return true; });
      if (ok) { toast('Kopie gemaakt. Hij staat nog uit, zodat je hem eerst kunt aanpassen.'); await refresh(); }
    } }, icon('copy', 17));
    const del = h('button', { class: 'icon-btn icon-danger', type: 'button', 'aria-label': `${t.name} verwijderen`, title: 'Verwijderen', onclick: async () => {
      const yes = await confirmDialog({ title: `${t.name} verwijderen`, danger: true, confirmLabel: t.has_orders ? 'Uitzetten' : 'Verwijderen',
        text: t.has_orders ? 'Op dit ticket is al besteld. Daarom verwijderen we het niet, maar zetten we het uit. Bestaande tickets blijven geldig.' : 'Dit ticket is nog nooit besteld en verdwijnt helemaal.' });
      if (!yes) return;
      const r = await guard(del, () => rpc('entree_type_delete', { id: t.id }));
      if (r) { toast(r.archived ? 'Er is al op dit ticket besteld. Het is daarom uitgezet en niet verwijderd.' : 'Ticket verwijderd.'); await refresh(); }
    } }, icon('trash', 17));
    const edit = h('button', { class: 'btn btn-sm', type: 'button', onclick: () => typeModal(t) }, icon('edit', 15), 'Bewerken');
    const sale = [t.sale_starts_at ? 'vanaf ' + fmtShort(t.sale_starts_at) : '', t.sale_ends_at ? 'tot ' + fmtShort(t.sale_ends_at) : ''].filter(Boolean).join(' ');
    return h('li', { class: 'trow' + (t.active ? '' : ' is-off') },
      h('div', { class: 'trow-order' }, up, down),
      h('div', { class: 'trow-main' },
        h('div', { class: 'trow-name' }, h('strong', null, t.name), t.price_cents === 0 ? badge('Gratis', 'green') : null, t.admits > 1 ? badge(`${t.admits} personen`, 'blue') : null, t.hidden ? badge('Verborgen', 'purple') : null, t.active ? null : badge('Uit', 'grey')),
        t.description ? h('p', { class: 'trow-desc' }, t.description) : null,
        h('p', { class: 'trow-meta' }, [t.valid_label ? 'Geldig: ' + t.valid_label : '', `${t.min_per_order} tot ${t.max_per_order} per bestelling`, `${Number(t.vat_rate)}% btw`, sale ? 'Verkoop ' + sale : ''].filter(Boolean).join(' · '))),
      h('div', { class: 'trow-price' }, t.price_cents === 0 ? 'Gratis' : euro(t.price_cents)),
      h('div', { class: 'trow-sold' }, h('span', null, t.capacity != null ? `${num(t.sold)} / ${num(t.capacity)}` : `${num(t.sold)} verkocht`),
        t.capacity != null ? h('div', { class: 'progress', 'aria-hidden': 'true' }, h('span', { class: pct >= 100 ? 'is-full' : '', style: { width: pct + '%' } })) : h('small', null, 'Onbeperkt')),
      h('div', { class: 'trow-actions' }, sw, edit, dup, del));
  });
  return h('div', { class: 'stack' },
    h('div', { class: 'tab-head' }, h('div', null, h('h2', null, 'Tickets'), h('p', { class: 'muted' }, `Kopers betalen ${euro(d.fee_cents)} servicekosten per persoon bovenop de prijs. Gratis tickets hebben geen servicekosten.`)), add),
    types.length ? h('ul', { class: 'card list' }, rows)
      : h('div', { class: 'card' }, empty('ticket', 'Nog geen tickets', 'Maak je eerste ticket. Je kiest de prijs, het aantal en wanneer de verkoop start.', h('button', { class: 'btn btn-primary', type: 'button', onclick: () => typeModal(null) }, icon('plus', 17), 'Nieuw ticket'))));
}

// ---------- Kortingscodes ----------
function codeModal(c) {
  const isNew = !c;
  const d = S.ev;
  c = c || { code: '', kind: 'percent', value: null, max_uses: null, active: true, starts_at: null, ends_at: null, applies_to: null };
  let kind = c.kind;
  const code = h('input', { type: 'text', maxlength: '30', class: 'mono', value: c.code, placeholder: 'VROEG10', autocapitalize: 'characters', spellcheck: false, oninput: () => { code.value = code.value.toUpperCase().replace(/\s/g, ''); } });
  const value = h('input', { type: 'text', inputmode: 'decimal', value: c.value == null ? '' : kind === 'percent' ? String(c.value) : centsToInput(c.value) });
  const affix = h('span', { 'aria-hidden': 'true' }, kind === 'percent' ? '%' : '€');
  const kindBtns = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Soort korting' }, [['percent', 'Percentage'], ['amount', 'Vast bedrag']].map(([k, l]) => {
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(kind === k), class: kind === k ? 'is-on' : '', onclick: () => {
      kind = k; affix.textContent = k === 'percent' ? '%' : '€';
      kindBtns.querySelectorAll('button').forEach((x) => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-checked', String(on)); });
    } }, l);
    return b;
  }));
  const maxUses = h('input', { type: 'text', inputmode: 'numeric', value: c.max_uses == null ? '' : String(c.max_uses), placeholder: 'Onbeperkt' });
  const st = h('input', { type: 'datetime-local', value: toLocalInput(c.starts_at) });
  const en = h('input', { type: 'datetime-local', value: toLocalInput(c.ends_at) });
  const active = toggle('Actief', c.active, null, 'Een code die uit staat werkt niet.');
  const chosen = new Set(c.applies_to || []);
  let all = !chosen.size;
  const typeList = h('div', { class: 'checks', hidden: all }, d.types.map((t) => {
    const cb = h('input', { type: 'checkbox', checked: chosen.has(t.id), onchange: () => { if (cb.checked) chosen.add(t.id); else chosen.delete(t.id); } });
    return h('label', { class: 'checkline' }, cb, h('span', null, t.name), t.hidden ? badge('Verborgen', 'purple') : null, t.active ? null : badge('Uit', 'grey'));
  }), d.types.length ? null : h('p', { class: 'hint' }, 'Je hebt nog geen tickets. Maak die eerst aan.'));
  const scope = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Geldt voor' }, [[true, 'Alle tickets'], [false, 'Gekozen tickets']].map(([v, l]) => {
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(all === v), class: all === v ? 'is-on' : '', onclick: () => {
      all = v; typeList.hidden = v;
      scope.querySelectorAll('button').forEach((x) => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-checked', String(on)); });
    } }, l);
    return b;
  }));
  const scopeErr = h('p', { class: 'error', role: 'alert', hidden: true }, 'Vink minstens één ticket aan, of kies Alle tickets.');
  const save = h('button', { class: 'btn btn-primary', type: 'submit', form: 'code-form' }, isNew ? 'Code toevoegen' : 'Opslaan');
  const form = h('form', { id: 'code-form', novalidate: true, onsubmit: async (ev) => {
    ev.preventDefault();
    const cd = code.value.trim().toUpperCase();
    let v = kind === 'percent' ? (/^\d+$/.test(value.value.trim()) ? parseInt(value.value.trim(), 10) : NaN) : parseEuro(value.value);
    const mu = intOrNull(maxUses.value), s = fromLocalInput(st.value), e2 = fromLocalInput(en.value);
    const errs = [
      [code, /^[A-Z0-9_-]{2,30}$/.test(cd) ? '' : 'Gebruik 2 tot 30 letters, cijfers, streepjes of underscores, zonder spaties.'],
      [value, Number.isNaN(v) || v <= 0 ? (kind === 'percent' ? 'Vul een heel percentage in van 1 tot en met 100.' : 'Vul een bedrag in, bijvoorbeeld 5,00.') : kind === 'percent' && v > 100 ? 'Een percentage is maximaal 100.' : ''],
      [maxUses, Number.isNaN(mu) || mu === 0 ? 'Vul een heel getal in vanaf 1, of laat het veld leeg voor onbeperkt.' : ''],
      [en, s && e2 && new Date(e2) <= new Date(s) ? 'Het einde ligt voor het begin.' : ''],
    ];
    let bad = null;
    for (const [el, msg] of errs) { setError(el, msg); if (msg && !bad) bad = el; }
    scopeErr.hidden = all || chosen.size > 0;
    if (bad) { bad.focus(); return; }
    if (!scopeErr.hidden) return;
    const payload = { event_id: d.event.id, code: cd, kind, value: v, max_uses: mu, active: active.input.checked, starts_at: s, ends_at: e2, applies_to: all ? null : [...chosen] };
    if (!isNew) payload.id = c.id;
    const ok = await guard(save, async () => { await rpc('entree_code_save', payload); return true; });
    if (ok) { m.close(); toast(isNew ? 'Kortingscode toegevoegd.' : 'Kortingscode opgeslagen.'); await refresh(); }
  } },
    field('Code', code, { hint: 'Dit typt de koper in. Hoofdletters maken niet uit.' }),
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Soort korting'), kindBtns),
    field('Korting', value, { wrap: (x) => h('div', { class: 'affix' }, affix, x) }),
    field('Maximaal aantal keer te gebruiken', maxUses, { hint: 'Leeg is onbeperkt.' }),
    h('div', { class: 'grid2' }, field('Geldig vanaf', st, { optional: true }), field('Geldig tot', en, { optional: true })),
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Geldt voor'), scope, typeList, scopeErr,
      h('p', { class: 'hint' }, 'Kies je een verborgen ticket, dan ontgrendelt de code dat ticket in de shop.')),
    h('div', { class: 'switches' }, active));
  const m = openModal({ title: isNew ? 'Nieuwe kortingscode' : 'Kortingscode bewerken', side: true, body: form, footer: [h('button', { class: 'btn', type: 'button', onclick: () => m.close() }, 'Annuleren'), save] });
}

function tabCodes() {
  const d = S.ev;
  const names = new Map(d.types.map((t) => [t.id, t.name]));
  const add = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => codeModal(null) }, icon('plus', 17), 'Nieuwe code');
  const rows = d.codes.map((c) => {
    const del = h('button', { class: 'icon-btn icon-danger', type: 'button', 'aria-label': `Code ${c.code} verwijderen`, onclick: async () => {
      const yes = await confirmDialog({ title: `Code ${c.code} verwijderen`, danger: true, confirmLabel: 'Verwijderen', text: 'De code werkt daarna niet meer. Bestellingen die de code al gebruikten houden hun korting.' });
      if (!yes) return;
      const ok = await guard(del, async () => { await rpc('entree_code_delete', { id: c.id }); return true; });
      if (ok) { toast('Kortingscode verwijderd.'); await refresh(); }
    } }, icon('trash', 17));
    const applies = c.applies_to && c.applies_to.length ? c.applies_to.map((id) => names.get(id) || 'verwijderd ticket').join(', ') : 'Alle tickets';
    const when = [c.starts_at ? 'vanaf ' + fmtShort(c.starts_at) : '', c.ends_at ? 'tot ' + fmtShort(c.ends_at) : ''].filter(Boolean).join(' ');
    return h('li', { class: 'crow' + (c.active ? '' : ' is-off') },
      h('div', { class: 'crow-main' },
        h('div', { class: 'trow-name' }, h('strong', { class: 'mono code-chip' }, c.code), c.active ? null : badge('Uit', 'grey')),
        h('p', { class: 'trow-meta' }, [applies, when ? 'Geldig ' + when : ''].filter(Boolean).join(' · '))),
      h('div', { class: 'crow-val' }, c.kind === 'percent' ? `${c.value}%` : euro(c.value), h('small', null, 'korting')),
      h('div', { class: 'crow-used' }, c.max_uses != null ? `${num(c.used_count)} / ${num(c.max_uses)}` : num(c.used_count), h('small', null, 'keer gebruikt')),
      h('div', { class: 'trow-actions' }, h('button', { class: 'btn btn-sm', type: 'button', onclick: () => codeModal(c) }, icon('edit', 15), 'Bewerken'), del));
  });
  return h('div', { class: 'stack' },
    h('div', { class: 'tab-head' }, h('div', null, h('h2', null, 'Kortingscodes'), h('p', { class: 'muted' }, 'Geef korting met een code die de koper in de shop invult.')), add),
    d.codes.length ? h('ul', { class: 'card list' }, rows)
      : h('div', { class: 'card' }, empty('tag', 'Nog geen kortingscodes', 'Maak een code voor vroegboekers, partners of je gastenlijst.', h('button', { class: 'btn btn-primary', type: 'button', onclick: () => codeModal(null) }, icon('plus', 17), 'Nieuwe code'))),
    notice('info', h('strong', null, 'Gastenlijst of voorverkoop. '), 'Maak een verborgen ticket en een code die alleen voor dat ticket geldt. Wie de code invult, ziet het ticket. Met 100% korting is het een gastenlijst, zonder korting een besloten voorverkoop.'));
}

// ---------- Vragen ----------
const newKey = () => 'v' + Math.random().toString(36).slice(2, 8).replace(/[^a-z0-9]/g, 'x');
const cleanFields = (list) => (list || []).map((f) => ({ key: f.key, label: f.label || '', type: ['select', 'checkbox'].includes(f.type) ? f.type : 'text', required: !!f.required, options: Array.isArray(f.options) ? f.options.slice() : [] }));

function tabQuestions() {
  const e = S.ev.event;
  const server = cleanFields((e.shop || {}).fields);
  let draft = S.fieldDrafts.get(e.id);
  if (!draft || !draft.dirty) { draft = { fields: cleanFields(server), dirty: false }; S.fieldDrafts.set(e.id, draft); }
  const listEl = h('div', { class: 'qlist' });
  const state = h('span', { class: 'savebar-state' });
  const save = h('button', { class: 'btn btn-primary', type: 'button' }, 'Opslaan');
  const reset = h('button', { class: 'btn', type: 'button' }, 'Terugzetten');
  const add = h('button', { class: 'btn', type: 'button' }, icon('plus', 17), 'Vraag toevoegen');
  const bar = h('div', { class: 'savebar' }, state, h('div', { class: 'row' }, reset, save));

  const sync = () => {
    draft.dirty = JSON.stringify(draft.fields) !== JSON.stringify(server);
    state.textContent = draft.dirty ? 'Je hebt onopgeslagen wijzigingen' : 'Alles is opgeslagen';
    bar.classList.toggle('is-dirty', draft.dirty);
    save.disabled = !draft.dirty; reset.disabled = !draft.dirty;
    add.disabled = draft.fields.length >= 8;
    const dotHost = document.querySelector('.tabs .tab.is-on');
    if (dotHost) dotHost.classList.toggle('has-dot', draft.dirty);
  };
  const draw = () => {
    listEl.replaceChildren(...(draft.fields.length ? draft.fields.map((f, i) => {
      const label = h('input', { type: 'text', maxlength: '120', value: f.label, placeholder: 'Bijvoorbeeld: Heb je dieetwensen?', oninput: () => { f.label = label.value; sync(); } });
      const type = h('select', { value: f.type, onchange: () => { f.type = type.value; draw(); sync(); } }, h('option', { value: 'text' }, 'Tekst'), h('option', { value: 'select' }, 'Keuzelijst'), h('option', { value: 'checkbox' }, 'Vinkje'));
      const opts = h('textarea', { rows: '3', value: f.options.join('\n'), placeholder: 'Eén keuze per regel', oninput: () => { f.options = opts.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 20); sync(); } });
      const req = toggle('Verplicht', f.required, (on) => { f.required = on; sync(); }, f.type === 'checkbox' ? 'De koper moet het vinkje zetten om te kunnen bestellen.' : null);
      const mv = (dir) => { const j = i + dir; [draft.fields[i], draft.fields[j]] = [draft.fields[j], draft.fields[i]]; draw(); sync(); };
      return h('div', { class: 'card pad qcard' },
        h('div', { class: 'qcard-head' }, h('span', { class: 'qcard-n' }, `Vraag ${i + 1}`),
          h('div', { class: 'row' },
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Vraag ${i + 1} omhoog`, disabled: i === 0, onclick: () => mv(-1) }, icon('up', 17)),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Vraag ${i + 1} omlaag`, disabled: i === draft.fields.length - 1, onclick: () => mv(1) }, icon('down', 17)),
            h('button', { class: 'icon-btn icon-danger', type: 'button', 'aria-label': `Vraag ${i + 1} verwijderen`, onclick: () => { draft.fields.splice(i, 1); draw(); sync(); } }, icon('trash', 17)))),
        h('div', { class: 'grid2 grid-21' }, field('Vraag', label), field('Soort antwoord', type)),
        f.type === 'select' ? field('Keuzes', opts, { hint: 'Maximaal 20 keuzes, elk op een eigen regel.' }) : null,
        req);
    }) : [h('div', { class: 'card' }, empty('help', 'Nog geen vragen', 'Je vraagt standaard alleen naam en e-mailadres. Voeg een vraag toe als je meer wilt weten, zoals dieetwensen of een T-shirtmaat.'))]));
  };
  add.onclick = () => { draft.fields.push({ key: newKey(), label: '', type: 'text', required: false, options: [] }); draw(); sync(); const inputs = listEl.querySelectorAll('.qcard input[type=text]'); if (inputs.length) inputs[inputs.length - 1].focus(); };
  reset.onclick = () => { draft.fields = cleanFields(server); draw(); sync(); };
  save.onclick = async () => {
    const cards = [...listEl.querySelectorAll('.qcard')];
    let bad = null;
    draft.fields.forEach((f, i) => {
      const label = cards[i].querySelector('input[type=text]');
      const msg = f.label.trim() ? '' : 'Typ de vraag die je wilt stellen.';
      setError(label, msg); if (msg && !bad) bad = label;
      if (f.type === 'select') { const ta = cards[i].querySelector('textarea'); const m2 = f.options.length >= 2 ? '' : 'Geef minstens twee keuzes, elk op een eigen regel.'; setError(ta, m2); if (m2 && !bad) bad = ta; }
    });
    if (bad) { bad.focus(); return; }
    const fields = draft.fields.map((f) => ({ ...f, label: f.label.trim(), options: f.type === 'select' ? f.options : [] }));
    const ok = await guard(save, async () => {
      // shop wordt in zijn geheel vervangen: altijd samenvoegen met wat er nu staat
      const fresh = await rpc('entree_event_get', { event_id: e.id });
      await rpc('entree_event_save', { id: e.id, shop: { ...(fresh.event.shop || {}), fields } });
      return true;
    });
    if (ok) { S.fieldDrafts.delete(e.id); toast('Vragen opgeslagen.'); await refresh(); }
  };
  draw(); sync();
  return h('div', { class: 'stack narrow' },
    h('div', { class: 'tab-head' }, h('div', null, h('h2', null, 'Vragen aan de koper'), h('p', { class: 'muted' }, 'Extra vragen bij het afrekenen, naast naam en e-mailadres. Maximaal 8. De antwoorden zie je bij de bestelling en in de export.')), add),
    listEl, bar);
}

// ---------- Op je site ----------
function codeBlock(label, text, onCopy) {
  const pre = h('pre', { class: 'codeblock', tabindex: '0' }, h('code', null, text));
  const btn = h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => { if (await copyText(text, 'Code gekopieerd')) onCopy(); } }, icon('copy', 15), 'Kopieer code');
  return h('div', { class: 'codewrap' }, h('div', { class: 'codewrap-head' }, h('strong', null, label), btn), pre);
}

function tabSite() {
  const e = S.ev.event;
  const url = shopUrl(e.slug), script = `<script async src="${BASE}/embed.js"></` + 'script>';
  const inline = `<div data-entree-shop="${e.slug}"></div>\n${script}`;
  const button = `<button data-entree-button="${e.slug}">Tickets</button>\n${script}`;
  const mark = () => { if (!local.get(embedKey())) { local.set(embedKey(), '1'); } done.input.checked = true; };
  const done = toggle('Ik heb de shop op mijn site gezet of de link gedeeld', !!local.get(embedKey()), (on) => { local.set(embedKey(), on ? '1' : ''); });
  const how = (title, steps) => h('details', { class: 'how-item' }, h('summary', null, title), h('ol', null, steps.map((s) => h('li', null, s))));
  const mail = `mailto:?subject=${encodeURIComponent('Ticketshop op de website zetten')}&body=${encodeURIComponent(`Hoi,\n\nWil je onze ticketshop op de website zetten? Plak deze code op de plek waar de shop moet komen:\n\n${inline}\n\nLiever een knop die de shop opent? Gebruik dan:\n\n${button}\n\nDe directe link naar de shop is ${url}\n\nDank je!`)}`;
  return h('div', { class: 'stack' },
    e.shop_live ? null : notice('warn', h('strong', null, 'Je shop staat nog niet live. '), 'De link en de code werken al, maar bezoekers zien dat de verkoop nog niet open is. ', h('a', { href: tabHref('overzicht') }, 'Naar Live zetten')),
    h('section', { class: 'card pad' },
      h('h2', null, 'Je shoplink'),
      h('p', { class: 'muted' }, 'Geen website? Zet deze link in je bio op Instagram, in je nieuwsbrief of in een WhatsApp-bericht.'),
      h('div', { class: 'link-qr' },
        h('div', { class: 'link-qr-main' },
          copyRow('Link naar je shop', url, { toast: 'Link gekopieerd', onCopy: mark, extra: h('a', { class: 'btn', href: url, target: '_blank', rel: 'noopener', 'aria-label': 'Shop openen in een nieuw tabblad' }, icon('external', 16)) }),
          copyRow('Voorbeeldlink', previewUrl(e), { toast: 'Voorbeeldlink gekopieerd', hint: 'Werkt ook als je event nog niet live is. Bestellingen via deze link zijn testbestellingen. Deel hem alleen met je team.' })),
        h('div', { class: 'qr-box' }, qrNode(url, 148),
          h('div', { class: 'row center' },
            h('button', { class: 'btn btn-sm', type: 'button', onclick: () => qrDownloadPng(url, `${e.slug}-qr.png`) }, icon('download', 15), 'PNG'),
            h('button', { class: 'btn btn-sm', type: 'button', onclick: () => qrDownloadSvg(url, `${e.slug}-qr.svg`) }, icon('download', 15), 'SVG')),
          h('p', { class: 'hint' }, 'QR-code voor posters en flyers')))),
    h('section', { class: 'card pad' },
      h('h2', null, 'De shop op je eigen website'),
      h('p', { class: 'muted' }, 'Kies een van de twee. De shop neemt je huisstijl over en past zich aan de breedte van je pagina aan.'),
      h('div', { class: 'grid2 embed-grid' },
        h('div', null, codeBlock('Shop in de pagina', inline, mark), h('p', { class: 'hint' }, 'De tickets staan direct op je pagina, op de plek waar je de code plakt.')),
        h('div', null, codeBlock('Knop die de shop opent', button, mark), h('p', { class: 'hint' }, 'Een knop Tickets. Bij een klik opent de shop over je pagina heen. De tekst op de knop mag je aanpassen.'))),
      h('h3', null, 'Zo plak je de code'),
      h('div', { class: 'how-list' },
        how('WordPress', ['Open de pagina in de editor.', 'Voeg een blok toe en kies Aangepaste HTML.', 'Plak de code in het blok en werk de pagina bij.']),
        how('Wix', ['Open de pagina in de editor.', 'Klik op Toevoegen, dan Insluiten, dan HTML insluiten.', 'Kies Code invoeren, plak de code en klik op Bijwerken. Maak het vak hoog genoeg voor de shop.']),
        how('Squarespace', ['Open de pagina en klik op een invoegpunt.', 'Kies het blok Code.', 'Plak de code, zet Bron tonen uit en sla op.']),
        how('Webflow', ['Open de Designer en sleep een Embed-element naar je pagina.', 'Plak de code en sla op.', 'Publiceer je site. In de Designer zelf zie je de shop nog niet.']),
        how('Een andere website', ['Plak de code in de HTML van de pagina, op de plek waar de shop moet komen.', 'Staat het script al ergens op de pagina, dan hoef je het geen tweede keer te plakken.'])),
      h('div', { class: 'form-actions start' }, h('a', { class: 'btn', href: mail, onclick: mark }, icon('mail', 16), 'Stuur dit naar je webbouwer'))),
    h('section', { class: 'card pad' }, done));
}

// ---------- Scannen ----------
function tabScan() {
  const d = S.ev, st = d.stats;
  const label = h('input', { type: 'text', maxlength: '60', placeholder: 'Bijvoorbeeld: Ingang noord' });
  const addBtn = h('button', { class: 'btn btn-primary', type: 'submit' }, icon('plus', 17), 'Scanlink maken');
  const addForm = h('form', { class: 'add-row', novalidate: true, onsubmit: async (ev) => {
    ev.preventDefault();
    const ok = await guard(addBtn, async () => { await rpc('entree_scanlink_save', { action: 'create', event_id: d.event.id, label: label.value.trim() || 'Ingang' }); return true; });
    if (ok) { toast('Scanlink gemaakt.'); await refresh(); }
  } }, field('Naam van de nieuwe scanlink', label), addBtn);
  const cards = d.scan_links.map((l) => {
    const url = scanUrl(l.token);
    const sw = toggle('Aan', l.active, async (on) => {
      sw.input.disabled = true;
      try { await rpc('entree_scanlink_save', { action: 'update', id: l.id, active: on }); toast(on ? 'Scanlink staat aan.' : 'Scanlink staat uit. Scannen met deze link werkt niet meer.'); await refresh(); }
      catch (ex) { sw.input.checked = !on; sw.input.disabled = false; if (ex.code !== 'session') toast(ex.message, 'err'); }
    });
    sw.input.setAttribute('aria-label', `Scanlink ${l.label} aan`);
    const name = h('input', { type: 'text', maxlength: '60', value: l.label, 'aria-label': 'Naam van de scanlink' });
    const rename = h('button', { class: 'btn btn-sm', type: 'submit' }, 'Naam opslaan');
    const del = h('button', { class: 'btn btn-sm btn-danger-ghost', type: 'button', onclick: async () => {
      const yes = await confirmDialog({ title: `Scanlink ${l.label} verwijderen`, danger: true, confirmLabel: 'Verwijderen', text: 'Wie deze link op zijn telefoon heeft, kan daarna niet meer scannen. Ingecheckte tickets blijven ingecheckt.' });
      if (!yes) return;
      const ok = await guard(del, async () => { await rpc('entree_scanlink_save', { action: 'delete', id: l.id }); return true; });
      if (ok) { toast('Scanlink verwijderd.'); await refresh(); }
    } }, icon('trash', 15), 'Verwijderen');
    return h('li', { class: 'card pad scan-card' + (l.active ? '' : ' is-off') },
      h('div', { class: 'scan-main' },
        h('form', { class: 'scan-name', novalidate: true, onsubmit: async (ev) => {
          ev.preventDefault();
          const v = name.value.trim();
          if (!v || v === l.label) return;
          const ok = await guard(rename, async () => { await rpc('entree_scanlink_save', { action: 'update', id: l.id, label: v }); return true; });
          if (ok) { toast('Naam opgeslagen.'); await refresh(); }
        } }, name, rename),
        copyRow('Link voor de scanner', url, { toast: 'Scanlink gekopieerd', extra: h('a', { class: 'btn', href: url, target: '_blank', rel: 'noopener', 'aria-label': 'Scanner openen in een nieuw tabblad' }, icon('external', 16)) }),
        h('p', { class: 'hint' }, l.last_used_at ? `Laatst gebruikt op ${fmtShort(l.last_used_at)}.` : 'Nog niet gebruikt.'),
        h('div', { class: 'scan-actions' }, sw, del)),
      h('div', { class: 'qr-box' }, qrNode(url, 132), h('p', { class: 'hint' }, 'Scan met de telefoon van je deurmedewerker')));
  });
  return h('div', { class: 'stack' },
    h('div', { class: 'tab-head' }, h('div', null, h('h2', null, 'Scannen aan de deur'),
      h('p', { class: 'muted' }, 'Een scanlink opent de scanner in de browser van een telefoon. Je deurmedewerker heeft geen account en geen app nodig. Maak per ingang een eigen link, dan kun je er een uitzetten zonder de rest te storen.')),
      h('div', { class: 'kpi kpi-inline' }, h('p', { class: 'kpi-label' }, 'Ingecheckt'), h('p', { class: 'kpi-value' }, `${num(st.checked_in)} / ${num(st.tickets)}`))),
    d.scan_links.length ? h('ul', { class: 'scan-list' }, cards) : h('div', { class: 'card' }, empty('scan', 'Nog geen scanlinks', 'Maak hieronder een scanlink voor je ingang.')),
    h('section', { class: 'card pad' }, h('h2', null, 'Nieuwe scanlink'), addForm));
}

void euroShort;

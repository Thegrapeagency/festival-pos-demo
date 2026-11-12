// Overzicht van alle events en de instellingen van de organisatie.
import { rpc, fn, sessionEmail } from './api.js';
import { h, icon, toast, guard, field, setError, badge, notice, empty, openModal, confirmDialog, euro, num, fmtDate, fromLocalInput } from './ui.js';
import { S, loadState } from './store.js';
import { doLogout } from './app.js';

export function statusBadge(e) {
  if (e.archived) return badge('Gearchiveerd', 'grey');
  return e.shop_live ? badge('Live', 'green') : badge('Concept', 'amber');
}

export function payBanner(mode, compact) {
  if (mode === 'live') return compact ? null : notice('ok', h('strong', null, 'Betalingen gekoppeld. '), 'Je Mollie-account staat in live modus. Het ticketgeld komt op je eigen rekening.');
  if (mode === 'test') return notice('warn', h('strong', null, 'Mollie staat in testmodus. '), 'Bestellingen worden niet echt betaald. Koppel je Live API key om echt te verkopen. ', h('a', { href: '#/settings' }, 'Naar Betalingen'));
  return notice('info', h('strong', null, 'Betalingen nog niet gekoppeld. '), 'Voor betaalde tickets koppel je je eigen Mollie-account. Gratis tickets kun je nu al aanbieden. ', h('a', { href: '#/settings' }, 'Mollie koppelen'));
}

export function newEventModal() {
  const name = h('input', { type: 'text', maxlength: '80', required: true, placeholder: 'Bijvoorbeeld: Zomerfeest 2027' });
  const start = h('input', { type: 'datetime-local' });
  const loc = h('input', { type: 'text', maxlength: '160' });
  const save = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Event maken');
  const form = h('form', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    const n = name.value.trim();
    if (!n) return setError(name, 'Geef je event een naam.');
    setError(name, '');
    const r = await guard(save, () => rpc('entree_event_save', { name: n, starts_at: fromLocalInput(start.value), location: loc.value.trim() }));
    if (!r) return;
    m.close();
    toast('Event gemaakt.');
    loadState().catch(() => {});
    location.hash = `#/event/${r.id}/overzicht`;
  } },
    field('Naam van je event', name), field('Wanneer begint het', start, { optional: true }), field('Waar is het', loc, { optional: true }),
    h('p', { class: 'hint' }, 'De link van je shop maken we van de naam. Die link verandert daarna niet meer.'));
  save.setAttribute('form', form.id = 'new-event-form');
  const m = openModal({ title: 'Nieuw event', body: form, footer: [h('button', { class: 'btn', type: 'button', onclick: () => m.close() }, 'Annuleren'), save] });
}

function eventCard(e) {
  const color = /^#[0-9a-f]{6}$/i.test(e.primary || '') ? e.primary : '#0e9f6e';
  const thumb = h('div', { class: 'ev-thumb', style: { '--c': color } },
    e.logo_url ? h('img', { src: e.logo_url, alt: '', loading: 'lazy' }) : h('span', { 'aria-hidden': 'true' }, (e.name || '?').trim().charAt(0).toUpperCase()));
  return h('a', { class: 'ev-card' + (e.archived ? ' is-archived' : ''), href: `#/event/${e.id}/overzicht` },
    thumb,
    h('div', { class: 'ev-body' },
      h('div', { class: 'ev-top' }, h('h3', null, e.name), statusBadge(e)),
      h('p', { class: 'ev-meta' }, icon('calendar', 15), e.starts_at ? fmtDate(e.starts_at) : 'Nog geen datum'),
      e.location ? h('p', { class: 'ev-meta' }, icon('pin', 15), e.location) : null,
      h('dl', { class: 'ev-stats' },
        h('div', null, h('dt', null, 'Tickets verkocht'), h('dd', null, num(e.tickets))),
        h('div', null, h('dt', null, 'Omzet'), h('dd', null, euro(e.revenue_cents))))));
}

export function viewHome() {
  const s = S.state;
  const active = s.events.filter((e) => !e.archived);
  const archived = s.events.filter((e) => e.archived);
  const add = h('button', { class: 'btn btn-primary', type: 'button', onclick: newEventModal }, icon('plus', 17), 'Nieuw event');
  return h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Je events'), h('p', { class: 'muted' }, s.org.name)), add),
    payBanner(s.payments.mode, true),
    active.length
      ? h('div', { class: 'ev-grid' }, active.map(eventCard))
      : h('div', { class: 'card' }, empty('ticket', 'Nog geen events', 'Maak je eerste event aan. Daarna voeg je tickets toe en zet je de shop op je site.',
        h('button', { class: 'btn btn-primary', type: 'button', onclick: newEventModal }, icon('plus', 17), 'Nieuw event'))),
    archived.length ? h('details', { class: 'archived' }, h('summary', null, `Gearchiveerd (${archived.length})`), h('div', { class: 'ev-grid' }, archived.map(eventCard))) : null);
}

// ---------- instellingen ----------
export function viewSettings() {
  const s = S.state;
  const root = h('div', { class: 'page page-narrow' });
  const redraw = () => root.replaceChildren(...build());

  function build() {
    // organisatie
    const name = h('input', { type: 'text', maxlength: '80', value: s.org.name || '' });
    const mail = h('input', { type: 'email', value: s.org.contact_email || '', placeholder: 'info@jouwevent.nl' });
    const saveOrg = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Opslaan');
    const orgForm = h('form', { class: 'card pad', novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      const n = name.value.trim(), m = mail.value.trim();
      setError(name, n ? '' : 'Vul de naam van je organisatie in.');
      const mailOk = m === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m);
      setError(mail, mailOk ? '' : 'Vul een geldig e-mailadres in of laat het veld leeg.');
      if (!n || !mailOk) return;
      const ok = await guard(saveOrg, async () => { await rpc('entree_org_save', { name: n, contact_email: m }); await loadState(); return true; });
      if (ok) { toast('Organisatie opgeslagen.'); S.render(); }
    } },
      h('h2', null, 'Organisatie'),
      field('Naam van je organisatie', name, { hint: 'Staat als afzender op de ticketmail en in de shop.' }),
      field('Contact-e-mail', mail, { optional: true, hint: 'Het adres waarop kopers je kunnen bereiken. Per event kun je een ander adres kiezen.' }),
      h('div', { class: 'form-actions' }, saveOrg));

    // betalingen
    const mode = S.state.payments.mode;
    const fee = euro(S.state.fee_cents);
    const status = mode === 'live' ? badge('Live', 'green') : mode === 'test' ? badge('Testmodus', 'amber') : badge('Niet gekoppeld', 'grey');
    const key = h('input', { type: 'password', autocomplete: 'off', spellcheck: false, placeholder: 'live_... of test_...', class: 'mono', name: 'mollie-key' });
    const connect = h('button', { class: 'btn btn-primary', type: 'submit' }, mode === 'none' ? 'Koppelen' : 'Sleutel vervangen');
    const result = h('div', { 'aria-live': 'polite' });
    const payForm = h('form', { novalidate: true, autocomplete: 'off', onsubmit: async (e) => {
      e.preventDefault();
      const k = key.value.trim();
      if (!/^(live|test)_[A-Za-z0-9]{20,}$/.test(k)) return setError(key, 'Dit lijkt geen Mollie API-sleutel. Hij begint met live_ of test_ en is minstens 25 tekens lang.');
      setError(key, '');
      const r = await guard(connect, () => fn('connect', { key: k }));
      key.value = '';
      if (!r) return;
      try { await loadState(); } catch { /* status wordt bij de volgende keer laden bijgewerkt */ }
      toast(r.mode === 'test' ? 'Mollie gekoppeld in testmodus.' : 'Mollie gekoppeld. Je kunt betaalde tickets verkopen.');
      redraw();
      const methods = Array.isArray(r.methods) ? r.methods : [];
      root.querySelector('#pay-result').replaceChildren(methods.length
        ? notice('ok', h('strong', null, r.mode === 'test' ? 'Gekoppeld in testmodus. ' : 'Gekoppeld in live modus. '), 'Gevonden betaalmethoden: ', methods.join(', '), '.')
        : notice('warn', h('strong', null, 'Gekoppeld, maar er staan nog geen betaalmethoden aan. '), 'Zet in je Mollie-dashboard minstens iDEAL aan, anders kunnen kopers niet afrekenen.'));
    } },
      field('Mollie API-sleutel', key, { hint: 'We bewaren de sleutel versleuteld op de server en tonen hem nooit terug.' }),
      h('div', { class: 'form-actions' }, connect));
    const disconnect = mode === 'none' ? null : h('button', { class: 'btn btn-danger-ghost', type: 'button', onclick: async () => {
      const yes = await confirmDialog({ title: 'Mollie ontkoppelen', danger: true, confirmLabel: 'Ontkoppelen',
        text: ['Als je ontkoppelt, gaan alle events met betaalde tickets direct offline. Kopers kunnen dan niet meer bestellen tot je opnieuw een sleutel koppelt.', 'Events met alleen gratis tickets blijven gewoon werken.'] });
      if (!yes) return;
      const ok = await guard(disconnect, async () => { await fn('disconnect', {}); await loadState(); S.ev = null; S.evId = null; return true; });
      if (ok) { toast('Mollie is ontkoppeld.'); redraw(); }
    } }, 'Mollie ontkoppelen');

    const pay = h('section', { class: 'card pad', id: 'betalingen' },
      h('div', { class: 'card-head' }, h('h2', null, 'Betalingen'), status),
      h('p', { class: 'muted' }, mode === 'live' ? 'Je Mollie-account is gekoppeld. Kopers betalen met de betaalmethoden die jij in Mollie hebt aangezet.'
        : mode === 'test' ? 'Je hebt een Test API key gekoppeld. Je kunt de hele bestelling oefenen, maar er wordt niets echt betaald. Vervang hem door je Live API key als je klaar bent.'
        : 'Entree rekent af via Mollie. Je koppelt je eigen Mollie-account, zodat het geld rechtstreeks bij jou binnenkomt.'),
      h('ol', { class: 'how' },
        h('li', null, 'Maak gratis een account op ', h('a', { href: 'https://www.mollie.com', target: '_blank', rel: 'noopener' }, 'mollie.com'), '.'),
        h('li', null, 'Rond de verificatie van je bedrijf en je bankrekening af. Mollie vraagt hierom voordat je geld kunt ontvangen.'),
        h('li', null, 'Ga in je Mollie-dashboard naar ', h('strong', null, 'Developers'), ' en dan ', h('strong', null, 'API-keys'), '.'),
        h('li', null, 'Kopieer de ', h('strong', null, 'Live API key'), ' en plak hem hieronder. Met de ', h('strong', null, 'Test API key'), ' kun je eerst oefenen.')),
      payForm, h('div', { id: 'pay-result' }, result),
      disconnect ? h('div', { class: 'danger-zone' }, h('p', { class: 'muted' }, 'Stoppen met online betalen via dit Mollie-account.'), disconnect) : null);

    const cost = h('section', { class: 'card pad' },
      h('h2', null, 'Wat kost Entree'),
      h('ul', { class: 'plain' },
        h('li', null, icon('check', 17), h('span', null, 'Het ticketgeld gaat rechtstreeks naar je eigen Mollie-rekening. Entree zit daar niet tussen.')),
        h('li', null, icon('check', 17), h('span', null, `De koper betaalt per ticket ${fee} servicekosten, bovenop de ticketprijs. Bij een ticket voor meerdere personen geldt dat bedrag per persoon.`)),
        h('li', null, icon('check', 17), h('span', null, 'Die servicekosten komen eerst met de rest op jouw rekening. Entree stuurt je daar achteraf een factuur voor.')),
        h('li', null, icon('check', 17), h('span', null, 'Gratis tickets kosten niets, voor jou niet en voor de koper niet.')),
        h('li', null, icon('check', 17), h('span', null, 'Mollie rekent zelf een klein bedrag per betaling. Dat zie je in je Mollie-dashboard.'))));

    const out = h('button', { class: 'btn', type: 'button', onclick: () => guard(out, doLogout) }, icon('logout', 16), 'Uitloggen');
    const account = h('section', { class: 'card pad' },
      h('h2', null, 'Account'),
      h('p', { class: 'muted' }, 'Je bent ingelogd als ', h('strong', null, sessionEmail() || 'onbekend'), '.'),
      h('div', { class: 'form-actions' }, out));

    return [h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Instellingen'), h('p', { class: 'muted' }, 'Gelden voor al je events.'))), orgForm, pay, cost, account];
  }
  redraw();
  return root;
}

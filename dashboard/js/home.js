// Overzicht van alle events en de instellingen van de organisatie.
import { rpc, sessionEmail } from './api.js';
import { h, icon, toast, guard, field, setError, badge, notice, empty, openModal, euro, num, fmtDate, fromLocalInput, BRAND } from './ui.js';
import { paymentsSection } from './payouts.js';
import { S, loadState } from './store.js';
import { doLogout } from './app.js';

export function statusBadge(e) {
  if (e.archived) return badge('Gearchiveerd', 'grey');
  return e.shop_live ? badge('Live', 'green') : badge('Concept', 'amber');
}

export function payBanner(mode, compact) {
  if (mode === 'platform') return compact ? null : notice('ok', h('strong', null, 'Betalingen geregeld. '), `Kopers betalen aan ${BRAND} en wij maken je saldo elke week naar je over.`);
  if (mode === 'live') return compact ? null : notice('ok', h('strong', null, 'Betalingen geregeld. '), 'Je Mollie-account staat in live modus. Het ticketgeld komt op je eigen rekening.');
  if (mode === 'test') return notice('warn', h('strong', null, 'Mollie staat in testmodus. '), 'Bestellingen worden niet echt betaald. Koppel je Live API key om echt te verkopen. ', h('a', { href: '#/settings' }, 'Naar Betalingen'));
  return notice('info', h('strong', null, 'Kies hoe je betaald wilt worden. '), 'Voor betaalde tickets kies je tussen een wekelijkse uitbetaling van ons of je eigen Mollie-account. Gratis tickets kun je nu al aanbieden. ', h('a', { href: '#/settings' }, 'Naar Betalingen'));
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
  const color = /^#[0-9a-f]{6}$/i.test(e.primary || '') ? e.primary : '#1f5f68';
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

    // betalingen: de keuze tussen wekelijkse uitbetaling en een eigen Mollie-account
    const pay = paymentsSection(redraw);
    const fee = euro(S.state.fee_cents);
    const viaUs = S.state.payments.payout_mode === 'platform';
    const line = (...kids) => h('li', null, icon('check', 17), h('span', null, kids));
    const cost = h('section', { class: 'card pad' },
      h('h2', null, `Wat kost ${BRAND}`),
      h('ul', { class: 'plain' },
        line('Geen abonnement en geen opstartkosten.'),
        line(`De koper betaalt per ticket ${fee} servicekosten, bovenop de ticketprijs. Bij een ticket voor meerdere personen geldt dat bedrag per persoon.`),
        viaUs
          ? line(h('strong', null, 'Jij laat ons uitbetalen. '), 'De servicekosten houden we in voordat we je saldo overmaken. Je krijgt er geen aparte factuur voor.')
          : line(h('strong', null, 'Met je eigen Mollie-account '), `komen de servicekosten eerst met de rest op jouw rekening. ${BRAND} stuurt je daar achteraf een factuur voor. Mollie rekent zelf een klein bedrag per betaling.`),
        viaUs
          ? line(h('strong', null, 'Met een eigen Mollie-account '), `zou het ticketgeld rechtstreeks op je Mollie-rekening komen en factureert ${BRAND} de servicekosten achteraf.`)
          : line(h('strong', null, 'Laat je ons uitbetalen, '), 'dan houden we de servicekosten in voordat we je saldo overmaken.'),
        line('Gratis tickets kosten niets, voor jou niet en voor de koper niet.')));

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

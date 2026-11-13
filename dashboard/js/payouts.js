// Betaald worden: de keuze tussen eigen Mollie en wekelijkse uitbetaling (in
// Instellingen), het uitbetalingen-overzicht van de organisator en het scherm
// voor platformbeheer.
import { rpc, fn } from './api.js';
import { h, icon, toast, toastErr, guard, field, setError, badge, notice, empty, spinner, confirmDialog, euro, num, fmtDate, copyText, csvDownload, BRAND } from './ui.js';
import { S, loadState } from './store.js';

// ---------- IBAN ----------
export const ibanClean = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const ibanFormat = (v) => ibanClean(v).replace(/(.{4})(?=.)/g, '$1 ');
// Basiscontrole in de browser: opbouw en controlegetal (mod 97). De server controleert opnieuw.
export function ibanValid(v) {
  const s = ibanClean(v);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const digits = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let m = 0;
  for (const ch of digits) m = (m * 10 + Number(ch)) % 97;
  return m === 1;
}
const dayLong = (ymd) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ''));
  if (!m) return '';
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
};
const dayShort = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }); };
const signed = (cents) => (cents < 0 ? '- ' + euro(-cents) : euro(cents));
// replaceChildren zet null als tekst neer; lege onderdelen slaan we daarom over.
const put = (root, ...kids) => root.replaceChildren(...kids.filter((k) => k != null && k !== false));
const li = (...kids) => h('li', null, icon('check', 17), h('span', null, kids));

// ---------- Instellingen: hoe word je betaald ----------
export function paymentsSection(redraw) {
  const p = S.state.payments || {};
  const viaUs = p.payout_mode === 'platform';
  const working = p.mode === 'live' || p.mode === 'test';
  const reload = async () => { try { await loadState(); } catch { /* bij de volgende keer laden klopt het weer */ } S.ev = null; S.evId = null; };

  const status = p.mode === 'platform' ? badge(`Uitbetaling via ${BRAND}`, 'green')
    : p.mode === 'live' ? badge('Eigen Mollie, live', 'green')
      : p.mode === 'test' ? badge('Eigen Mollie, testmodus', 'amber') : badge('Nog niet geregeld', 'grey');
  const intro = p.mode === 'platform' ? `Kopers betalen aan ${BRAND} en wij maken je saldo elke week naar je over.`
    : p.mode === 'live' ? 'Je eigen Mollie-account is gekoppeld. Kopers betalen met de betaalmethoden die jij in Mollie hebt aangezet.'
      : p.mode === 'test' ? 'Je hebt een Test API key gekoppeld. Je kunt de hele bestelling oefenen, maar er wordt niets echt betaald. Vervang hem door je Live API key als je klaar bent.'
        : 'Kies hoe je betaald wilt worden. Zolang je niets kiest, kun je alleen gratis tickets aanbieden. Je kunt later altijd wisselen.';

  // ----- kaart 1: wekelijkse uitbetaling -----
  const iban = h('input', { type: 'text', class: 'mono', autocomplete: 'off', spellcheck: false, maxlength: '42', placeholder: 'NL00 BANK 0123 4567 89', value: ibanFormat(p.iban || ''),
    oninput: () => { const atEnd = iban.selectionStart === iban.value.length; const v = ibanFormat(iban.value); if (v !== iban.value) { iban.value = v; if (!atEnd) return; iban.setSelectionRange(v.length, v.length); } } });
  const holder = h('input', { type: 'text', autocomplete: 'off', maxlength: '120', value: p.holder || '', placeholder: 'Bijvoorbeeld: Stichting Zomerfeest' });
  const savePayout = h('button', { class: 'btn btn-primary', type: 'submit' }, viaUs ? 'Rekening opslaan' : 'Kies wekelijkse uitbetaling');
  const payoutForm = h('form', { class: 'pay-form', novalidate: true, autocomplete: 'off', hidden: viaUs || (working && !viaUs), onsubmit: async (e) => {
    e.preventDefault();
    const okIban = ibanValid(iban.value), name = holder.value.trim();
    setError(iban, okIban ? '' : 'Dit IBAN klopt niet. Controleer het nummer en typ het opnieuw, bijvoorbeeld NL91 ABNA 0417 1643 00.');
    setError(holder, name.length >= 2 ? '' : 'Vul de naam in waarop de rekening staat.');
    if (!okIban) { iban.focus(); return; }
    if (name.length < 2) { holder.focus(); return; }
    if (!viaUs && working) {
      const yes = await confirmDialog({ title: 'Overstappen naar wekelijkse uitbetaling', confirmLabel: 'Overstappen',
        text: [`Nieuwe bestellingen worden vanaf nu aan ${BRAND} betaald. Wij maken je saldo elke week over naar ${ibanFormat(iban.value)}.`,
          'Je Mollie-account wordt dan niet meer gebruikt voor nieuwe bestellingen. Wat al op je Mollie-rekening staat, blijft daar.'] });
      if (!yes) return;
    }
    const r = await guard(savePayout, async () => { const x = await rpc('entree_payout_save', { mode: 'platform', iban: ibanClean(iban.value), holder: name }); await reload(); return x; });
    if (!r) return;
    toast(viaUs ? 'Rekening opgeslagen.' : `Gekozen: wekelijkse uitbetaling via ${BRAND}.`);
    S.render();
  } },
    field('IBAN', iban, { hint: 'Het rekeningnummer waarop je het ticketgeld wilt ontvangen.' }),
    field('Tenaamstelling', holder, { hint: 'De naam waarop de rekening staat, precies zoals bij je bank.' }),
    h('div', { class: 'form-actions start' }, savePayout));
  const showForm = h('button', { class: 'btn' + (working || viaUs ? '' : ' btn-primary'), type: 'button', hidden: !payoutForm.hidden, onclick: () => { payoutForm.hidden = false; showForm.hidden = true; iban.focus(); } },
    viaUs ? 'Rekening wijzigen' : 'Kies wekelijkse uitbetaling');
  const stop = !viaUs ? null : h('button', { class: 'btn btn-danger-ghost', type: 'button', onclick: async () => {
    const yes = await confirmDialog({ title: `Stoppen met uitbetaling via ${BRAND}`, danger: true, confirmLabel: 'Stoppen',
      text: [p.has_key ? 'Je stapt terug naar je eigen Mollie-account. Nieuwe bestellingen komen dan weer rechtstreeks op je Mollie-rekening.'
        : 'Je hebt geen Mollie-sleutel gekoppeld. Als je nu stopt, gaan alle events met betaalde tickets direct offline tot je een sleutel koppelt of opnieuw voor wekelijkse uitbetaling kiest. Events met alleen gratis tickets blijven werken.',
      `Bestellingen die al via ${BRAND} betaald zijn, betalen we nog gewoon aan je uit.`] });
    if (!yes) return;
    const ok = await guard(stop, async () => { await rpc('entree_payout_save', { mode: 'own' }); await reload(); return true; });
    if (ok) { toast(p.has_key ? 'Je gebruikt weer je eigen Mollie-account.' : `Uitbetaling via ${BRAND} is gestopt.`); S.render(); }
  } }, 'Stoppen met deze uitbetaling');

  const soon = !p.platform_available;
  const platformCard = h('article', { class: 'pay-opt' + (viaUs && !soon ? ' is-active' : '') + (soon ? ' is-soon' : ''), id: 'pay-platform', 'aria-labelledby': 'pay-platform-title' },
    h('div', { class: 'pay-opt-head' }, h('span', { class: 'pay-opt-kicker' }, 'Zonder Mollie-account'),
      soon ? badge('Binnenkort beschikbaar', 'amber') : viaUs ? badge('Actief', 'green') : null),
    h('h3', { id: 'pay-platform-title' }, 'Laat ons uitbetalen'),
    h('ul', { class: 'plain' },
      li(`Je hebt geen Mollie-account nodig. Kopers betalen aan ${BRAND}.`),
      li('Elke week maken we je saldo over. Alles wat vóór maandag 00:00 betaald is, gaat mee in de uitbetaling van die week.'),
      li('De servicekosten zijn er dan al af. Je krijgt er geen factuur voor.')),
    soon
      ? h('div', { class: 'pay-opt-foot' },
        viaUs ? notice('warn', h('strong', null, 'Deze optie staat op dit moment uit. '), 'Betaalde tickets kun je nu niet verkopen. Koppel je eigen Mollie-account, of wacht tot de optie weer beschikbaar is.')
          : h('p', { class: 'muted' }, 'Deze optie komt eraan. Tot die tijd verkoop je betaalde tickets met je eigen Mollie-account.'),
        viaUs ? h('div', { class: 'form-actions' }, stop) : null)
      : h('div', { class: 'pay-opt-foot' },
        viaUs ? h('div', { class: 'pay-now' }, h('span', { class: 'muted' }, 'We betalen uit naar'), h('strong', { class: 'iban' }, ibanFormat(p.iban || '')), h('span', null, p.holder || '')) : null,
        viaUs && p.mode !== 'platform' ? notice('warn', 'Je rekeninggegevens zijn niet compleet. Vul je IBAN en de tenaamstelling in, anders kun je geen betaalde tickets verkopen.') : null,
        payoutForm,
        h('div', { class: 'form-actions' }, showForm, viaUs ? h('a', { class: 'btn', href: '#/uitbetalingen' }, icon('wallet', 16), 'Bekijk je uitbetalingen') : null),
        viaUs ? h('div', { class: 'danger-zone' }, h('p', { class: 'muted' }, 'Liever je eigen Mollie-account gebruiken, of helemaal stoppen.'), stop) : null));
  if (viaUs && p.mode !== 'platform' && !soon) { payoutForm.hidden = false; showForm.hidden = true; }

  // ----- kaart 2: eigen Mollie -----
  const key = h('input', { type: 'password', autocomplete: 'off', spellcheck: false, placeholder: 'live_... of test_...', class: 'mono', name: 'mollie-key' });
  const connect = h('button', { class: 'btn' + (viaUs || p.has_key ? '' : ' btn-primary'), type: 'submit' }, p.has_key ? 'Sleutel vervangen' : 'Koppelen');
  const result = h('div', { id: 'pay-result', 'aria-live': 'polite' });
  const keyForm = h('form', { class: 'pay-form', novalidate: true, autocomplete: 'off', onsubmit: async (e) => {
    e.preventDefault();
    const k = key.value.trim();
    if (!/^(live|test)_[A-Za-z0-9]{20,}$/.test(k)) return setError(key, 'Dit lijkt geen Mollie API-sleutel. Hij begint met live_ of test_ en is minstens 25 tekens lang.');
    setError(key, '');
    if (viaUs) {
      const yes = await confirmDialog({ title: 'Overstappen naar je eigen Mollie-account', confirmLabel: 'Koppelen en overstappen',
        text: ['Als je deze sleutel koppelt, komen nieuwe bestellingen rechtstreeks op je eigen Mollie-rekening. De wekelijkse uitbetaling stopt voor nieuwe bestellingen.',
          `Bestellingen die al via ${BRAND} betaald zijn, betalen we nog gewoon aan je uit.`] });
      if (!yes) return;
    }
    const r = await guard(connect, () => fn('connect', { key: k }));
    key.value = '';
    if (!r) return;
    await reload();
    toast(r.mode === 'test' ? 'Mollie gekoppeld in testmodus.' : 'Mollie gekoppeld. Je kunt betaalde tickets verkopen.');
    S.render();
    const methods = Array.isArray(r.methods) ? r.methods : [];
    const box = document.getElementById('pay-result');
    if (box) box.replaceChildren(methods.length
      ? notice('ok', h('strong', null, r.mode === 'test' ? 'Gekoppeld in testmodus. ' : 'Gekoppeld in live modus. '), 'Gevonden betaalmethoden: ', methods.join(', '), '.')
      : notice('warn', h('strong', null, 'Gekoppeld, maar er staan nog geen betaalmethoden aan. '), 'Zet in je Mollie-dashboard minstens iDEAL aan, anders kunnen kopers niet afrekenen.'));
  } },
    field('Mollie API-sleutel', key, { hint: 'We bewaren de sleutel op de server en tonen hem nooit terug.' }),
    h('div', { class: 'form-actions start' }, connect));
  const backToOwn = !(viaUs && p.has_key) ? null : h('button', { class: 'btn', type: 'button', onclick: async () => {
    const yes = await confirmDialog({ title: 'Terug naar je eigen Mollie-account', confirmLabel: 'Overstappen',
      text: ['Nieuwe bestellingen komen dan weer rechtstreeks op je eigen Mollie-rekening, met de sleutel die je eerder hebt gekoppeld.', `Bestellingen die al via ${BRAND} betaald zijn, betalen we nog gewoon aan je uit.`] });
    if (!yes) return;
    const ok = await guard(backToOwn, async () => { await rpc('entree_payout_save', { mode: 'own' }); await reload(); return true; });
    if (ok) { toast('Je gebruikt weer je eigen Mollie-account.'); S.render(); }
  } }, 'Gebruik deze sleutel weer');
  const disconnect = !p.has_key ? null : h('button', { class: 'btn btn-danger-ghost', type: 'button', onclick: async () => {
    const yes = await confirmDialog({ title: 'Mollie ontkoppelen', danger: true, confirmLabel: 'Ontkoppelen',
      text: viaUs ? ['We verwijderen de bewaarde sleutel. Je verkoop loopt gewoon door via de wekelijkse uitbetaling.']
        : ['Als je ontkoppelt, gaan alle events met betaalde tickets direct offline. Kopers kunnen dan niet meer bestellen tot je opnieuw een sleutel koppelt of voor wekelijkse uitbetaling kiest.', 'Events met alleen gratis tickets blijven gewoon werken.'] });
    if (!yes) return;
    const ok = await guard(disconnect, async () => { await fn('disconnect', {}); await reload(); return true; });
    if (ok) { toast('Mollie is ontkoppeld.'); S.render(); }
  } }, 'Mollie ontkoppelen');
  const keyLabel = p.key_mode === 'test' ? 'Test API key' : 'Live API key';
  const mollieCard = h('article', { class: 'pay-opt' + (!viaUs && working ? ' is-active' : ''), id: 'pay-own', 'aria-labelledby': 'pay-own-title' },
    h('div', { class: 'pay-opt-head' }, h('span', { class: 'pay-opt-kicker' }, 'Met je eigen account'),
      !viaUs && p.mode === 'live' ? badge('Actief', 'green') : !viaUs && p.mode === 'test' ? badge('Actief in testmodus', 'amber') : null),
    h('h3', { id: 'pay-own-title' }, 'Eigen Mollie-account'),
    h('ul', { class: 'plain' },
      li('Het ticketgeld komt rechtstreeks op je eigen Mollie-rekening. Mollie betaalt het uit zoals jij dat daar hebt ingesteld.'),
      li(`De servicekosten komen met de rest bij jou binnen. ${BRAND} stuurt je daar achteraf een factuur voor.`),
      li('Mollie rekent zelf een klein bedrag per betaling.')),
    h('div', { class: 'pay-opt-foot' },
      p.has_key ? h('div', { class: 'pay-now' }, h('span', { class: 'muted' }, viaUs ? 'Bewaarde sleutel, nu niet in gebruik' : 'Gekoppelde sleutel'), h('strong', null, keyLabel)) : null,
      backToOwn ? h('div', { class: 'form-actions' }, backToOwn) : null,
      h('details', null, h('summary', null, 'Zo kom je aan je sleutel'),
        h('ol', { class: 'how' },
          h('li', null, 'Maak gratis een account op ', h('a', { href: 'https://www.mollie.com', target: '_blank', rel: 'noopener' }, 'mollie.com'), '.'),
          h('li', null, 'Rond de verificatie van je bedrijf en je bankrekening af. Mollie vraagt hierom voordat je geld kunt ontvangen.'),
          h('li', null, 'Ga in je Mollie-dashboard naar ', h('strong', null, 'Developers'), ' en dan ', h('strong', null, 'API-keys'), '.'),
          h('li', null, 'Kopieer de ', h('strong', null, 'Live API key'), ' en plak hem hieronder. Met de ', h('strong', null, 'Test API key'), ' kun je eerst oefenen.'))),
      keyForm, result,
      disconnect ? h('div', { class: 'danger-zone' }, h('p', { class: 'muted' }, viaUs ? 'De bewaarde sleutel verwijderen.' : 'Stoppen met online betalen via dit Mollie-account.'), disconnect) : null));

  return h('section', { class: 'card pad', id: 'betalingen' },
    h('div', { class: 'card-head' }, h('h2', null, 'Betalingen'), status),
    h('p', { class: 'muted' }, intro),
    h('div', { class: 'pay-choice' }, platformCard, mollieCard),
    working || p.mode === 'platform' ? null : h('div', { class: 'pay-note' }, notice('info', 'Heb je alleen gratis tickets, dan hoef je hier niets te kiezen.')));
}

// ---------- Uitbetalingen (organisator) ----------
export function viewPayouts() {
  const root = h('div', { class: 'page' }, spinner('Uitbetalingen laden'));
  const p = S.state.payments || {};
  const viaUs = p.payout_mode === 'platform';
  async function load() {
    let d;
    try { d = await rpc('entree_payouts'); } catch (e) {
      if (e.code === 'session') return;
      put(root, h('div', { class: 'card pad center-card' }, h('h2', null, 'Dit laden lukte niet'), h('p', { class: 'muted' }, e.message),
        h('div', { class: 'row center' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { put(root, spinner('Uitbetalingen laden')); load(); } }, 'Opnieuw proberen'))));
      return;
    }
    const balance = Number(d.balance_cents) || 0, next = Number(d.next_cents) || 0, later = balance - next;
    const history = Array.isArray(d.history) ? d.history : [];
    if (history.length && !S.payoutHistory) S.payoutHistory = true;
    const nextDay = dayLong(d.next_date);
    const cut = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d.next_date || ''));
    const cutoffDay = cut ? new Date(Number(cut[1]), Number(cut[2]) - 1, Number(cut[3]) - 7).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }) : 'afgelopen maandag';
    const kpi = (label, value, sub, cls) => h('div', { class: 'kpi' + (cls ? ' ' + cls : '') }, h('p', { class: 'kpi-label' }, label), h('p', { class: 'kpi-value' + (String(value).startsWith('-') ? ' is-neg' : '') }, value), sub ? h('p', { class: 'kpi-sub' }, sub) : null);
    const firstAmount = next > 0 ? next : Math.max(0, balance);
    const firstSub = next > 0 ? `Maken we deze week over. Dit is alles wat vóór ${cutoffDay} 00:00 betaald is.`
      : balance > 0 ? `In de week van ${nextDay}. Het bedrag loopt op met alles wat tot die maandag 00:00 betaald wordt.`
        : nextDay ? `De eerstvolgende uitbetaling is in de week van ${nextDay}, als er dan saldo is.` : 'Zodra er saldo is.';
    const kpis = h('div', { class: 'kpis kpis-3' },
      kpi('Eerstvolgende uitbetaling', euro(firstAmount), firstSub, 'is-key'),
      kpi('Saldo', signed(balance), 'Alles wat nog niet aan je is uitbetaald, zonder servicekosten.'),
      next > 0 ? kpi('Daarna', signed(later), `Betaald na ${cutoffDay} 00:00. Gaat mee in de week van ${nextDay}.`)
        : kpi('Uitbetaald tot nu toe', euro(history.reduce((s, x) => s + (Number(x.amount_cents) || 0), 0)), history.length ? `In ${num(history.length)} ${history.length === 1 ? 'uitbetaling' : 'uitbetalingen'}.` : 'Nog geen uitbetalingen.'));
    const rows = history.map((x) => h('tr', null,
      h('td', { 'data-label': 'Datum' }, dayShort(x.created_at)),
      h('td', { 'data-label': 'Bedrag', class: 'num strong' }, euro(x.amount_cents)),
      h('td', { 'data-label': 'Bestellingen', class: 'num' }, num(x.orders)),
      h('td', { 'data-label': 'Kenmerk' }, h('span', { class: 'mono' }, x.reference || '')),
      h('td', { 'data-label': 'Rekening' }, h('span', { class: 'iban' }, ibanFormat(x.iban || '')))));
    put(root, 
      h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Uitbetalingen'), h('p', { class: 'muted' }, `Wat ${BRAND} aan ${S.state.org.name} overmaakt.`)),
        h('a', { class: 'btn', href: '#/settings' }, icon('settings', 16), 'Rekening en keuze')),
      viaUs ? null : notice('info', h('strong', null, 'Je gebruikt nu je eigen Mollie-account. '), `Hier zie je alleen nog de bestellingen die eerder via ${BRAND} betaald zijn. Die betalen we gewoon aan je uit.`),
      balance < 0 ? notice('warn', h('strong', null, `Je saldo staat op ${signed(balance)}. `), 'Dat komt door een terugbetaling van een bestelling die al aan je was uitbetaald. We verrekenen dit bedrag met je volgende uitbetaling. Je hoeft zelf niets over te maken.') : null,
      kpis,
      h('section', { class: 'card pad' }, h('h2', null, 'Zo werkt de week'),
        h('ul', { class: 'plain' },
          li('De week sluit op maandag om 00:00. Alles wat voor dat moment betaald is, maken we in die week naar je over.'),
          li('Een bestelling van maandagochtend of later gaat mee in de uitbetaling van de week daarna.'),
          li('De servicekosten zijn al van het bedrag af. Betaal je een bestelling terug, dan gaat dat bedrag van je saldo af.'),
          p.iban ? li('We betalen uit naar ', h('span', { class: 'iban' }, ibanFormat(p.iban)), p.holder ? ` op naam van ${p.holder}. ` : '. ', h('a', { href: '#/settings' }, 'Wijzigen')) : null)),
      h('div', { class: 'section-head' }, h('div', null, h('h2', null, 'Eerdere uitbetalingen'), h('p', { class: 'muted' }, 'Met het kenmerk vinden we een uitbetaling snel terug als je er een vraag over hebt.'))),
      history.length
        ? h('div', { class: 'card table-wrap' }, h('table', { class: 'dtable' },
          h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Datum'), h('th', { scope: 'col', class: 'num' }, 'Bedrag'), h('th', { scope: 'col', class: 'num' }, 'Bestellingen'), h('th', { scope: 'col' }, 'Kenmerk'), h('th', { scope: 'col' }, 'Rekening'))),
          h('tbody', null, rows)))
        : h('div', { class: 'card' }, empty('wallet', 'Nog geen uitbetalingen', 'Na je eerste uitbetaling zie je hier de datum, het bedrag en het kenmerk van de overboeking.')));
  }
  load();
  return root;
}

// ---------- Platformbeheer: wat moet er deze week overgemaakt worden ----------
export function viewPlatform() {
  const root = h('div', { class: 'page page-wide' }, spinner('Uitbetalingen laden'));
  const head = (extra) => h('div', { class: 'page-head' }, h('div', null, h('p', { class: 'eyebrow' }, 'Platformbeheer'), h('h1', null, 'Uitbetalingen'), extra || null));
  async function load() {
    let d;
    try { d = await rpc('entree_platform_payouts'); } catch (e) {
      if (e.code === 'session') return;
      put(root, head(), h('div', { class: 'card pad center-card' }, h('h2', null, 'Dit laden lukte niet'), h('p', { class: 'muted' }, e.message),
        h('div', { class: 'row center' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { put(root, spinner('Uitbetalingen laden')); load(); } }, 'Opnieuw proberen'))));
      return;
    }
    const due = Array.isArray(d.due) ? d.due : [], recent = Array.isArray(d.recent) ? d.recent : [];
    // Een negatief bedrag (terugbetaling na een uitbetaling) maak je niet over: dat wordt later verrekend.
    const payable = due.filter((x) => Number(x.amount_cents) > 0);
    const total = payable.reduce((s, x) => s + (Number(x.amount_cents) || 0), 0);
    const upcoming = due.reduce((s, x) => s + (Number(x.upcoming_cents) || 0), 0);
    const cutoff = d.cutoff ? fmtDate(d.cutoff) : 'afgelopen maandag 00:00';

    const pay = async (btn, x) => {
      const hasIban = !!ibanClean(x.iban);
      const yes = await confirmDialog({ title: 'Uitbetaling vastleggen', confirmLabel: 'Het is overgemaakt, vastleggen',
        text: [
          h('ol', { class: 'steps-plain' },
            h('li', null, h('strong', null, `Maak eerst ${euro(x.amount_cents)} over`), ' vanuit de bank naar de rekening hieronder.'),
            h('li', null, h('strong', null, 'Leg het daarna pas hier vast.'), ' Daarmee staan deze bestellingen als uitbetaald en ziet de organisator de uitbetaling in zijn overzicht.')),
          h('div', { class: 'confirm-sum' },
            h('div', { class: 'sum-row' }, h('span', null, 'Organisatie'), h('strong', null, x.name || '')),
            h('div', { class: 'sum-row' }, h('span', null, 'Tenaamstelling'), h('strong', null, x.holder || 'Onbekend')),
            h('div', { class: 'sum-row' }, h('span', null, 'IBAN'), h('strong', { class: 'iban' }, hasIban ? ibanFormat(x.iban) : 'Niet ingevuld')),
            h('div', { class: 'sum-row' }, h('span', null, 'Bedrag'), h('strong', null, euro(x.amount_cents))),
            h('div', { class: 'sum-row' }, h('span', null, 'Bestellingen'), h('strong', null, num(x.orders)))),
          'Vastleggen kun je hier niet terugdraaien. Doe het dus alleen als de overboeking echt is verstuurd.'] });
      if (!yes) return;
      if (btn.disabled) return;
      btn.disabled = true; btn.classList.add('is-busy');
      try {
        const r = await rpc('entree_platform_payout_pay', { organization_id: x.organization_id, amount_cents: x.amount_cents });
        toast(`Vastgelegd: ${euro(r.amount_cents)} aan ${x.name}, kenmerk ${r.reference}.`);
      } catch (e) {
        if (e.code === 'session') return;
        toastErr(e);
      }
      await load();
    };

    const dueRows = due.map((x) => {
      const hasIban = !!ibanClean(x.iban);
      const copy = h('button', { class: 'icon-btn', type: 'button', 'aria-label': `IBAN van ${x.name} kopiëren`, title: 'IBAN kopiëren', onclick: () => copyText(ibanClean(x.iban), 'IBAN gekopieerd') }, icon('copy', 16));
      const owes = !(Number(x.amount_cents) > 0);
      const btn = owes ? h('span', { class: 'muted small' }, 'Wordt verrekend met de volgende uitbetaling')
        : h('button', { class: 'btn btn-sm btn-primary', type: 'button', disabled: !hasIban, onclick: () => pay(btn, x) }, 'Vastleggen als uitbetaald');
      return h('tr', null,
        h('td', { 'data-label': 'Organisatie', class: 'strong' }, x.name || ''),
        h('td', { 'data-label': 'Tenaamstelling' }, x.holder || h('span', { class: 'muted' }, 'Niet ingevuld')),
        h('td', { 'data-label': 'IBAN' }, hasIban ? h('span', { class: 'iban-cell' }, h('span', { class: 'iban' }, ibanFormat(x.iban)), copy) : badge('Geen IBAN', 'amber')),
        h('td', { 'data-label': 'Bestellingen', class: 'num' }, num(x.orders)),
        h('td', { 'data-label': 'Bedrag', class: 'num strong' }, signed(Number(x.amount_cents) || 0)),
        h('td', { 'data-label': 'Komt daarna nog', class: 'num' }, euro(x.upcoming_cents)),
        h('td', { class: 'act' }, btn));
    });
    const csv = h('button', { class: 'btn', type: 'button', disabled: !payable.length, onclick: () => {
      const money = (c) => ((Number(c) || 0) / 100).toFixed(2).replace('.', ',');
      csvDownload(`uitbetalingen-${new Date().toISOString().slice(0, 10)}.csv`, [
        ['Organisatie', 'Tenaamstelling', 'IBAN', 'Bedrag', 'Bestellingen', 'Komt daarna nog'],
        ...payable.map((x) => [x.name, x.holder, ibanClean(x.iban), money(x.amount_cents), x.orders, money(x.upcoming_cents)])]);
    } }, icon('download', 16), 'Download als CSV');
    const kpi = (label, value, sub, cls) => h('div', { class: 'kpi' + (cls ? ' ' + cls : '') }, h('p', { class: 'kpi-label' }, label), h('p', { class: 'kpi-value' }, value), sub ? h('p', { class: 'kpi-sub' }, sub) : null);
    const recentRows = recent.map((x) => h('tr', null,
      h('td', { 'data-label': 'Datum' }, dayShort(x.created_at)),
      h('td', { 'data-label': 'Organisatie', class: 'strong' }, x.name || ''),
      h('td', { 'data-label': 'Bedrag', class: 'num strong' }, euro(x.amount_cents)),
      h('td', { 'data-label': 'Bestellingen', class: 'num' }, num(x.orders)),
      h('td', { 'data-label': 'Kenmerk' }, h('span', { class: 'mono' }, x.reference || '')),
      h('td', { 'data-label': 'Rekening' }, h('span', { class: 'iban' }, ibanFormat(x.iban || '')), x.holder ? h('small', null, x.holder) : null)));

    put(root, 
      head(h('p', { class: 'muted' }, `Wat deze week overgemaakt moet worden: alles wat vóór ${cutoff} betaald is en nog niet is uitbetaald.`)),
      h('div', { class: 'kpis kpis-3' },
        kpi('Deze week over te maken', euro(total), payable.length ? `Aan ${num(payable.length)} ${payable.length === 1 ? 'organisatie' : 'organisaties'}.` : 'Er staat niets open.', 'is-key'),
        kpi('Bestellingen', num(payable.reduce((s, x) => s + (Number(x.orders) || 0), 0)), 'In de openstaande uitbetalingen.'),
        kpi('Komt daarna nog', euro(upcoming), 'Betaald na de weekgrens, voor volgende week.')),
      h('div', { class: 'section-head' }, h('div', null, h('h2', null, 'Deze week overmaken'), h('p', { class: 'muted' }, 'Maak per organisatie eerst het bedrag over. Leg het daarna vast, zodat het uit deze lijst verdwijnt.')), csv),
      due.length
        ? h('div', { class: 'card table-wrap' }, h('table', { class: 'dtable', id: 'platform-due' },
          h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Organisatie'), h('th', { scope: 'col' }, 'Tenaamstelling'), h('th', { scope: 'col' }, 'IBAN'), h('th', { scope: 'col', class: 'num' }, 'Bestellingen'),
            h('th', { scope: 'col', class: 'num' }, 'Bedrag'), h('th', { scope: 'col', class: 'num' }, 'Komt daarna nog'), h('th', { scope: 'col' }, h('span', { class: 'sr' }, 'Actie')))),
          h('tbody', null, dueRows)))
        : h('div', { class: 'card' }, empty('check', 'Niets over te maken', 'Er staat deze week niets open. Nieuwe bedragen verschijnen hier na maandag 00:00.')),
      h('div', { class: 'section-head' }, h('div', null, h('h2', null, 'Recente uitbetalingen'), h('p', { class: 'muted' }, 'Het kenmerk ontstaat bij het vastleggen. De organisator ziet het in zijn overzicht.'))),
      recent.length
        ? h('div', { class: 'card table-wrap' }, h('table', { class: 'dtable', id: 'platform-recent' },
          h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Datum'), h('th', { scope: 'col' }, 'Organisatie'), h('th', { scope: 'col', class: 'num' }, 'Bedrag'), h('th', { scope: 'col', class: 'num' }, 'Bestellingen'), h('th', { scope: 'col' }, 'Kenmerk'), h('th', { scope: 'col' }, 'Rekening'))),
          h('tbody', null, recentRows)))
        : h('div', { class: 'card' }, empty('wallet', 'Nog niets vastgelegd', 'Zodra je een uitbetaling vastlegt, staat hij hier met zijn kenmerk.')));
  }
  load();
  return root;
}

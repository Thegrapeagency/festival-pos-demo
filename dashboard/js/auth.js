// Inloggen, account maken, wachtwoord vergeten en de welkomststap.
import { login, signup, logout, fnPublic, rpc, sessionEmail } from './api.js';
import { h, icon, toast, guard, field, setError, fromLocalInput, BRAND, brandMark, ornament, decoRule } from './ui.js';
import { S, loadState, local } from './store.js';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

function frame(card) {
  const step = (n, title, text) => h('li', null, h('span', { class: 'step-n', 'aria-hidden': 'true' }, n), h('div', null, h('strong', null, title), h('p', null, text)));
  return h('div', { class: 'auth' },
    h('main', { class: 'auth-main' },
      h('a', { class: 'logo', href: '../start/', 'aria-label': `${BRAND}, naar de website` }, brandMark()),
      card),
    h('aside', { class: 'auth-side' }, h('div', { class: 'auth-side-in' },
      ornament('burst'),
      h('h2', null, 'Zelf tickets verkopen, in je eigen huisstijl'),
      decoRule(),
      h('ol', { class: 'steps' },
        step('1', 'Maak je event en je tickets', 'Prijzen, aantallen, kortingscodes en vragen aan de koper stel je zelf in.'),
        step('2', 'Zet je huisstijl erop', 'Upload je logo of stijlgids. Kleuren en lettertypes nemen we voor je over.'),
        step('3', 'Plak de shop op je site', 'Je krijgt een regel code voor je website en een link voor je socials.')),
      h('p', { class: 'auth-foot' }, 'Je kiest zelf hoe je betaald wordt: op je eigen Mollie-rekening of elke week een uitbetaling van ons. Gratis tickets kosten niets.'))));
}

function pwField(label, auto) {
  const input = h('input', { type: 'password', autocomplete: auto, required: true, minlength: '8' });
  const eye = h('button', { class: 'icon-btn pw-eye', type: 'button', 'aria-label': 'Wachtwoord tonen', 'aria-pressed': 'false', onclick: () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    eye.setAttribute('aria-pressed', String(show));
  } }, icon('eye', 17));
  return { input, node: field(label, input, { hint: auto === 'new-password' ? 'Minimaal 8 tekens.' : null, wrap: (c) => h('div', { class: 'pw-wrap' }, c, eye) }) };
}

export function viewAuth(mode) {
  const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const fail = (m) => { err.textContent = m; err.hidden = false; };

  if (mode === 'forgot') {
    const email = h('input', { type: 'email', autocomplete: 'email', required: true });
    const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Stuur me een link');
    const form = h('form', { class: 'auth-card', novalidate: true, onsubmit: async (e) => {
      e.preventDefault(); err.hidden = true;
      const v = email.value.trim();
      if (!EMAIL.test(v)) return setError(email, 'Vul een geldig e-mailadres in.');
      setError(email, '');
      const ok = await guard(btn, async () => { await fnPublic('reset-request', { email: v }); return true; });
      if (ok) form.replaceChildren(h('h1', null, 'Kijk in je inbox'),
        h('p', { class: 'muted' }, 'Als dit adres bij ons bekend is, krijg je binnen een paar minuten een mail met een link om een nieuw wachtwoord te kiezen. De link is een uur geldig.'),
        h('a', { class: 'btn btn-block', href: '#/login' }, 'Terug naar inloggen'));
    } },
      h('h1', null, 'Wachtwoord vergeten'), decoRule('is-short'),
      h('p', { class: 'muted' }, 'Vul je e-mailadres in. Je krijgt een link om een nieuw wachtwoord te kiezen.'),
      field('E-mailadres', email), err, btn,
      h('p', { class: 'auth-alt' }, h('a', { href: '#/login' }, 'Terug naar inloggen')));
    return frame(form);
  }

  if (mode === 'signup') {
    const org = h('input', { type: 'text', autocomplete: 'organization', required: true, maxlength: '80' });
    const email = h('input', { type: 'email', autocomplete: 'email', required: true });
    const pw = pwField('Wachtwoord', 'new-password');
    const hp = h('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off' });
    const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Account maken');
    const form = h('form', { class: 'auth-card', novalidate: true, onsubmit: async (e) => {
      e.preventDefault(); err.hidden = true;
      const o = org.value.trim(), m = email.value.trim().toLowerCase(), p = pw.input.value;
      setError(org, o ? '' : 'Vul de naam van je organisatie in.');
      setError(email, EMAIL.test(m) ? '' : 'Vul een geldig e-mailadres in.');
      setError(pw.input, p.length >= 8 ? '' : 'Kies een wachtwoord van minimaal 8 tekens.');
      if (!o || !EMAIL.test(m) || p.length < 8) return;
      if (btn.disabled) return;
      btn.disabled = true; btn.classList.add('is-busy');
      try {
        await signup(o, m, p, hp.value);
        await login(m, p);
        S.state = null;
        await loadState();
        toast('Je account is gemaakt.');
        location.hash = '#/';
        S.render();
      } catch (ex) { fail(ex.message); }
      finally { btn.disabled = false; btn.classList.remove('is-busy'); }
    } },
      h('h1', null, 'Maak je account'), decoRule('is-short'),
      h('p', { class: 'muted' }, 'Gratis en zonder contract. Je kunt direct je eerste event inrichten.'),
      field('Naam van je organisatie', org, { hint: 'Deze naam zien kopers bij je tickets.' }),
      field('E-mailadres', email),
      pw.node,
      h('div', { class: 'hp', 'aria-hidden': 'true' }, h('label', null, 'Laat dit veld leeg', hp)),
      err, btn,
      h('p', { class: 'auth-alt' }, 'Heb je al een account? ', h('a', { href: '#/login' }, 'Log in')));
    return frame(form);
  }

  const email = h('input', { type: 'email', autocomplete: 'username', required: true });
  const pw = pwField('Wachtwoord', 'current-password');
  const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Inloggen');
  const form = h('form', { class: 'auth-card', novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); err.hidden = true;
    const m = email.value.trim().toLowerCase(), p = pw.input.value;
    setError(email, EMAIL.test(m) ? '' : 'Vul een geldig e-mailadres in.');
    setError(pw.input, p ? '' : 'Vul je wachtwoord in.');
    if (!EMAIL.test(m) || !p) return;
    if (btn.disabled) return;
    btn.disabled = true; btn.classList.add('is-busy');
    try {
      await login(m, p);
      S.state = null;
      if (/^#\/(login|signup|forgot)/.test(location.hash)) location.hash = '#/'; else S.render();
    } catch (ex) { fail(ex.message); }
    finally { btn.disabled = false; btn.classList.remove('is-busy'); }
  } },
    h('h1', null, 'Inloggen'), decoRule('is-short'),
    h('p', { class: 'muted' }, 'Welkom terug. Log in om je events te beheren.'),
    field('E-mailadres', email), pw.node,
    h('p', { class: 'auth-forgot' }, h('a', { href: '#/forgot' }, 'Wachtwoord vergeten')),
    err, btn,
    h('p', { class: 'auth-alt' }, 'Nog geen account? ', h('a', { href: '#/signup' }, 'Maak er gratis een')));
  return frame(form);
}

export function viewReset(token) {
  const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const pw = pwField('Nieuw wachtwoord', 'new-password');
  const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Wachtwoord opslaan');
  const form = h('form', { class: 'auth-card', novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); err.hidden = true;
    const p = pw.input.value;
    if (p.length < 8) return setError(pw.input, 'Kies een wachtwoord van minimaal 8 tekens.');
    setError(pw.input, '');
    if (btn.disabled) return;
    btn.disabled = true; btn.classList.add('is-busy');
    try {
      const r = await fnPublic('reset-confirm', { token, password: p });
      await logout();
      S.state = null; S.ev = null; S.evId = null;
      if (r.email) await login(r.email, p);
      toast('Je wachtwoord is aangepast.');
      location.hash = r.email ? '#/' : '#/login';
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    finally { btn.disabled = false; btn.classList.remove('is-busy'); }
  } },
    h('h1', null, 'Kies een nieuw wachtwoord'), decoRule('is-short'),
    h('p', { class: 'muted' }, 'Daarna ben je direct ingelogd.'),
    pw.node, err, btn,
    h('p', { class: 'auth-alt' }, h('a', { href: '#/login' }, 'Terug naar inloggen')));
  return frame(form);
}

export function viewNoOrg() {
  const btn = h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: () => guard(btn, async () => {
    await logout(); S.state = null; location.hash = '#/signup'; S.render();
  }) }, 'Uitloggen en een account maken');
  return frame(h('div', { class: 'auth-card' },
    h('h1', null, 'Geen organisatie gevonden'), decoRule('is-short'),
    h('p', { class: 'muted' }, `Je bent ingelogd als ${sessionEmail() || 'dit account'}, maar aan dit account hangt geen organisatie. Dat gebeurt als het account is gemaakt voor iets anders dan ticketverkoop.`),
    h('p', { class: 'muted' }, 'Log uit en maak een nieuw account met een ander e-mailadres. Daarna kun je direct je eerste event inrichten.'),
    btn));
}

// De aanmelding maakt één event met de naam van de organisatie. Zolang dat nog
// zo heet en geen datum heeft, vragen we eerst om de echte gegevens.
const doneKey = () => 'entree_welcome_' + S.state.org.id;
export function needsWelcome() {
  const s = S.state;
  if (!s || !s.org || !s.events || s.events.length !== 1) return false;
  const e = s.events[0];
  return e.name === s.org.name && !e.starts_at && !e.shop_live && !e.archived && !local.get(doneKey());
}

export function viewWelcome() {
  const ev = S.state.events[0];
  const name = h('input', { type: 'text', required: true, maxlength: '80', placeholder: 'Bijvoorbeeld: Zomerfeest 2027' });
  const start = h('input', { type: 'datetime-local' });
  const loc = h('input', { type: 'text', maxlength: '160', placeholder: 'Bijvoorbeeld: Griftpark, Utrecht' });
  const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Aan de slag');
  const skip = h('button', { class: 'link-btn', type: 'button', onclick: () => { local.set(doneKey(), '1'); location.hash = '#/'; S.render(); } }, 'Dit vul ik later in');
  const form = h('form', { class: 'auth-card welcome', novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    const n = name.value.trim();
    if (!n) return setError(name, 'Geef je event een naam.');
    setError(name, '');
    const ok = await guard(btn, async () => {
      await rpc('entree_event_save', { id: ev.id, name: n, starts_at: fromLocalInput(start.value), location: loc.value.trim() });
      local.set(doneKey(), '1');
      await loadState();
      return true;
    });
    if (ok) { toast('Je event staat klaar. Voeg nu je tickets toe.'); location.hash = `#/event/${ev.id}/overzicht`; S.render(); }
  } },
    ornament('burst'),
    h('p', { class: 'eyebrow' }, `Welkom bij ${BRAND}`),
    h('h1', null, 'Vertel iets over je eerste event'),
    decoRule('is-short is-center'),
    h('p', { class: 'muted' }, `Je account voor ${S.state.org.name} is klaar. Met deze drie gegevens maken we je event aan. Alles kun je later nog aanpassen.`),
    field('Naam van je event', name),
    field('Wanneer begint het', start, { optional: true }),
    field('Waar is het', loc, { optional: true }),
    btn, h('p', { class: 'auth-alt' }, skip));
  return h('div', { class: 'auth auth-solo' }, h('main', { class: 'auth-main' }, h('span', { class: 'logo' }, brandMark()), form));
}

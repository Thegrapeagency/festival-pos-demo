// Ingang van het dashboard: routering en het vaste kader.
import { hasSession, onSessionLost, logout, sessionEmail } from './api.js';
import { h, icon, toast, spinner, guard, brandMark, BRAND, setTitle } from './ui.js';
import { S, loadState, loadEvent, showPayouts, isPlatformAdmin } from './store.js';
import { viewAuth, viewReset, viewWelcome, viewNoOrg, needsWelcome } from './auth.js';
import { viewHome, viewSettings } from './home.js';
import { viewEvent } from './event.js';
import { viewPayouts, viewPlatform } from './payouts.js';

const app = document.getElementById('app');
const mount = (node) => { app.replaceChildren(node); };
let seq = 0;

function shell(content, active) {
  const org = S.state && S.state.org ? S.state.org.name : '';
  const link = (hash, label, ic, key) => h('a', { href: hash, class: 'nav-link' + (active === key ? ' is-on' : ''), 'aria-current': active === key ? 'page' : null }, icon(ic, 17), h('span', null, label));
  const out = h('button', { class: 'nav-link nav-out', type: 'button', title: 'Uitloggen', onclick: () => guard(out, doLogout) }, icon('logout', 17), h('span', null, 'Uitloggen'));
  return h('div', { class: 'shell' },
    h('a', { class: 'skip', href: '#main' }, 'Naar de inhoud'),
    h('header', { class: 'top' }, h('div', { class: 'top-in' },
      h('a', { class: 'logo', href: '#/', 'aria-label': `${BRAND}, naar je events` }, brandMark()),
      h('nav', { class: 'top-nav', 'aria-label': 'Hoofdmenu' }, link('#/', 'Events', 'grid', 'home'),
        showPayouts() ? link('#/uitbetalingen', 'Uitbetalingen', 'wallet', 'payouts') : null,
        link('#/settings', 'Instellingen', 'settings', 'settings'),
        isPlatformAdmin() ? link('#/platform', 'Platformbeheer', 'shield', 'platform') : null),
      h('div', { class: 'top-right' }, org ? h('span', { class: 'org-name', title: sessionEmail() }, org) : null, out))),
    h('main', { id: 'main', class: 'main', tabindex: '-1' }, content));
}

export async function doLogout() {
  await logout();
  S.state = null; S.ev = null; S.evId = null; S.payoutHistory = false; S.brandDrafts.clear(); S.fieldDrafts.clear();
  location.hash = '#/login';
  render();
  toast('Je bent uitgelogd.');
}

function errorView(e, retry) {
  return h('div', { class: 'card pad center-card' }, h('h2', null, 'Dit laden lukte niet'), h('p', { class: 'muted' }, (e && e.message) || 'Er ging iets mis.'),
    h('div', { class: 'row center' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: retry }, 'Opnieuw proberen'), h('a', { class: 'btn', href: '#/' }, 'Naar je events')));
}

let navigated = true;
async function render() {
  const my = ++seq;
  const fromNav = navigated; navigated = false;
  const hash = location.hash || '#/';
  if (hash.startsWith('#reset=')) { setTitle('Nieuw wachtwoord'); return mount(viewReset(hash.slice(7))); }
  const parts = hash.replace(/^#\/?/, '').split('/');
  const page = parts[0] || 'home';

  if (['login', 'signup', 'forgot'].includes(page)) {
    if (hasSession()) { location.hash = '#/'; return; }
    setTitle({ login: 'Inloggen', signup: 'Account maken', forgot: 'Wachtwoord vergeten' }[page]);
    return mount(viewAuth(page));
  }
  if (!hasSession()) { setTitle('Inloggen'); return mount(viewAuth('login')); }

  if (!S.state) {
    mount(shell(spinner('Je gegevens laden')));
    try { await loadState(); } catch (e) {
      if (my !== seq || e.code === 'session') return;
      return mount(shell(errorView(e, render)));
    }
    if (my !== seq) return;
  }
  if (S.state.role !== 'admin') return mount(viewNoOrg());
  if (needsWelcome()) { setTitle('Welkom'); return mount(viewWelcome()); }

  if (page === 'settings') {
    setTitle('Instellingen');
    mount(shell(viewSettings(), 'settings'));
    return;
  }
  if (page === 'uitbetalingen') {
    setTitle('Uitbetalingen');
    mount(shell(viewPayouts(), 'payouts'));
    return;
  }
  // Platformbeheer bestaat alleen voor platformbeheerders; voor ieder ander is deze route er niet.
  if (page === 'platform' && isPlatformAdmin()) {
    setTitle('Platformbeheer');
    mount(shell(viewPlatform(), 'platform'));
    return;
  }
  if (page === 'event' && parts[1]) {
    const id = parts[1], tab = parts[2] || 'overzicht';
    let loadedNow = null;
    if (S.evId !== id) {
      loadedNow = id;
      mount(shell(spinner('Event laden'), 'home'));
      try { await loadEvent(id); } catch (e) {
        if (my !== seq || e.code === 'session') return;
        return mount(shell(errorView(e.code && String(e.code).includes('forbidden') ? { message: 'Dit event bestaat niet (meer) of hoort niet bij jouw organisatie.' } : e, render), 'home'));
      }
      if (my !== seq) return;
    }
    setTitle(S.ev && S.ev.event ? S.ev.event.name : 'Event');
    mount(shell(viewEvent(tab), 'home'));
    // Bij het openen van een tab met cijfers halen we op de achtergrond verse gegevens op.
    if (fromNav && loadedNow !== id && !['huisstijl', 'vragen'].includes(tab)) {
      const before = JSON.stringify(S.ev);
      try { await loadEvent(id); } catch { return; }
      const typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (my === seq && JSON.stringify(S.ev) !== before && !document.querySelector('.modal-back') && !typing) mount(shell(viewEvent(tab), 'home'));
    }
    return;
  }
  // home: toon wat we hebben en ververs op de achtergrond
  if (page !== 'home') { location.replace('#/'); return; }
  setTitle('Events');
  mount(shell(viewHome(), 'home'));
  try {
    await loadState();
    if (my === seq) mount(shell(viewHome(), 'home'));
  } catch { /* de oude gegevens blijven staan */ }
}

S.render = render;
onSessionLost(() => {
  S.state = null; S.ev = null; S.evId = null; S.payoutHistory = false;
  document.querySelectorAll('.modal-back').forEach((m) => m.remove());
  document.body.classList.remove('has-modal');
  render();
  toast('Je sessie is verlopen. Log opnieuw in.', 'err');
});
window.addEventListener('hashchange', () => { window.scrollTo(0, 0); navigated = true; render(); });
window.addEventListener('beforeunload', (e) => {
  const dirty = [...S.brandDrafts.values(), ...S.fieldDrafts.values()].some((d) => d && d.dirty);
  if (dirty) { e.preventDefault(); e.returnValue = ''; }
});
render();

// Licht of donker. Zonder eigen keuze volgt de pagina de instelling van het apparaat.
// Dit script staat in de <head>, zodat de pagina meteen in de goede kleuren opent.
(function () {
  var KEY = 'actigate-theme';
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var buttons = [];

  function stored() {
    try { var v = localStorage.getItem(KEY); return v === 'dark' || v === 'light' ? v : null; } catch (e) { return null; }
  }
  function current() { return stored() || (media && media.matches ? 'dark' : 'light'); }

  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';

  function paint(b) {
    var dark = current() === 'dark';
    var label = dark ? 'Lichte weergave' : 'Donkere weergave';
    b.innerHTML = dark ? SUN : MOON;
    b.title = label;
    b.setAttribute('aria-label', label);
  }
  function apply() {
    root.setAttribute('data-theme', current());
    buttons.forEach(paint);
  }
  function set(theme) {
    try {
      // Kies je wat het apparaat al doet, dan blijft de pagina het apparaat volgen.
      if (theme === (media && media.matches ? 'dark' : 'light')) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, theme);
    } catch (e) { root.setAttribute('data-theme', theme); buttons.forEach(paint); return; }
    apply();
  }
  function button() {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'theme-btn';
    b.addEventListener('click', function () { set(current() === 'dark' ? 'light' : 'dark'); });
    buttons = buttons.filter(function (x) { return x.isConnected; });
    buttons.push(b);
    paint(b);
    return b;
  }

  apply();
  if (media) {
    if (media.addEventListener) media.addEventListener('change', apply); else if (media.addListener) media.addListener(apply);
  }
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(); });
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-theme-toggle]').forEach(function (slot) { slot.appendChild(button()); });
  });
  window.EntreeTheme = { current: current, set: set, button: button };
})();

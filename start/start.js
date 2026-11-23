// Landingspagina: naam en woordmerk invullen (uit /entree-config.js) en de embed-code tonen met het echte adres.
(function () {
  'use strict';
  var P = window.EntreePlatform;
  if (P) {
    P.fill(document);
    P.title('· bouw je ticketshop door te chatten');
    var logo = document.querySelector('.top-logo');
    if (logo) logo.setAttribute('aria-label', P.name + ', naar het begin van de pagina');
  }
  var C = window.ENTREE || {};
  var base = String(C.BASE_URL || (location.origin + location.pathname.replace(/\/start(\/.*)?$/, ''))).replace(/\/+$/, '');
  var code = document.getElementById('embed-code');
  if (code) code.textContent = '<div data-entree-shop="jouw-event"></div>\n<script async src="' + base + '/embed.js"></' + 'script>';

  // Wat de bezoeker hier typt, gaat mee naar het dashboard: na het aanmelden staat het klaar voor de assistent.
  var form = document.getElementById('start-form'), input = document.getElementById('start-input');
  if (form && input) {
    var go = function () {
      var v = input.value.trim().slice(0, 800);
      try { if (v) localStorage.setItem('actigate_start_prompt', v); else localStorage.removeItem('actigate_start_prompt'); } catch (e) { /* geen opslag */ }
      location.href = '../dashboard/#/signup';
    };
    form.addEventListener('submit', function (e) { e.preventDefault(); go(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); go(); } });
  }
})();

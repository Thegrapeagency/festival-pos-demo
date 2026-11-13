// Landingspagina: naam en woordmerk invullen (uit /entree-config.js) en de embed-code tonen met het echte adres.
(function () {
  'use strict';
  var P = window.EntreePlatform;
  if (P) {
    P.fill(document);
    P.title('· tickets verkopen in je eigen huisstijl');
    var logo = document.querySelector('.top-logo');
    if (logo) logo.setAttribute('aria-label', P.name + ', naar het begin van de pagina');
  }
  var C = window.ENTREE || {};
  var base = String(C.BASE_URL || (location.origin + location.pathname.replace(/\/start(\/.*)?$/, ''))).replace(/\/+$/, '');
  var code = document.getElementById('embed-code');
  if (code) code.textContent = '<div data-entree-shop="jouw-event"></div>\n<script async src="' + base + '/embed.js"></' + 'script>';
})();

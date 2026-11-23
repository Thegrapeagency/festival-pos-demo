// De naam en het woordmerk van het platform, gedeeld door het dashboard, de
// landingspagina en de publieke pagina's.
//
// De naam staat op één plek: window.ENTREE.BRAND_NAME in /entree-config.js.
// Het woordmerk is tekst plus een beeldmerk (ticket met tekstballon) en werkt dus met elke naam.
//
//   EntreePlatform.name                 de naam
//   EntreePlatform.wordmark()           <span class="wm"> met ornament en naam
//   EntreePlatform.ornament('burst')    los ornament als SVG-element
//   EntreePlatform.title('dashboard')   zet document.title op "<naam> dashboard"
//   EntreePlatform.fill(root)           vult [data-brand-name], [data-wordmark] en [data-ornament]
(function () {
  'use strict';
  var C = window.ENTREE || {};
  var NAME = typeof C.BRAND_NAME === 'string' && C.BRAND_NAME.trim() ? C.BRAND_NAME.trim().slice(0, 40) : 'Tickets';

  // Vaste tekeningen uit dit bestand (geen serverdata), dus veilig als innerHTML.
  var ORNAMENTS = {
    // beeldmerk: een ticket (twee inkepingen) met een tekstballon erin
    mark: '<svg class="orn orn-mark" viewBox="0 0 32 32" width="32" height="32" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7 4H25a3 3 0 0 1 3 3V12.5a3.5 3.5 0 0 0 0 7V25a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V19.5a3.5 3.5 0 0 0 0-7V7a3 3 0 0 1 3-3ZM11 10h10a1.500 1.500 0 0 1 1.500 1.500v6a1.500 1.500 0 0 1-1.500 1.500h-4.500l-3.500 3v-3H11a1.500 1.500 0 0 1-1.500-1.500v-6A1.500 1.500 0 0 1 11 10Z"/></svg>',
    // groot ornament: een chatvenster uit kaderlijnen, met drie berichten en een invoerregel
    burst: '<svg class="orn orn-burst" viewBox="0 0 240 132" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M20 6h200v120H20zM20 28h200M20 102h200"/><path d="M32 17h28" stroke-width="3"/><path d="M36 42h92v18H36zM112 68h92v18h-92z"/><path d="M48 51h56M124 77h44" stroke-width="2"/><path d="M36 114h120" stroke-width="2" opacity=".5"/><path d="M186 108h18v12h-18z" fill="currentColor" stroke="none"/></svg>',
    // kort oranje merkteken voor onder een kop
    diamond: '<svg class="orn orn-diamond" viewBox="0 0 44 12" width="44" height="12" fill="currentColor" aria-hidden="true"><path d="M0 4h44v4H0z"/></svg>'
  };

  function ornament(kind, cls) {
    var t = document.createElement('template');
    t.innerHTML = ORNAMENTS[kind] || ORNAMENTS.mark;
    var n = t.content.firstChild;
    if (cls) n.setAttribute('class', n.getAttribute('class') + ' ' + cls);
    return n;
  }
  // Scheidingslijn: dubbele lijn, ruit in het midden.
  function rule(cls) {
    var d = document.createElement('div');
    d.className = 'deco-rule' + (cls ? ' ' + cls : '');
    d.setAttribute('aria-hidden', 'true');
    d.appendChild(ornament('diamond'));
    return d;
  }
  function wordmark(cls) {
    var s = document.createElement('span');
    s.className = 'wm' + (cls ? ' ' + cls : '');
    s.appendChild(ornament('mark', 'wm-orn'));
    var n = document.createElement('span');
    n.className = 'wm-name';
    n.textContent = NAME;
    s.appendChild(n);
    return s;
  }
  function title(rest) { document.title = rest ? NAME + ' ' + rest : NAME; }
  function fill(root) {
    root = root || document;
    Array.prototype.forEach.call(root.querySelectorAll('[data-brand-name]'), function (n) { n.textContent = NAME; });
    Array.prototype.forEach.call(root.querySelectorAll('[data-wordmark]'), function (n) {
      if (!n.querySelector('.wm')) n.appendChild(wordmark(n.getAttribute('data-wordmark') || ''));
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-ornament]'), function (n) {
      if (n.firstChild) return;
      var kind = n.getAttribute('data-ornament');
      n.appendChild(kind === 'rule' ? rule() : ornament(kind));
    });
  }

  window.EntreePlatform = { name: NAME, wordmark: wordmark, ornament: ornament, rule: rule, title: title, fill: fill };
})();

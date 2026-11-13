// De naam en het woordmerk van het platform, gedeeld door het dashboard, de
// landingspagina en de publieke pagina's.
//
// De naam staat op één plek: window.ENTREE.BRAND_NAME in /entree-config.js.
// Het woordmerk is tekst plus een waaier-ornament en werkt dus met elke naam.
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
    // waaier voor het woordmerk
    mark: '<svg class="orn orn-mark" viewBox="0 0 40 22" width="40" height="22" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' +
      '<path d="M13.1 17.1L6.6 14.5M14.7 14.7L6.9 6.9M17.1 13.1L14.5 6.6M20 12.500L20 1.500M22.9 13.1L25.5 6.6M25.3 14.7L33.1 6.9M26.9 17.1L33.4 14.5"/>' +
      '<path d="M15.5 20a4.500 4.500 0 0 1 9 0z" fill="currentColor" stroke="none"/><path d="M1 20.700h38"/></svg>',
    // grote zonnestraal met bogen en een getrapte voet
    burst: '<svg class="orn orn-burst" viewBox="0 0 240 132" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
      '<path d="M80.8 112.2L29.8 102.1M83 104.7L16.5 77.1M86.7 97.8L43.5 68.9M91.7 91.7L40.8 40.8M97.8 86.7L68.9 43.5M104.7 83L77.1 16.5M112.2 80.8L102.1 29.8M120 80L120 8M127.8 80.8L137.9 29.8M135.3 83L162.9 16.5M142.2 86.7L171.1 43.5M148.3 91.7L199.2 40.8M153.3 97.8L196.5 68.9M157 104.7L223.5 77.1M159.2 112.2L210.2 102.1"/>' +
      '<path d="M88 120a32 32 0 0 1 64 0M94 120a26 26 0 0 1 52 0"/><path d="M104 120a16 16 0 0 1 32 0z" fill="currentColor" stroke="none"/>' +
      '<path d="M6 120.800h228M26 125.800h188M52 130.800h136"/></svg>',
    // ruit met twee kleine ruiten, voor scheidingslijnen
    diamond: '<svg class="orn orn-diamond" viewBox="0 0 44 12" width="44" height="12" fill="currentColor" aria-hidden="true">' +
      '<path d="M22 0l6 6-6 6-6-6zM6 3l3 3-3 3-3-3zM38 3l3 3-3 3-3-3z"/></svg>'
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

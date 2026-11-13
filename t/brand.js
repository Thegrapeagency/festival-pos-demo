// Huisstijl van de organisator toepassen op een pagina van het platform (shop,
// ticketpagina, scanner, voorbeeld in het dashboard).
//
//   EntreeBrand.apply(shop.brand)            zet CSS-variabelen op <html> en laadt de lettertypes
//   EntreeBrand.FONTS                        lettertypes waaruit de organisator kan kiezen
//   EntreeBrand.contrast('#rrggbb')          zwart of wit, wat het best leest
//
// CSS-variabelen: --e-primary, --e-on-primary, --e-bg, --e-surface, --e-text,
// --e-muted, --e-border, --e-radius, --e-radius-sm, --e-font-heading, --e-font-body.
//
// Heeft de organisator nog geen eigen kleuren of lettertypes gekozen, dan krijgt de
// pagina de standaardstijl van het platform (DEFAULTS) en de klasse e-platform op
// <html>; entree.css voegt daar de art-deco-details aan toe. Zodra er een eigen kleur
// of lettertype is ingesteld, valt die klasse weg en vullen we wat ontbreekt neutraal
// aan (NEUTRAL): het platform drukt dan geen eigen stijl op de shop.
(function () {
  // Standaardstijl van het platform. Zelfde kleuren als in platform.css.
  var DEFAULTS = {
    primary: '#efa36f', on_primary: '#07242a', bg: '#faf5ec', surface: '#fffdf8', text: '#14323a', radius: 6,
    font_heading: '"Marcellus", "Optima", "Candara", "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif',
    font_body: '"Jost", "Century Gothic", "Avenir Next", "Avenir", "Futura", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif',
    fonts_href: 'https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700&family=Marcellus&display=swap'
  };
  var NEUTRAL = { bg: '#f7f7f5', surface: '#ffffff', text: '#1f1f1f', radius: 14 };
  var OWN = ['primary', 'bg', 'surface', 'text', 'font_heading', 'font_body'];
  function isCustom(brand) { return OWN.some(function (k) { return !!brand[k]; }); }

  // Google Fonts die we aanbieden. Elk met de gewichten die we nodig hebben.
  var FONTS = [
    'Inter', 'DM Sans', 'Manrope', 'Poppins', 'Montserrat', 'Work Sans', 'Outfit', 'Plus Jakarta Sans',
    'Space Grotesk', 'Sora', 'Lexend', 'Nunito', 'Rubik', 'Raleway', 'Lato', 'Open Sans', 'Roboto',
    'Source Sans 3', 'IBM Plex Sans', 'Figtree', 'Hanken Grotesk', 'Barlow', 'Oswald', 'Bebas Neue',
    'Anton', 'Archivo', 'Archivo Black', 'Syne', 'Unbounded', 'Fraunces', 'Playfair Display',
    'DM Serif Display', 'Bodoni Moda', 'Cormorant Garamond', 'Libre Baskerville', 'Lora', 'Merriweather',
    'EB Garamond', 'Crete Round', 'Abril Fatface', 'Caveat', 'Pacifico', 'Space Mono', 'JetBrains Mono'
  ];
  var SERIF = /Fraunces|Playfair|Serif|Bodoni|Cormorant|Baskerville|Lora|Merriweather|Garamond|Crete|Abril/;

  function hex(v, fallback) { return /^#[0-9a-f]{6}$/i.test(v || '') ? v.toLowerCase() : fallback; }
  function rgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function luminance(h) {
    var c = rgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(h) { return luminance(h) > 0.4 ? '#111111' : '#ffffff'; }
  // Kleur a over b mengen (t = aandeel van a).
  function mix(a, b, t) {
    var x = rgb(a), y = rgb(b);
    return '#' + x.map(function (v, i) { return Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, '0'); }).join('');
  }
  function fontOk(name) { return typeof name === 'string' && /^[A-Za-z0-9 ]{1,40}$/.test(name); }
  function stack(name) {
    if (!fontOk(name)) return 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    return '"' + name + '", ' + (SERIF.test(name) ? 'Georgia, serif' : 'system-ui, -apple-system, "Segoe UI", sans-serif');
  }
  function loadFonts(names, fixedHref) {
    var wanted = names.filter(fontOk).filter(function (n, i, a) { return a.indexOf(n) === i; });
    var id = 'entree-fonts';
    var old = document.getElementById(id);
    if (!wanted.length && !fixedHref) { if (old) old.remove(); return; }
    var href = fixedHref || 'https://fonts.googleapis.com/css2?' + wanted.map(function (n) {
      return 'family=' + encodeURIComponent(n).replace(/%20/g, '+') + ':wght@400;600;700';
    }).join('&') + '&display=swap';
    if (old && old.getAttribute('href') === href) return;
    var link = document.createElement('link');
    link.id = id; link.rel = 'stylesheet'; link.href = href;
    // Lettertypes zonder die gewichten geven een fout; dan proberen we het zonder gewichten.
    link.onerror = function () {
      link.onerror = null;
      if (fixedHref) return;
      link.href = 'https://fonts.googleapis.com/css2?' + wanted.map(function (n) {
        return 'family=' + encodeURIComponent(n).replace(/%20/g, '+');
      }).join('&') + '&display=swap';
    };
    if (old) old.remove();
    document.head.appendChild(link);
  }

  function apply(brand, root) {
    brand = brand || {};
    root = root || document.documentElement;
    var custom = isCustom(brand);
    var base = custom ? NEUTRAL : DEFAULTS;
    var bg = hex(brand.bg, base.bg);
    var surface = hex(brand.surface, luminance(bg) > 0.4 ? base.surface : mix('#ffffff', bg, 0.08));
    var text = hex(brand.text, contrast(bg) === '#ffffff' ? '#f5f5f5' : base.text);
    // Eigen huisstijl zonder primaire kleur: knoppen in de tekstkleur, dat is altijd zichtbaar en neutraal.
    var primary = hex(brand.primary, custom ? text : DEFAULTS.primary);
    var radius = Math.max(0, Math.min(28, parseInt(brand.radius == null ? base.radius : brand.radius, 10) || 0));
    var set = function (k, v) { root.style.setProperty(k, v); };
    if (root.classList) root.classList.toggle('e-platform', !custom);
    set('--e-primary', primary);
    set('--e-on-primary', custom ? contrast(primary) : DEFAULTS.on_primary);
    set('--e-bg', bg);
    set('--e-surface', surface);
    set('--e-text', text);
    set('--e-muted', mix(text, surface, 0.62));
    set('--e-border', mix(text, surface, 0.16));
    set('--e-radius', radius + 'px');
    set('--e-radius-sm', Math.round(radius * 0.6) + 'px');
    set('--e-font-heading', custom ? stack(brand.font_heading || brand.font_body) : DEFAULTS.font_heading);
    set('--e-font-body', custom ? stack(brand.font_body) : DEFAULTS.font_body);
    // Lettertypes alleen laden voor de pagina zelf, niet voor een los element (zoals de contrastcontrole in het dashboard).
    if (root === document.documentElement) { if (custom) loadFonts([brand.font_heading, brand.font_body]); else loadFonts([], DEFAULTS.fonts_href); }
    return { primary: primary, bg: bg, surface: surface, text: text, radius: radius, custom: custom };
  }

  window.EntreeBrand = { apply: apply, contrast: contrast, mix: mix, luminance: luminance, isCustom: isCustom, FONTS: FONTS, DEFAULTS: DEFAULTS, NEUTRAL: NEUTRAL };
})();

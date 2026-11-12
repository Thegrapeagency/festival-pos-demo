// Huisstijl van de organisator toepassen op een Entree-pagina (shop,
// ticketpagina, scanner, voorbeeld in het dashboard).
//
//   EntreeBrand.apply(shop.brand)            zet CSS-variabelen op <html> en laadt de lettertypes
//   EntreeBrand.FONTS                        lettertypes waaruit de organisator kan kiezen
//   EntreeBrand.contrast('#rrggbb')          zwart of wit, wat het best leest
//
// CSS-variabelen: --e-primary, --e-on-primary, --e-bg, --e-surface, --e-text,
// --e-muted, --e-border, --e-radius, --e-radius-sm, --e-font-heading, --e-font-body.
(function () {
  var DEFAULTS = { primary: '#0e9f6e', bg: '#f7f7f5', surface: '#ffffff', text: '#1f1f1f', radius: 14 };

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
  function loadFonts(names) {
    var wanted = names.filter(fontOk).filter(function (n, i, a) { return a.indexOf(n) === i; });
    var id = 'entree-fonts';
    var old = document.getElementById(id);
    if (!wanted.length) { if (old) old.remove(); return; }
    var href = 'https://fonts.googleapis.com/css2?' + wanted.map(function (n) {
      return 'family=' + encodeURIComponent(n).replace(/%20/g, '+') + ':wght@400;600;700';
    }).join('&') + '&display=swap';
    if (old && old.getAttribute('href') === href) return;
    var link = document.createElement('link');
    link.id = id; link.rel = 'stylesheet'; link.href = href;
    // Lettertypes zonder die gewichten geven een fout; dan proberen we het zonder gewichten.
    link.onerror = function () {
      link.onerror = null;
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
    var primary = hex(brand.primary, DEFAULTS.primary);
    var bg = hex(brand.bg, DEFAULTS.bg);
    var surface = hex(brand.surface, luminance(bg) > 0.4 ? '#ffffff' : mix('#ffffff', bg, 0.08));
    var text = hex(brand.text, contrast(bg) === '#ffffff' ? '#f5f5f5' : DEFAULTS.text);
    var radius = Math.max(0, Math.min(28, parseInt(brand.radius == null ? DEFAULTS.radius : brand.radius, 10) || 0));
    var set = function (k, v) { root.style.setProperty(k, v); };
    set('--e-primary', primary);
    set('--e-on-primary', contrast(primary));
    set('--e-bg', bg);
    set('--e-surface', surface);
    set('--e-text', text);
    set('--e-muted', mix(text, surface, 0.62));
    set('--e-border', mix(text, surface, 0.16));
    set('--e-radius', radius + 'px');
    set('--e-radius-sm', Math.round(radius * 0.6) + 'px');
    set('--e-font-heading', stack(brand.font_heading || brand.font_body));
    set('--e-font-body', stack(brand.font_body));
    loadFonts([brand.font_heading, brand.font_body]);
    return { primary: primary, bg: bg, surface: surface, text: text, radius: radius };
  }

  window.EntreeBrand = { apply: apply, contrast: contrast, mix: mix, luminance: luminance, FONTS: FONTS, DEFAULTS: DEFAULTS };
})();

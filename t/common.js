// Gedeelde hulpjes voor de publieke Entree-pagina's (shop, ticketpagina, scanner).
// Verwacht window.ENTREE uit ../entree-config.js.
(function () {
  'use strict';
  var C = window.ENTREE || {};
  var FN = String(C.SUPABASE_URL || '').replace(/\/$/, '') + '/functions/v1/entree';
  var TZ = 'Europe/Amsterdam';

  function headers(json) {
    var h = {};
    if (C.ANON_KEY) { h.apikey = C.ANON_KEY; h.Authorization = 'Bearer ' + C.ANON_KEY; }
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  // Geeft altijd { ok, status, data }. Gooit alleen bij een netwerkfout.
  function api(action, query, body) {
    var qs = 'a=' + encodeURIComponent(action);
    Object.keys(query || {}).forEach(function (k) {
      if (query[k] !== '' && query[k] != null) qs += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(query[k]);
    });
    var opts = body === undefined
      ? { method: 'GET', headers: headers(false), cache: 'no-store' }
      : { method: 'POST', headers: headers(true), body: JSON.stringify(body) };
    return fetch(FN + '?' + qs, opts).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        return { ok: res.ok, status: res.status, data: data || {} };
      });
    });
  }

  var nf = null;
  function amount(cents) {
    try {
      nf = nf || new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return nf.format(Math.abs(cents) / 100);
    } catch (e) {
      return (Math.abs(cents) / 100).toFixed(2).replace('.', ',');
    }
  }
  function euro(cents) { return '€ ' + amount(cents || 0); }

  // Afbeeldingen alleen van https (of localhost bij lokaal testen).
  function imageUrl(u) {
    return typeof u === 'string' && (/^https:\/\/[^\s"'<>]+$/.test(u) || /^http:\/\/localhost(:\d+)?\/[^\s"'<>]*$/.test(u)) ? u : '';
  }
  function linkUrl(u) {
    return typeof u === 'string' && /^https?:\/\/[^\s"'<>]+$/.test(u) ? u : '';
  }
  function host(u) {
    try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  function locale(lang) { return lang === 'en' ? 'en-GB' : 'nl-NL'; }
  function fmt(iso, lang, opts) {
    var d = new Date(iso);
    if (!iso || isNaN(d)) return '';
    opts.timeZone = TZ;
    try { return new Intl.DateTimeFormat(locale(lang), opts).format(d); } catch (e) { return d.toLocaleString(); }
  }
  function day(iso, lang) { return fmt(iso, lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  function time(iso, lang) { return fmt(iso, lang, { hour: '2-digit', minute: '2-digit' }); }
  function shortMoment(iso, lang) {
    var d = fmt(iso, lang, { day: 'numeric', month: 'short' });
    return d ? d + (lang === 'en' ? ' at ' : ' om ') + time(iso, lang) : '';
  }
  // "zaterdag 12 juni 2027, 14:00 tot 23:00"
  function when(starts, ends, lang) {
    if (!starts) return '';
    var to = lang === 'en' ? ' to ' : ' tot ';
    var s = day(starts, lang) + ', ' + time(starts, lang);
    if (!ends || isNaN(new Date(ends))) return s;
    if (day(starts, lang) === day(ends, lang)) return s + to + time(ends, lang);
    return s + to + day(ends, lang) + ', ' + time(ends, lang);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // Vaste pictogrammen (geen serverdata), dus veilig als innerHTML.
  var ICONS = {
    calendar: '<path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
    pin: '<path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.500C5 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.300 2.700-5.500 6-5.500s6 2.200 6 5.500M16 5.200a3.200 3.200 0 0 1 0 5.600M17.500 14.800c2.100.600 3.500 2.400 3.500 5.200"/>',
    clock: '<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>',
    lock: '<rect x="5" y="10.500" width="14" height="9.500" rx="1.500"/><path d="M8 10.500V8a4 4 0 0 1 8 0v2.500"/>',
    check: '<path d="M5 12.500l4.500 4.500L19 7.500"/>',
    print: '<path d="M7 8V4h10v4M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z"/>',
    back: '<path d="M10 6l-6 6 6 6M4 12h16"/>',
    camera: '<path d="M4 8h3l1.500-2.500h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.500"/>',
    ticket: '<path d="M4 7h16v3.500a1.500 1.500 0 0 0 0 3V17H4v-3.500a1.500 1.500 0 0 0 0-3z"/><path d="M14 7v10" stroke-dasharray="2 2"/>'
  };
  function icon(name) {
    var s = document.createElement('span');
    s.className = 'e-icon';
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
    return s;
  }

  // Meta Pixel van de organisator. Mag nooit de pagina breken.
  function pixel(id) {
    if (!/^\d{5,20}$/.test(String(id || ''))) return false;
    try {
      if (!window.fbq) {
        var n = window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
        if (!window._fbq) window._fbq = n;
        n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
        var s = document.createElement('script');
        s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js';
        s.onerror = function () {};
        document.head.appendChild(s);
      }
      if (!window.__entreePixel) { window.__entreePixel = id; window.fbq('init', String(id)); }
      return true;
    } catch (e) { return false; }
  }
  function track(name, data) {
    try { if (window.fbq && window.__entreePixel) window.fbq('track', name, data || {}); } catch (e) {}
  }

  window.EntreeT = {
    FN: FN, api: api, euro: euro, imageUrl: imageUrl, linkUrl: linkUrl, host: host,
    when: when, day: day, time: time, shortMoment: shortMoment, el: el, icon: icon, pixel: pixel, track: track
  };
})();

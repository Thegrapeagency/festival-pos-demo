// Ticketpagina: t/ticket.html?order=<token>
(function () {
  'use strict';
  var T = window.EntreeT, el = T.el;
  var $ = function (id) { return document.getElementById(id); };
  var token = new URLSearchParams(location.search).get('order') || '';
  var POLL_MS = 2500, POLL_MAX = 48; // ongeveer twee minuten
  var lang = 'nl', polls = 0, timer = null, order = null, lastKey = '';

  var DICT = {
    nl: {
      kickerPaid: 'Je tickets', kickerOrder: 'Je bestelling', title: 'Je tickets',
      testBanner: 'Testbestelling: deze tickets zijn niet geldig voor toegang.',
      ticketOf: 'Ticket {i} van {n}', valid: 'Geldig', used: 'Gescand', usedAt: 'Gescand om {when}', void: 'Ongeldig',
      print: 'Tickets printen of opslaan als pdf', calendar: 'Zet in agenda', back: 'Terug naar {site}',
      summary: 'Je bestelling', free: 'Gratis', discount: 'Korting', fee: 'Servicekosten', total: 'Totaal',
      ref: 'Bestelnummer {ref}', refTest: 'Bestelnummer {ref} (testbestelling)',
      paidIntro: 'Laat bij de ingang de QR-code zien, op je scherm of geprint. Elke code is één keer geldig.',
      pendingTitle: 'We wachten op je betaling', pendingText: 'Dit duurt meestal een paar seconden. Je hoeft niets te doen, deze pagina ververst vanzelf.',
      slowTitle: 'De betaling is nog niet binnen', slowText: 'Heb je al betaald? Dan kan de bevestiging iets langer duren. Heb je nog niet betaald, dan kun je dat alsnog doen.',
      retry: 'Opnieuw proberen', payNow: 'Alsnog betalen', notPaidYet: 'Nog niet betaald? Ga naar de betaalpagina',
      demoTitle: 'Testbetaling', demoText: 'Dit is een testbestelling uit het voorbeeld van de shop. Er wordt niets afgeschreven. Simuleer de betaling om te zien hoe de tickets eruitzien.',
      demoPay: 'Betaling simuleren', demoFail: 'De testbetaling lukte niet. Probeer het opnieuw.', busy: 'Bezig',
      canceledTitle: 'De betaling is geannuleerd', canceledText: 'Er is niets afgeschreven en er zijn geen tickets gemaakt. Je kunt gewoon opnieuw bestellen.',
      expiredTitle: 'De betaling is verlopen', expiredText: 'Het duurde te lang voordat de betaling rond was. Er is niets afgeschreven. Je kunt opnieuw bestellen.',
      refundedTitle: 'Deze bestelling is terugbetaald', refundedText: 'De tickets van deze bestelling zijn niet meer geldig. Het bedrag is teruggestort.',
      again: 'Opnieuw bestellen', notFoundTitle: 'Deze bestelling is niet gevonden', notFoundText: 'Controleer de link uit je bevestigingsmail. Kom je er niet uit, neem dan contact op met de organisator.',
      errorTitle: 'Je tickets ophalen lukte niet', errorText: 'Controleer je internetverbinding en probeer het opnieuw.',
      noTickets: 'Je tickets worden klaargezet. Ververs de pagina over een paar tellen.',
      foot: 'Bewaar deze pagina of de bevestigingsmail: de link is je ticket.', by: 'Tickets van {org}', at: ' om '
    },
    en: {
      kickerPaid: 'Your tickets', kickerOrder: 'Your order', title: 'Your tickets',
      testBanner: 'Test order: these tickets are not valid for entry.',
      ticketOf: 'Ticket {i} of {n}', valid: 'Valid', used: 'Scanned', usedAt: 'Scanned at {when}', void: 'Not valid',
      print: 'Print tickets or save as PDF', calendar: 'Add to calendar', back: 'Back to {site}',
      summary: 'Your order', free: 'Free', discount: 'Discount', fee: 'Service fee', total: 'Total',
      ref: 'Order reference {ref}', refTest: 'Order reference {ref} (test order)',
      paidIntro: 'Show the QR code at the entrance, on your screen or printed. Each code is valid once.',
      pendingTitle: 'Waiting for your payment', pendingText: 'This usually takes a few seconds. You do not have to do anything, this page refreshes by itself.',
      slowTitle: 'The payment has not come in yet', slowText: 'Already paid? The confirmation can take a little longer. If you have not paid yet, you can still do so.',
      retry: 'Try again', payNow: 'Pay now', notPaidYet: 'Not paid yet? Go to the payment page',
      demoTitle: 'Test payment', demoText: 'This is a test order from the shop preview. Nothing will be charged. Simulate the payment to see what the tickets look like.',
      demoPay: 'Simulate payment', demoFail: 'The test payment failed. Please try again.', busy: 'One moment',
      canceledTitle: 'The payment was cancelled', canceledText: 'Nothing was charged and no tickets were created. You can simply order again.',
      expiredTitle: 'The payment has expired', expiredText: 'It took too long to complete the payment. Nothing was charged. You can order again.',
      refundedTitle: 'This order has been refunded', refundedText: 'The tickets of this order are no longer valid. The amount has been refunded.',
      again: 'Order again', notFoundTitle: 'This order was not found', notFoundText: 'Check the link in your confirmation email. If that does not help, contact the organiser.',
      errorTitle: 'Your tickets could not be loaded', errorText: 'Check your internet connection and try again.',
      noTickets: 'Your tickets are being prepared. Refresh the page in a few moments.',
      foot: 'Keep this page or the confirmation email: the link is your ticket.', by: 'Tickets by {org}', at: ' at '
    }
  };
  function t(key, vars) {
    var s = (DICT[lang] && DICT[lang][key]) || DICT.nl[key] || key;
    Object.keys(vars || {}).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
    return s;
  }

  function show(content) { $('loading').hidden = content; $('content').hidden = !content; }
  function btn(text, cls, iconName) {
    var b = el('button', 'btn ' + (cls || '')); b.type = 'button';
    if (iconName) b.appendChild(T.icon(iconName));
    b.appendChild(el('span', null, text));
    return b;
  }
  function linkBtn(text, href, cls, iconName) {
    var a = el('a', 'btn ' + (cls || '')); a.href = href;
    if (iconName) a.appendChild(T.icon(iconName));
    a.appendChild(el('span', null, text));
    return a;
  }
  function stateCard(title, text) {
    var c = el('section', 'card statecard');
    c.appendChild(el('h2', null, title));
    if (text) c.appendChild(el('p', null, text));
    return c;
  }
  function setStatus(node) { var s = $('status'); s.textContent = ''; if (node) s.appendChild(node); }
  function shopUrl(o) { return o.event && /^[a-z0-9-]{1,80}$/.test(o.event.slug || '') ? './?e=' + o.event.slug : ''; }
  function backUrl(o) { return T.linkUrl(o.return_url) || T.linkUrl(o.shop && o.shop.website_url); }

  function bare(title, text, retry) {
    // Nog geen huisstijl bekend (bijvoorbeeld bij een link die niet klopt): de standaardstijl van het platform.
    if (!document.documentElement.style.getPropertyValue('--e-primary')) window.EntreeBrand.apply({});
    show(true);
    $('brandbar').hidden = true; $('kicker').textContent = ''; $('event-name').textContent = ''; $('meta').hidden = true;
    $('actions').hidden = true; $('tickets').hidden = true; $('summary').hidden = true; $('foot').textContent = '';
    var c = stateCard(title, text);
    if (retry) {
      var a = el('div', 'actions'); var b = btn(t('retry'), 'ghost');
      b.addEventListener('click', function () { show(false); polls = 0; fetchStatus(); });
      a.appendChild(b); c.appendChild(a);
    }
    setStatus(c);
  }

  // ---------- kop ----------
  function renderHead(o) {
    var shop = o.shop || {}, ev = o.event || {}, brand = shop.brand || {};
    window.EntreeBrand.apply(brand);
    lang = o.locale === 'en' || (!o.locale && shop.lang === 'en') ? 'en' : 'nl';
    document.documentElement.lang = lang;
    document.title = t('title') + (ev.name ? ' | ' + ev.name : '');
    var logoUrl = T.imageUrl(brand.logo_url), logo = $('logo');
    $('brandbar').hidden = !logoUrl;
    if (logoUrl) { if (logo.getAttribute('src') !== logoUrl) logo.src = logoUrl; logo.alt = ev.organizer || ''; }
    logo.onerror = function () { $('brandbar').hidden = true; };
    $('kicker').textContent = o.status === 'paid' ? t('kickerPaid') : t('kickerOrder');
    $('event-name').textContent = ev.name || '';
    var meta = $('meta'); meta.textContent = '';
    var when = T.when(ev.starts_at, ev.ends_at, lang);
    if (when) { var li = el('li'); li.appendChild(T.icon('calendar')); li.appendChild(el('span', null, when)); meta.appendChild(li); }
    if (ev.location) { var li2 = el('li'); li2.appendChild(T.icon('pin')); li2.appendChild(el('span', null, ev.location)); meta.appendChild(li2); }
    meta.hidden = !meta.children.length;

    var b = $('banners'); b.textContent = '';
    if (o.is_test) {
      var bn = el('div', 'banner'); bn.id = 'test-banner';
      bn.appendChild(el('span', 'dot')); bn.appendChild(el('strong', null, t('testBanner')));
      b.appendChild(bn);
    }
  }

  function line(label, value, cls) {
    var d = el('div', 'line' + (cls ? ' ' + cls : ''));
    d.appendChild(el('span', null, label)); d.appendChild(el('span', null, value));
    return d;
  }
  function renderSummary(o) {
    var box = $('summary-lines'); box.textContent = '';
    $('summary-title').textContent = t('summary');
    (o.items || []).forEach(function (i) {
      box.appendChild(line(i.qty + '× ' + i.name, i.unit_price_cents === 0 ? t('free') : T.euro(i.qty * i.unit_price_cents)));
    });
    if (o.discount_cents > 0) box.appendChild(line(t('discount'), '− ' + T.euro(o.discount_cents), 'sub'));
    if (o.fee_cents > 0) box.appendChild(line(t('fee'), T.euro(o.fee_cents), 'sub'));
    box.appendChild(line(t('total'), o.total_cents === 0 ? t('free') : T.euro(o.total_cents), 'total'));
    $('summary-ref').textContent = t(o.is_test ? 'refTest' : 'ref', { ref: o.ref || '' }) + (o.buyer_name ? ' · ' + o.buyer_name : '');
    $('summary').hidden = false;
  }

  // ---------- tickets ----------
  function qrNode(code) {
    var box = el('div', 'qrbox');
    if (!/^[A-Za-z0-9]{6,40}$/.test(code) || typeof window.qrcode !== 'function') return box;
    try {
      var q = window.qrcode(0, 'M');
      q.addData(code); q.make();
      // De SVG komt uit de bibliotheek en bevat alleen blokjes, geen tekst van de server.
      box.innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
      var svg = box.querySelector('svg');
      if (svg) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'QR-code ' + code); }
    } catch (e) {}
    return box;
  }
  function usedMoment(iso) {
    var d = T.day(iso, lang), today = T.day(new Date().toISOString(), lang), tm = T.time(iso, lang);
    if (!tm) return '';
    return d === today ? tm : T.shortMoment(iso, lang);
  }
  function renderTickets(o) {
    var wrap = $('tickets'), list = o.tickets || [], ev = o.event || {};
    wrap.textContent = '';
    var when = T.when(ev.starts_at, ev.ends_at, lang);
    if (!list.length) { wrap.appendChild(stateCard(t('noTickets'))); wrap.hidden = false; return; }
    list.forEach(function (k, i) {
      var st = k.status === 'used' ? 'used' : k.status === 'void' ? 'void' : 'valid';
      var card = el('article', 'card ticket ' + st);
      var qr = el('div', 'ticket-qr');
      qr.appendChild(qrNode(String(k.code || '')));
      qr.appendChild(el('div', 'ticket-code', String(k.code || '')));
      card.appendChild(qr);

      var info = el('div', 'ticket-info');
      info.appendChild(el('div', 'ticket-count', t('ticketOf', { i: i + 1, n: list.length })));
      info.appendChild(el('div', 'ticket-type', k.type || 'Ticket'));
      if (k.valid_label) info.appendChild(el('div', 'ticket-valid', k.valid_label));
      var rows = el('div', 'ticket-rows');
      var add = function (iconName, text) { if (!text) return; var r = el('div'); r.appendChild(T.icon(iconName)); r.appendChild(el('span', null, text)); rows.appendChild(r); };
      add('ticket', ev.name);
      add('calendar', when);
      add('pin', ev.location);
      add('people', k.holder_name);
      info.appendChild(rows);
      var status = el('div', 'ticket-status');
      var label = st === 'valid' ? t('valid') : st === 'void' ? t('void') : (k.used_at && usedMoment(k.used_at) ? t('usedAt', { when: usedMoment(k.used_at) }) : t('used'));
      status.appendChild(el('span', 'badge ' + (st === 'valid' ? 'ok' : st === 'void' ? 'bad' : 'warn'), label));
      if (o.is_test) { status.appendChild(document.createTextNode(' ')); status.appendChild(el('span', 'badge warn', lang === 'en' ? 'Test order' : 'Testbestelling')); }
      info.appendChild(status);
      if (o.shop && o.shop.ticket_note) info.appendChild(el('div', 'ticket-note', o.shop.ticket_note));
      card.appendChild(info);
      wrap.appendChild(card);
    });
    wrap.hidden = false;
  }

  // ---------- agenda (.ics) ----------
  function icsDate(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function icsText(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, '\\$&').replace(/\r?\n/g, '\\n'); }
  function downloadIcs(o) {
    var ev = o.event || {}, start = new Date(ev.starts_at);
    if (isNaN(start)) return;
    var end = new Date(ev.ends_at);
    if (isNaN(end) || end <= start) end = new Date(start.getTime() + 3 * 3600 * 1000);
    var body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Entree//Tickets//NL', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      'UID:' + icsText((o.ref || 'order') + '-' + (ev.slug || 'event')) + '@entree', 'DTSTAMP:' + icsDate(new Date()),
      'DTSTART:' + icsDate(start), 'DTEND:' + icsDate(end), 'SUMMARY:' + icsText(ev.name),
      ev.location ? 'LOCATION:' + icsText(ev.location) : '',
      'DESCRIPTION:' + icsText((lang === 'en' ? 'Your tickets: ' : 'Je tickets: ') + location.href),
      'URL:' + location.href, 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
    var blob = new Blob([body], { type: 'text/calendar;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = ((ev.slug || 'event').replace(/[^a-z0-9-]/gi, '') || 'event') + '.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  function renderActions(o, paid) {
    var box = $('actions'); box.textContent = '';
    if (paid && (o.tickets || []).length) {
      var p = btn(t('print'), '', 'print'); p.id = 'print-btn';
      p.addEventListener('click', function () { window.print(); });
      box.appendChild(p);
      if (o.event && o.event.starts_at && !isNaN(new Date(o.event.starts_at))) {
        var c = btn(t('calendar'), 'ghost', 'calendar'); c.id = 'ics-btn';
        c.addEventListener('click', function () { downloadIcs(o); });
        box.appendChild(c);
      }
    }
    var back = backUrl(o);
    if (back && paid) { var b = linkBtn(t('back', { site: T.host(back) }), back, 'ghost', 'back'); b.id = 'back-link'; box.appendChild(b); }
    box.hidden = !box.children.length;
  }

  function purchasePixel(o) {
    if (o.status !== 'paid' || o.is_test || !o.shop) return;
    var key = 'entree-purchase-' + (o.ref || '') + '-' + token.slice(0, 12);
    try { if (localStorage.getItem(key)) return; } catch (e) { return; }
    if (!T.pixel(o.shop.pixel_id)) return;
    try { localStorage.setItem(key, '1'); } catch (e) {}
    T.track('PageView');
    T.track('Purchase', { value: (o.total_cents || 0) / 100, currency: 'EUR', num_items: (o.tickets || []).length });
  }

  // ---------- toestanden ----------
  function render(o) {
    order = o;
    renderHead(o);
    show(true);
    $('foot').textContent = '';
    var st = o.status;

    if (st === 'paid') {
      setStatus(el('p', 'lead noprint', t('paidIntro')));
      renderActions(o, true); renderTickets(o); renderSummary(o);
      $('foot').textContent = t('foot') + (o.event && o.event.organizer ? ' ' + t('by', { org: o.event.organizer }) + '.' : '');
      purchasePixel(o);
      return;
    }
    $('tickets').hidden = true; $('actions').hidden = true;

    if (st === 'pending' && o.demo) {
      var c = stateCard(t('demoTitle'), t('demoText'));
      c.id = 'demo-card';
      c.insertBefore(el('div', 'amount', T.euro(o.total_cents)), c.children[1]);
      var a = el('div', 'actions'); var b = btn(t('demoPay')); b.id = 'demo-pay';
      var msg = el('div', 'msg err'); msg.setAttribute('role', 'alert');
      b.addEventListener('click', function () {
        b.disabled = true; msg.textContent = '';
        T.api('demo-pay', {}, { order: token }).then(function (r) {
          if (!r.ok) throw new Error('fail');
          return fetchStatus();
        }).catch(function () { b.disabled = false; msg.textContent = t('demoFail'); });
      });
      a.appendChild(b); c.appendChild(a); c.appendChild(msg);
      setStatus(c); renderSummary(o);
      return;
    }
    if (st === 'pending') {
      var pay = T.linkUrl(o.checkout_url), slow = polls >= POLL_MAX;
      var card = stateCard(slow ? t('slowTitle') : t('pendingTitle'), slow ? t('slowText') : t('pendingText'));
      card.id = 'pending-card';
      if (!slow) { var sp = el('div', 'spinner'); sp.setAttribute('aria-hidden', 'true'); card.insertBefore(sp, card.firstChild); }
      var acts = el('div', 'actions');
      if (slow) {
        var r = btn(t('retry')); r.id = 'retry-btn';
        r.addEventListener('click', function () { polls = 0; lastKey = ''; fetchStatus(); });
        acts.appendChild(r);
        if (pay) acts.appendChild(linkBtn(t('payNow'), pay, 'ghost'));
        card.appendChild(acts);
      } else if (pay) {
        var pl = el('a', 'small', t('notPaidYet')); pl.href = pay; pl.id = 'pay-link';
        card.appendChild(pl);
      }
      setStatus(card); renderSummary(o);
      return;
    }

    var title = st === 'refunded' ? t('refundedTitle') : st === 'expired' ? t('expiredTitle') : t('canceledTitle');
    var text = st === 'refunded' ? t('refundedText') : st === 'expired' ? t('expiredText') : t('canceledText');
    var sc = stateCard(title, text); sc.id = 'state-' + st;
    var ac = el('div', 'actions'), back = backUrl(o), again = shopUrl(o);
    if (st !== 'refunded') {
      // Bestelde iemand via de site van de organisator, dan gaat hij daar ook naar terug.
      if (T.linkUrl(o.return_url)) { var ba = linkBtn(t('again'), o.return_url); ba.id = 'again-link'; ac.appendChild(ba); }
      else if (again) { var ag = linkBtn(t('again'), again); ag.id = 'again-link'; ac.appendChild(ag); }
    }
    if (back && !(st !== 'refunded' && T.linkUrl(o.return_url))) ac.appendChild(linkBtn(t('back', { site: T.host(back) }), back, 'ghost', 'back'));
    if (ac.children.length) sc.appendChild(ac);
    setStatus(sc); renderSummary(o);
  }

  function fetchStatus() {
    clearTimeout(timer);
    return T.api('status', { order: token }).then(function (r) {
      if (r.status === 404) { bare(t('notFoundTitle'), t('notFoundText')); return; }
      if (!r.ok || !r.data || !r.data.status) { bare(t('errorTitle'), t('errorText'), true); return; }
      var o = r.data;
      var waiting = o.status === 'pending' && !o.demo;
      if (waiting) polls++;
      // Alleen opnieuw tekenen als er iets veranderde (voorkomt geflikker en focusverlies).
      var key = [o.status, o.demo, (o.tickets || []).map(function (k) { return k.code + k.status; }).join(','), waiting && polls >= POLL_MAX].join('|');
      if (key !== lastKey) { lastKey = key; render(o); }
      if (waiting && polls < POLL_MAX) timer = setTimeout(fetchStatus, POLL_MS);
    }).catch(function () {
      if (order && order.status === 'pending' && !order.demo && polls < POLL_MAX) { polls++; timer = setTimeout(fetchStatus, POLL_MS); }
      else if (!order) bare(t('errorTitle'), t('errorText'), true);
    });
  }

  // Terug op het tabblad: meteen opnieuw kijken.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && order && order.status === 'pending' && !order.demo && polls < POLL_MAX) fetchStatus();
  });

  if (!/^[0-9a-f]{32,80}$/.test(token)) bare(t('notFoundTitle'), t('notFoundText'));
  else fetchStatus();
})();

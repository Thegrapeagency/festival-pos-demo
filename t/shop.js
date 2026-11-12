// Entree ticketshop: t/?e=<slug>[&preview=<token>][&embed=1][&code=<kortingscode>][&parent=<adres>]
(function () {
  'use strict';
  var T = window.EntreeT, el = T.el;
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var slug = params.get('e') || '';
  var previewToken = params.get('preview') || '';
  var EMBED = params.get('embed') === '1';
  var parentUrl = T.linkUrl(params.get('parent') || '');

  var data = null;          // laatste antwoord van ?a=shop
  var qty = {};             // { type-id: aantal }
  var activeCode = '';      // toegepaste kortingscode
  var lang = 'nl';
  var busy = false;
  var rows = {};            // DOM per tickettype
  var pixelOn = false;
  var codeError = '';       // melding bij het kortingscode-veld

  var DICT = {
    nl: {
      loading: 'Shop laden', tickets: 'Tickets', yourOrder: 'Je bestelling', codeLabel: 'Kortingscode', apply: 'Toepassen',
      remove: 'Verwijderen', yourDetails: 'Je gegevens', name: 'Naam', email: 'E-mailadres',
      emailHint: 'Hier sturen we je tickets naartoe.', toCheckout: 'Verder',
      free: 'Gratis', soldOut: 'Uitverkocht', comingSoon: 'Binnenkort te koop', saleStarts: 'Verkoop start {when}',
      ended: 'Verkoop gesloten', left: 'Nog {n} beschikbaar', admits: 'Geldig voor {n} personen',
      minOrder: 'Minimaal {n} per bestelling', less: 'Minder {name}', more: 'Meer {name}', qtyOf: 'Aantal {name}',
      noTypes: 'Er zijn op dit moment geen tickets te koop.', emptyCart: 'Kies eerst je tickets.',
      discount: 'Korting ({code})', fee: 'Servicekosten', total: 'Totaal',
      codeApplied: 'Code {code} toegepast', codeEmpty: 'Vul een code in.',
      bad_code: 'Deze code klopt niet.', code_used_up: 'Deze code is op.', code_not_started: 'Deze code is nog niet geldig.',
      code_ended: 'Deze code is verlopen.', codeNoEffect: 'Deze code geldt niet voor de tickets die je nu hebt gekozen.',
      choose: 'Maak een keuze', termsPlain: 'Ik ga akkoord met de voorwaarden', termsPre: 'Ik ga akkoord met de ', termsLink: 'voorwaarden',
      errName: 'Vul je naam in.', errEmail: 'Vul een geldig e-mailadres in.', errRequired: 'Dit veld is verplicht.',
      errTerms: 'Ga akkoord met de voorwaarden om te bestellen.', errForm: 'Nog niet alles is ingevuld. Kijk de velden hierboven na.',
      errNetwork: 'Er is geen verbinding. Controleer je internet en probeer het opnieuw.', errGeneric: 'Bestellen lukte niet. Probeer het opnieuw.',
      order: 'Bestellen', orderPay: 'Bestellen en betalen', orderTest: 'Testbestelling plaatsen', busy: 'Bezig',
      payNote: 'Je betaalt veilig via Mollie. Daarna staan je tickets klaar en krijg je ze ook per mail.',
      freeNote: 'Na het bestellen staan je tickets direct klaar en krijg je ze ook per mail.',
      testNote: 'Dit is een voorbeeld. Er wordt niets afgeschreven.',
      payNone: 'Online betalen is voor dit event nog niet ingesteld. Betaalde tickets kun je daarom nog niet bestellen.',
      previewBanner: 'Voorbeeld: bestellingen zijn testbestellingen, er wordt niets afgeschreven.',
      testBanner: 'Testmodus van Mollie: betalingen zijn nep, er wordt niets afgeschreven.',
      offlineTitle: 'De verkoop is nog niet gestart', offlineText: 'Kom later terug of houd de kanalen van {org} in de gaten.',
      notFoundTitle: 'Deze ticketshop bestaat niet (meer)', notFoundText: 'Controleer de link of vraag de organisator om de juiste.',
      errorTitle: 'De shop laden lukte niet', errorText: 'Controleer je internetverbinding en probeer het opnieuw.', retry: 'Opnieuw proberen',
      ticketsCount: '{n} tickets', ticketCount: '1 ticket', continuePay: 'Ga verder naar betalen',
      foot: 'Tickets van {org}', powered: 'Ticketverkoop via Entree', titleSuffix: 'tickets'
    },
    en: {
      loading: 'Loading shop', tickets: 'Tickets', yourOrder: 'Your order', codeLabel: 'Discount code', apply: 'Apply',
      remove: 'Remove', yourDetails: 'Your details', name: 'Name', email: 'Email address',
      emailHint: 'We will send your tickets here.', toCheckout: 'Continue',
      free: 'Free', soldOut: 'Sold out', comingSoon: 'On sale soon', saleStarts: 'On sale from {when}',
      ended: 'Sales closed', left: 'Only {n} left', admits: 'Valid for {n} people',
      minOrder: 'Minimum {n} per order', less: 'Fewer {name}', more: 'More {name}', qtyOf: 'Quantity {name}',
      noTypes: 'There are no tickets on sale right now.', emptyCart: 'Choose your tickets first.',
      discount: 'Discount ({code})', fee: 'Service fee', total: 'Total',
      codeApplied: 'Code {code} applied', codeEmpty: 'Enter a code.',
      bad_code: 'This code is not valid.', code_used_up: 'This code has been used up.', code_not_started: 'This code is not valid yet.',
      code_ended: 'This code has expired.', codeNoEffect: 'This code does not apply to the tickets you have chosen.',
      choose: 'Choose an option', termsPlain: 'I agree to the terms', termsPre: 'I agree to the ', termsLink: 'terms',
      errName: 'Please enter your name.', errEmail: 'Please enter a valid email address.', errRequired: 'This field is required.',
      errTerms: 'Please agree to the terms to order.', errForm: 'Some fields still need your attention.',
      errNetwork: 'There is no connection. Check your internet and try again.', errGeneric: 'Ordering failed. Please try again.',
      order: 'Order', orderPay: 'Order and pay', orderTest: 'Place test order', busy: 'One moment',
      payNote: 'You pay securely via Mollie. Your tickets are ready right after and are also sent by email.',
      freeNote: 'Your tickets are ready right after ordering and are also sent by email.',
      testNote: 'This is a preview. Nothing will be charged.',
      payNone: 'Online payment has not been set up for this event yet. Paid tickets cannot be ordered for now.',
      previewBanner: 'Preview: orders are test orders, nothing will be charged.',
      testBanner: 'Mollie test mode: payments are fake, nothing will be charged.',
      offlineTitle: 'Ticket sales have not started yet', offlineText: 'Come back later or keep an eye on the channels of {org}.',
      notFoundTitle: 'This ticket shop does not exist (anymore)', notFoundText: 'Check the link or ask the organiser for the right one.',
      errorTitle: 'The shop could not be loaded', errorText: 'Check your internet connection and try again.', retry: 'Try again',
      ticketsCount: '{n} tickets', ticketCount: '1 ticket', continuePay: 'Continue to payment',
      foot: 'Tickets by {org}', powered: 'Ticketing by Entree', titleSuffix: 'tickets'
    }
  };
  function t(key, vars) {
    var s = (DICT[lang] && DICT[lang][key]) || DICT.nl[key] || key;
    Object.keys(vars || {}).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
    return s;
  }
  function price(cents) { return cents === 0 ? t('free') : T.euro(cents); }

  // ---------- rekenen (zelfde regels als de server) ----------
  function totals() {
    var d = data && data.discount, types = (data && data.types) || [];
    var sub = 0, base = 0, persons = 0, units = 0, lines = [];
    types.forEach(function (tp) {
      var q = qty[tp.id] || 0;
      if (!q) return;
      var amount = q * tp.price_cents;
      sub += amount; units += q;
      if (tp.price_cents > 0) persons += q * (tp.admits || 1);
      if (d && (!d.applies_to || d.applies_to.indexOf(tp.id) > -1)) base += amount;
      lines.push({ label: q + '× ' + tp.name, amount: amount, free: tp.price_cents === 0 });
    });
    var discount = 0;
    if (d) discount = d.kind === 'percent' ? Math.floor(base * Math.min(Number(d.value) || 0, 100) / 100) : Math.min(base, Number(d.value) || 0);
    var fee = sub - discount > 0 ? persons * (data.fee_cents || 0) : 0;
    return { lines: lines, sub: sub, discount: discount, fee: fee, total: sub - discount + fee, units: units };
  }

  // ---------- toestanden ----------
  function show(which) {
    $('loading').hidden = which !== 'loading';
    $('message').hidden = which !== 'message';
    $('shop').hidden = which !== 'shop';
  }
  function showMessage(title, text, retry) {
    $('message-title').textContent = title;
    $('message-text').textContent = text;
    var b = $('message-retry');
    b.hidden = !retry;
    if (retry) { b.textContent = t('retry'); b.onclick = function () { show('loading'); load(activeCode); }; }
    show('message');
  }
  function staticTexts() {
    document.documentElement.lang = lang;
    Array.prototype.forEach.call(document.querySelectorAll('[data-t]'), function (n) { n.textContent = t(n.getAttribute('data-t')); });
  }
  function banner(text) {
    var b = el('div', 'banner');
    b.appendChild(el('span', 'dot'));
    b.appendChild(el('span', null, text));
    return b;
  }

  // ---------- tekenen ----------
  function renderHeader() {
    var shop = data.shop || {}, ev = data.event || {}, brand = shop.brand || {};
    window.EntreeBrand.apply(brand);
    lang = shop.lang === 'en' ? 'en' : 'nl';
    staticTexts();
    document.title = (ev.name || 'Tickets') + ' | ' + t('titleSuffix');

    var logo = $('logo'), logoUrl = T.imageUrl(brand.logo_url);
    logo.hidden = !logoUrl;
    if (logoUrl) { if (logo.getAttribute('src') !== logoUrl) logo.src = logoUrl; logo.alt = ev.organizer || ''; } else logo.removeAttribute('src');
    logo.onerror = function () { logo.hidden = true; $('organizer').hidden = false; };
    $('organizer').textContent = ev.organizer || '';
    $('organizer').hidden = !!logoUrl || !ev.organizer;
    $('brandbar').hidden = !logoUrl && !ev.organizer;

    var cover = $('cover'), coverUrl = T.imageUrl(brand.cover_url);
    $('cover-wrap').hidden = !coverUrl;
    if (coverUrl) { if (cover.getAttribute('src') !== coverUrl) cover.src = coverUrl; } else cover.removeAttribute('src');
    cover.onerror = function () { $('cover-wrap').hidden = true; };

    $('event-name').textContent = ev.name || '';
    var meta = $('meta'); meta.textContent = '';
    var when = T.when(ev.starts_at, ev.ends_at, lang);
    if (when) { var li = el('li'); li.appendChild(T.icon('calendar')); li.appendChild(el('span', null, when)); meta.appendChild(li); }
    if (ev.location) { var li2 = el('li'); li2.appendChild(T.icon('pin')); li2.appendChild(el('span', null, ev.location)); meta.appendChild(li2); }
    meta.hidden = !meta.children.length;
    $('intro').textContent = shop.intro || ''; $('intro').hidden = !shop.intro;
    $('description').textContent = ev.description || ''; $('description').hidden = !ev.description;

    var foot = $('foot'); foot.textContent = '';
    var parts = [];
    if (ev.organizer) parts.push(t('foot', { org: ev.organizer }));
    parts.push(t('powered'));
    foot.appendChild(document.createTextNode(parts.join(' · ')));
    var mail = shop.contact_email;
    if (mail && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
      foot.appendChild(document.createTextNode(' · '));
      var a = el('a', null, mail); a.href = 'mailto:' + mail; foot.appendChild(a);
    }
  }

  function renderBanners() {
    var b = $('banners'); b.textContent = '';
    if (!data || data.state !== 'open') return;
    if (data.preview || data.pay_mode === 'demo') b.appendChild(banner(t('previewBanner')));
    else if (data.pay_mode === 'test') b.appendChild(banner(t('testBanner')));
  }

  function typeBadge(tp) {
    var shop = data.shop || {};
    if (tp.state === 'sold_out') return el('span', 'badge bad', t('soldOut'));
    if (tp.state === 'coming_soon') {
      var w = T.shortMoment(tp.sale_starts_at, lang);
      return el('span', 'badge', w ? t('saleStarts', { when: w }) : t('comingSoon'));
    }
    if (tp.state === 'ended') return el('span', 'badge', t('ended'));
    if (shop.show_remaining !== false && tp.left !== null && tp.left !== undefined && tp.left <= 25) {
      return el('span', 'badge warn', t('left', { n: tp.left }));
    }
    return null;
  }

  function renderTypes() {
    var wrap = $('types'), brand = (data.shop && data.shop.brand) || {};
    wrap.className = 'types ' + (brand.layout === 'cards' ? 'cards' : 'list');
    wrap.textContent = ''; rows = {};
    var types = data.types || [];
    // aantallen opschonen: type weg of niet meer te koop
    Object.keys(qty).forEach(function (id) {
      var tp = types.filter(function (x) { return x.id === id; })[0];
      if (!tp || tp.state !== 'available') { delete qty[id]; return; }
      var max = tp.max_per_order, min = Math.max(1, tp.min_per_order || 1);
      if (qty[id] > max) qty[id] = max;
      if (qty[id] < min) delete qty[id];
    });
    if (!types.length) { wrap.className = 'types list'; wrap.appendChild(el('div', 'notypes', t('noTypes'))); return; }

    types.forEach(function (tp) {
      var can = tp.state === 'available' && tp.max_per_order >= Math.max(1, tp.min_per_order || 1);
      var row = el('div', 'type' + (can ? '' : ' off'));
      var info = el('div', 'type-info');
      info.appendChild(el('div', 'type-name', tp.name));
      if (tp.description) info.appendChild(el('div', 'type-desc', tp.description));
      var tags = el('div', 'type-tags');
      if (tp.valid_label) { var v = el('span'); v.appendChild(T.icon('clock')); v.appendChild(el('span', null, tp.valid_label)); tags.appendChild(v); }
      if ((tp.admits || 1) > 1) { var p = el('span'); p.appendChild(T.icon('people')); p.appendChild(el('span', null, t('admits', { n: tp.admits }))); tags.appendChild(p); }
      if (can && (tp.min_per_order || 1) > 1) tags.appendChild(el('span', null, t('minOrder', { n: tp.min_per_order })));
      info.appendChild(tags);
      var badges = el('div', 'type-badges'), badge = typeBadge(tp);
      if (badge) badges.appendChild(badge);
      info.appendChild(badges);
      row.appendChild(info);

      var side = el('div', 'type-side');
      side.appendChild(el('div', 'type-price', price(tp.price_cents)));
      var refs = { row: row, type: tp };
      if (can) {
        var st = el('div', 'stepper');
        st.setAttribute('role', 'group'); st.setAttribute('aria-label', t('qtyOf', { name: tp.name }));
        var minus = el('button', null, '−'); minus.type = 'button'; minus.setAttribute('aria-label', t('less', { name: tp.name }));
        var out = el('output', null, '0'); out.setAttribute('aria-live', 'polite');
        var plus = el('button', null, '+'); plus.type = 'button'; plus.setAttribute('aria-label', t('more', { name: tp.name }));
        minus.addEventListener('click', function () { step(tp, -1); });
        plus.addEventListener('click', function () { step(tp, 1); });
        st.appendChild(minus); st.appendChild(out); st.appendChild(plus);
        side.appendChild(st);
        refs.minus = minus; refs.plus = plus; refs.out = out;
      }
      row.appendChild(side);
      wrap.appendChild(row);
      rows[tp.id] = refs;
    });
    syncSteppers();
  }

  // Eerste klik springt naar het minimum; onder het minimum is het weer nul.
  function step(tp, dir) {
    var min = Math.max(1, tp.min_per_order || 1), max = tp.max_per_order, q = qty[tp.id] || 0;
    if (dir > 0) q = q === 0 ? min : Math.min(max, q + 1);
    else q = q <= min ? 0 : q - 1;
    if (q) qty[tp.id] = q; else delete qty[tp.id];
    syncSteppers();
    renderSummary();
  }
  function syncSteppers() {
    Object.keys(rows).forEach(function (id) {
      var r = rows[id], q = qty[id] || 0;
      r.row.classList.toggle('selected', q > 0);
      if (!r.out) return;
      r.out.textContent = String(q);
      r.minus.disabled = q === 0;
      r.plus.disabled = q >= r.type.max_per_order;
    });
  }

  function line(label, value, cls) {
    var d = el('div', 'line' + (cls ? ' ' + cls : ''));
    d.appendChild(el('span', null, label)); d.appendChild(el('span', null, value));
    return d;
  }

  function renderSummary() {
    var tt = totals(), lines = $('lines');
    lines.textContent = '';
    var has = tt.units > 0;
    if (!has) lines.appendChild(el('p', 'empty', t('emptyCart')));
    tt.lines.forEach(function (l) { lines.appendChild(line(l.label, l.free ? t('free') : T.euro(l.amount))); });
    if (has && tt.discount > 0) lines.appendChild(line(t('discount', { code: data.discount.code }), '− ' + T.euro(tt.discount), 'sub'));
    if (has && tt.fee > 0) lines.appendChild(line(t('fee'), T.euro(tt.fee), 'sub'));
    if (has) lines.appendChild(line(t('total'), tt.total === 0 ? t('free') : T.euro(tt.total), 'total'));

    $('order-form').hidden = !has;
    var demo = data.pay_mode === 'demo';
    var blocked = data.pay_mode === 'none' && tt.total > 0;
    var pn = $('pay-none');
    pn.hidden = !blocked; pn.className = 'msg err'; pn.textContent = blocked ? t('payNone') : '';
    var btn = $('submit');
    if (!busy) {
      btn.disabled = blocked;
      btn.textContent = demo ? t('orderTest') : tt.total > 0 ? t('orderPay') + ' · ' + T.euro(tt.total) : t('order');
    }
    $('paynote').textContent = demo ? t('testNote') : tt.total > 0 ? t('payNote') : t('freeNote');
    var ic = $('paynote-icon'); ic.textContent = ''; ic.appendChild(T.icon(tt.total > 0 && !demo ? 'lock' : 'check'));

    // kortingscode
    var d = data.discount;
    $('code-form').hidden = !!d;
    $('code-chip').hidden = !d;
    if (d) {
      $('code-chip-text').textContent = t('codeApplied', { code: d.code });
    }
    var cm = $('code-msg');
    if (d && has && tt.discount === 0 && tt.sub > 0) { cm.className = 'small muted'; cm.style.marginTop = '6px'; cm.textContent = t('codeNoEffect'); }
    else { cm.className = 'fielderr'; cm.style.marginTop = ''; cm.textContent = codeError; }

    // balk onderaan op mobiel
    var bar = $('stickybar');
    bar.dataset.has = has ? '1' : '';
    $('sticky-count').textContent = tt.units === 1 ? t('ticketCount') : t('ticketsCount', { n: tt.units });
    $('sticky-total').textContent = tt.total === 0 ? t('free') : T.euro(tt.total);
    updateSticky();
    reportHeight();
  }

  function renderFields() {
    var wrap = $('fields'), fields = (data.shop && data.shop.fields) || [];
    var old = {};
    Array.prototype.forEach.call(wrap.querySelectorAll('[data-key]'), function (n) {
      old[n.getAttribute('data-key')] = n.type === 'checkbox' ? n.checked : n.value;
    });
    wrap.textContent = '';
    fields.forEach(function (f, i) {
      if (!f || !f.key || !f.label) return;
      var id = 'f-' + i, box = el('div', 'field'), input;
      var star = function () { var s = el('span', 'req', '*'); s.setAttribute('aria-hidden', 'true'); return s; };
      if (f.type === 'checkbox') {
        var lab = el('label', 'check');
        input = el('input'); input.type = 'checkbox'; input.id = id;
        input.checked = old[f.key] === true;
        var txt = el('span', null, f.label);
        if (f.required) txt.appendChild(star());
        lab.appendChild(input); lab.appendChild(txt); box.appendChild(lab);
      } else {
        var l = el('label'); l.htmlFor = id; l.appendChild(el('span', null, f.label));
        if (f.required) l.appendChild(star());
        box.appendChild(l);
        if (f.type === 'select') {
          input = el('select', 'select'); input.id = id;
          var o0 = el('option', null, t('choose')); o0.value = ''; input.appendChild(o0);
          (f.options || []).forEach(function (opt) { var o = el('option', null, opt); o.value = opt; input.appendChild(o); });
          if (typeof old[f.key] === 'string') input.value = old[f.key];
        } else {
          input = el('input', 'input'); input.type = 'text'; input.id = id; input.maxLength = 300;
          if (typeof old[f.key] === 'string') input.value = old[f.key];
        }
        box.appendChild(input);
      }
      input.setAttribute('data-key', f.key);
      if (f.required) { input.required = true; input.setAttribute('aria-required', 'true'); }
      var err = el('div', 'fielderr'); err.id = id + '-err';
      input.setAttribute('aria-describedby', err.id);
      box.appendChild(err);
      wrap.appendChild(box);
    });

    var termsUrl = T.linkUrl(data.shop && data.shop.terms_url);
    $('terms-wrap').hidden = !termsUrl;
    var tx = $('terms-text'); tx.textContent = '';
    if (termsUrl) {
      tx.appendChild(document.createTextNode(t('termsPre')));
      var a = el('a', null, t('termsLink')); a.href = termsUrl; a.target = '_blank'; a.rel = 'noopener noreferrer';
      tx.appendChild(a);
      var s = el('span', 'req', '*'); s.setAttribute('aria-hidden', 'true'); tx.appendChild(s);
    }
  }

  function renderAll() {
    renderHeader();
    renderBanners();
    if (data.state === 'offline') {
      $('cols').hidden = true; $('notice').hidden = false;
      $('notice-title').textContent = t('offlineTitle');
      $('notice-text').textContent = t('offlineText', { org: (data.event && data.event.organizer) || 'de organisator' });
      $('stickybar').hidden = true;
    } else {
      $('cols').hidden = false; $('notice').hidden = true;
      renderTypes(); renderFields(); renderSummary();
    }
    show('shop');
    reportHeight();
  }

  // ---------- laden ----------
  function load(code, fromCodeForm) {
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) { lang = 'nl'; showMessage(t('notFoundTitle'), t('notFoundText')); return Promise.resolve(); }
    return T.api('shop', { e: slug, code: code || '', preview: previewToken }).then(function (r) {
      var d = r.data || {};
      if (r.status === 404 || d.state === 'not_found') { showMessage(t('notFoundTitle'), t('notFoundText')); return; }
      if (!r.ok || (d.state !== 'open' && d.state !== 'offline')) { showMessage(t('errorTitle'), t('errorText'), true); return; }
      data = d;
      lang = d.shop && d.shop.lang === 'en' ? 'en' : 'nl';
      codeError = '';
      if (d.state === 'open') {
        if (code && d.discount) { activeCode = d.discount.code; $('code').value = ''; }
        else {
          activeCode = '';
          if (code && d.code_error) { codeError = t(d.code_error); if (!fromCodeForm) $('code').value = code; }
        }
      }
      renderAll();
      startPixel();
    }).catch(function () {
      if (data) { codeError = t('errNetwork'); renderSummary(); }
      else showMessage(t('errorTitle'), t('errorText'), true);
    });
  }

  function startPixel() {
    if (pixelOn || !data || data.state !== 'open' || data.preview || previewToken) return;
    if (T.pixel(data.shop && data.shop.pixel_id)) { pixelOn = true; T.track('PageView'); }
  }

  // ---------- kortingscode ----------
  $('code-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var code = $('code').value.trim();
    if (!code) { codeError = t('codeEmpty'); renderSummary(); $('code').focus(); return; }
    var btn = $('code-btn'); btn.disabled = true;
    load(code, true).then(function () { btn.disabled = false; });
  });
  $('code-remove').addEventListener('click', function () {
    load('').then(function () { try { $('code').focus(); } catch (e) {} });
  });

  // ---------- bestellen ----------
  function setErr(input, errEl, text) {
    if (errEl) errEl.textContent = text || '';
    if (input) { if (text) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
    return !text;
  }
  function validate() {
    var first = null, ok = true;
    function check(input, errEl, text) { if (!setErr(input, errEl, text)) { ok = false; first = first || input; } }
    var name = $('name').value.trim(), email = $('email').value.trim();
    check($('name'), $('name-err'), name.length < 2 ? t('errName') : '');
    check($('email'), $('email-err'), /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email) ? '' : t('errEmail'));
    Array.prototype.forEach.call($('fields').querySelectorAll('[data-key]'), function (n) {
      var empty = n.type === 'checkbox' ? !n.checked : !n.value.trim();
      check(n, $(n.id + '-err'), n.required && empty ? t('errRequired') : '');
    });
    if (!$('terms-wrap').hidden) check($('terms'), $('terms-err'), $('terms').checked ? '' : t('errTerms'));
    else setErr($('terms'), $('terms-err'), '');
    if (first) first.focus();
    return ok;
  }
  function clearErr(e) {
    var n = e.target;
    if (n && n.getAttribute && n.getAttribute('aria-invalid')) {
      n.removeAttribute('aria-invalid');
      var err = $(n.id + '-err'); if (err) err.textContent = '';
      if (!$('order-form').querySelector('[aria-invalid]')) $('order-msg').textContent = '';
    }
  }
  $('order-form').addEventListener('input', clearErr);
  $('order-form').addEventListener('change', clearErr);

  function goTo(url) {
    var link = $('fallback-link');
    link.href = url; link.textContent = t('continuePay');
    $('fallback').hidden = false;
    if (EMBED && window.top !== window) {
      try { window.top.location.href = url; return; } catch (e) { /* top-navigatie geblokkeerd */ }
      var w = null;
      try { w = window.open(url, '_blank'); } catch (e2) {}
      if (w) return;
    }
    location.href = url;
  }

  $('order-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy || !data) return;
    var msg = $('order-msg'); msg.textContent = '';
    $('fallback').hidden = true;
    if (!validate()) { msg.textContent = t('errForm'); return; }
    var tt = totals();
    if (!tt.units) return;
    var custom = {};
    Array.prototype.forEach.call($('fields').querySelectorAll('[data-key]'), function (n) {
      custom[n.getAttribute('data-key')] = n.type === 'checkbox' ? (n.checked ? 'ja' : '') : n.value.trim();
    });
    var items = (data.types || []).filter(function (tp) { return qty[tp.id] > 0; })
      .map(function (tp) { return { ticket_type_id: tp.id, qty: qty[tp.id] }; });
    var body = {
      slug: slug, items: items, name: $('name').value.trim(), email: $('email').value.trim(), locale: lang,
      custom: custom, source: EMBED ? 'embed' : 'shop', website: $('website').value,
      return_url: EMBED ? parentUrl : (T.linkUrl(data.shop && data.shop.website_url) || '')
    };
    if (previewToken) body.preview = previewToken;
    if (activeCode) body.code = activeCode;

    var btn = $('submit');
    busy = true; btn.disabled = true; btn.textContent = '';
    var sp = el('span', 'spinner'); sp.setAttribute('aria-hidden', 'true');
    btn.appendChild(sp); btn.appendChild(el('span', null, t('busy')));
    if (pixelOn) T.track('InitiateCheckout', { value: tt.total / 100, currency: 'EUR', num_items: tt.units });

    var done = function () { busy = false; renderSummary(); };
    T.api('order', {}, body).then(function (r) {
      var d = r.data || {};
      var url = T.linkUrl(d.checkout_url);
      if (r.ok && d.ok && url) { goTo(url); setTimeout(done, 6000); return; }
      msg.textContent = d.error || t('errGeneric');
      done();
      // voorraad of code kan veranderd zijn: shop verversen
      if (/sold_out|type_not_available|not_on_sale|max_per_order|min_per_order|code/.test(d.code || '')) load(activeCode);
    }).catch(function () { msg.textContent = t('errNetwork'); done(); });
  });

  // ---------- balk onderaan (mobiel, niet in een embed) ----------
  var formVisible = false;
  function updateSticky() {
    var bar = $('stickybar');
    bar.hidden = EMBED || !bar.dataset.has || formVisible || !data || data.state !== 'open';
  }
  $('sticky-btn').addEventListener('click', function () {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    $('checkout').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  });
  if ('IntersectionObserver' in window && !EMBED) {
    new IntersectionObserver(function (entries) {
      formVisible = entries[0].isIntersecting; updateSticky();
    }, { rootMargin: '0px 0px -120px 0px' }).observe($('checkout'));
  }

  // ---------- embed: hoogte melden aan de bovenliggende pagina ----------
  var lastHeight = 0;
  function reportHeight() {
    if (!EMBED || window.parent === window) return;
    var h = Math.ceil($('app').getBoundingClientRect().height);
    if (!h || h === lastHeight) return;
    lastHeight = h;
    try { window.parent.postMessage({ entreeShop: slug, height: h }, '*'); } catch (e) {}
  }
  if (EMBED) {
    if ('ResizeObserver' in window) new ResizeObserver(reportHeight).observe($('app'));
    else setInterval(reportHeight, 600);
    window.addEventListener('load', reportHeight);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { try { window.parent.postMessage({ entreeShop: slug, close: true }, '*'); } catch (e2) {} }
    });
  }

  // ---------- live voorbeeld vanuit het dashboard ----------
  window.addEventListener('message', function (e) {
    var p = e.data && e.data.entreePreview;
    if (!p || typeof p !== 'object' || e.origin !== location.origin || !data) return;
    if (!(data.preview === true || previewToken)) return;
    if (p.shop && typeof p.shop === 'object') data.shop = p.shop;
    if (p.event && typeof p.event === 'object') {
      ['name', 'location', 'starts_at', 'ends_at', 'description'].forEach(function (k) {
        if (k in p.event) data.event[k] = p.event[k];
      });
    }
    renderAll();
  });

  staticTexts();
  var startCode = (params.get('code') || '').trim().slice(0, 40);
  load(startCode);
})();

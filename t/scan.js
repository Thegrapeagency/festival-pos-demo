// Scanner voor deurpersoneel: t/scan.html?k=<scanlink-token>
(function () {
  'use strict';
  var T = window.EntreeT;
  var $ = function (id) { return document.getElementById(id); };
  var k = new URLSearchParams(location.search).get('k') || '';
  var reader = null, camOn = false, inFlight = false;
  var lastCode = '', lastAt = 0, resetTimer = null, audio = null;

  function showOnly(id) {
    $('loading').style.display = id === 'loading' ? 'grid' : 'none';
    $('badlink').hidden = id !== 'badlink';
    $('scanner').hidden = id !== 'scanner';
  }
  function badLink(title, text, retry) {
    // Nog geen huisstijl bekend (bijvoorbeeld bij een link die niet klopt): de standaardstijl van het platform.
    if (!document.documentElement.style.getPropertyValue('--e-primary')) window.EntreeBrand.apply({});
    if (title) $('bad-title').textContent = title;
    if (text) $('bad-text').textContent = text;
    $('bad-retry').hidden = !retry;
    stopCamera();
    showOnly('badlink');
  }

  function setInfo(d) {
    window.EntreeBrand.apply(d.brand || {});
    if (d.event) { $('event-name').textContent = d.event; document.title = 'Scanner | ' + d.event; }
    $('link-label').textContent = d.label || '';
    if (d.counts) $('count').textContent = (d.counts.checked_in || 0) + ' van ' + (d.counts.total || 0);
  }

  // ---------- signalen ----------
  function beep(kind) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio = audio || new AC();
      if (audio.state === 'suspended') audio.resume();
      var tones = kind === 'ok' ? [[880, 0, .12]] : kind === 'used' ? [[440, 0, .12], [440, .18, .12]] : [[220, 0, .35]];
      tones.forEach(function (tn) {
        var o = audio.createOscillator(), g = audio.createGain();
        o.type = kind === 'ok' ? 'sine' : 'square';
        o.frequency.value = tn[0];
        g.gain.setValueAtTime(.0001, audio.currentTime + tn[1]);
        g.gain.exponentialRampToValueAtTime(.25, audio.currentTime + tn[1] + .01);
        g.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + tn[1] + tn[2]);
        o.connect(g); g.connect(audio.destination);
        o.start(audio.currentTime + tn[1]); o.stop(audio.currentTime + tn[1] + tn[2] + .02);
      });
    } catch (e) {}
  }
  // iOS laat pas geluid toe na een tik: bij de eerste tik de audio klaarzetten.
  function unlockAudio() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio = audio || new AC();
      if (audio.state === 'suspended') audio.resume();
    } catch (e) {}
  }
  function buzz(kind) {
    try { if (navigator.vibrate) navigator.vibrate(kind === 'ok' ? [90] : kind === 'used' ? [90, 70, 90] : [300]); } catch (e) {}
  }

  // ---------- resultaat ----------
  function showResult(kind, title, main, sub, isTest) {
    var r = $('result');
    r.className = 'result ' + kind;
    $('r-title').textContent = title;
    $('r-main').textContent = main || '';
    $('r-sub').textContent = sub || '';
    $('r-test').hidden = !isTest;
    void r.offsetWidth; r.classList.add('pop');
    clearTimeout(resetTimer);
    if (kind !== 'idle' && kind !== 'busy') {
      beep(kind); buzz(kind);
      // Na een geldige scan snel klaar voor de volgende; een weigering blijft langer staan.
      resetTimer = setTimeout(function () {
        r.className = 'result idle';
        $('r-title').textContent = 'Klaar om te scannen';
        $('r-main').textContent = ''; $('r-sub').textContent = ''; $('r-test').hidden = true;
      }, kind === 'ok' ? 4000 : 9000);
    }
  }
  function usedText(iso) {
    if (!iso) return '';
    var today = T.day(new Date().toISOString(), 'nl'), tm = T.time(iso, 'nl');
    if (!tm) return '';
    return T.day(iso, 'nl') === today ? 'om ' + tm : 'op ' + T.shortMoment(iso, 'nl');
  }
  function join(a, b) { return [a, b].filter(Boolean).join(' · '); }

  function handle(raw, manual) {
    var code = String(raw || '').trim();
    if (!code || inFlight) return;
    var now = Date.now();
    // Dezelfde code binnen 3 seconden: de camera ziet het ticket nog, niet opnieuw scannen.
    if (code.toUpperCase() === lastCode && now - lastAt < 3000) return;
    lastCode = code.toUpperCase(); lastAt = now;
    inFlight = true;
    $('result').classList.add('busy');
    T.api('scan', {}, { k: k, code: code }).then(function (res) {
      var d = res.data || {};
      lastAt = Date.now();
      if (d.result === 'bad_link') { badLink(); return; }
      if (res.status === 429 || d.result === 'rate_limited') { showResult('bad', 'Even wachten', 'Te veel scans achter elkaar', 'Probeer het over een minuut opnieuw.'); return; }
      if (!res.ok) { showResult('bad', 'Storing', 'Scannen lukte niet', 'Probeer het opnieuw.'); lastCode = ''; return; }
      setInfo(d);
      if (d.result === 'ok') showResult('ok', 'Geldig', d.type || 'Ticket', join(d.valid_label, d.holder), d.is_test);
      else if (d.result === 'already_used') showResult('used', 'Al gescand', join(d.type, d.holder), usedText(d.used_at) ? 'Eerder binnen ' + usedText(d.used_at) : 'Dit ticket is al gebruikt', d.is_test);
      else if (d.result === 'void') showResult('bad', 'Ongeldig', join(d.type, d.holder), 'Dit ticket is ingetrokken of terugbetaald', d.is_test);
      else showResult('bad', 'Onbekend', 'Deze code hoort niet bij dit event', code.slice(0, 24));
      if (manual) { $('code').value = ''; }
    }).catch(function () {
      lastCode = '';
      showResult('bad', 'Geen verbinding', 'De scan is niet verwerkt', 'Controleer het internet en scan opnieuw.');
    }).then(function () { inFlight = false; $('result').classList.remove('busy'); });
  }

  // ---------- camera ----------
  function camMessage(text) { $('cam-msg').textContent = text; }
  function startCamera() {
    if (camOn) return;
    unlockAudio();
    if (typeof window.Html5Qrcode !== 'function') { camMessage('De camera werkt niet in deze browser. Typ de code hieronder.'); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      camMessage('Deze browser geeft geen toegang tot de camera. Open de scanlink in Safari of Chrome, of typ de code hieronder.');
      return;
    }
    var btn = $('start'); btn.disabled = true;
    camMessage('Camera starten');
    try { reader = reader || new window.Html5Qrcode('reader'); } catch (e) { btn.disabled = false; camMessage('De camera starten lukte niet. Typ de code hieronder.'); return; }
    reader.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: function (w, h) { var s = Math.floor(Math.min(w, h) * 0.72); return { width: s, height: s }; } },
      function (text) { handle(text, false); },
      function () {}
    ).then(function () {
      camOn = true; btn.disabled = false;
      $('camstart').hidden = true; $('stop').hidden = false;
      wake();
    }).catch(function (err) {
      btn.disabled = false; camOn = false;
      var s = String((err && (err.name || err.message)) || err || '');
      if (/NotAllowed|Permission|denied/i.test(s)) {
        camMessage('Je hebt de camera geweigerd. Sta de camera toe in de instellingen van je browser (het slotje in de adresbalk) en tik opnieuw op Start scannen. Je kunt ook de code typen.');
      } else if (/NotFound|Overconstrained|DevicesNotFound/i.test(s)) {
        camMessage('Er is geen camera gevonden op dit apparaat. Typ de code hieronder.');
      } else {
        camMessage('De camera starten lukte niet. Sluit andere apps die de camera gebruiken en probeer het opnieuw, of typ de code hieronder.');
      }
    });
  }
  function stopCamera() {
    if (!reader || !camOn) return;
    camOn = false;
    reader.stop().catch(function () {}).then(function () {
      try { reader.clear(); } catch (e) {}
      $('camstart').hidden = false; $('stop').hidden = true;
      camMessage('Tik om de camera te starten en richt hem op de QR-code van het ticket.');
    });
  }
  var lock = null;
  function wake() {
    try {
      if ('wakeLock' in navigator && camOn) navigator.wakeLock.request('screen').then(function (l) { lock = l; }).catch(function () {});
    } catch (e) {}
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { wake(); refresh(); }
  });

  $('start').addEventListener('click', startCamera);
  $('stop').addEventListener('click', stopCamera);
  $('manual').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('code').value.trim();
    if (!v) { $('code').focus(); return; }
    lastAt = 0; // handmatig controleren mag altijd direct
    unlockAudio();
    handle(v, true);
  });
  $('bad-retry').addEventListener('click', function () { showOnly('loading'); init(); });

  // ---------- starten en tellers bijhouden ----------
  function refresh() {
    if ($('scanner').hidden || inFlight) return;
    T.api('scan', {}, { k: k, code: '' }).then(function (res) {
      var d = res.data || {};
      if (d.result === 'bad_link') badLink();
      else if (res.ok) setInfo(d);
    }).catch(function () {});
  }
  function init() {
    if (!/^[0-9a-f]{32,80}$/.test(k)) { badLink(); return; }
    T.api('scan', {}, { k: k, code: '' }).then(function (res) {
      var d = res.data || {};
      if (d.result === 'bad_link' || res.status === 403) { badLink(); return; }
      if (!res.ok) { badLink('De scanner laden lukte niet', 'Probeer het over een minuut opnieuw.', true); return; }
      setInfo(d);
      showOnly('scanner');
    }).catch(function () {
      badLink('Geen verbinding', 'Controleer het internet en probeer het opnieuw.', true);
    });
  }
  setInterval(refresh, 20000);
  init();
})();

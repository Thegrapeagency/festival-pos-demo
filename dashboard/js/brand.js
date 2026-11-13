// Tab Huisstijl: instellingen links, live voorbeeld van de echte shop rechts.
import { rpc, upload } from './api.js';
import { h, icon, toast, guard, field, toggle, setError, notice, debounce } from './ui.js';
import { S, loadEvent, loadState, previewUrl } from './store.js';
import { analyseImage, analysePdf, prepareImage, contrastRatio } from './palette.js';

const EB = window.EntreeBrand;
const FONTS = (EB && EB.FONTS) || [];
const HEX = /^#[0-9a-f]{6}$/i;
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const hex = (v) => (HEX.test(v || '') ? v.toLowerCase() : '');

// Eén vaste vorm voor de huisstijl, zodat we concept en opgeslagen versie kunnen vergelijken.
function canon(s) {
  s = s || {}; const b = s.brand || {};
  return {
    brand: { primary: hex(b.primary), bg: hex(b.bg), surface: hex(b.surface), text: hex(b.text), font_heading: str(b.font_heading), font_body: str(b.font_body),
      radius: b.radius == null || b.radius === '' ? 14 : Math.max(0, Math.min(28, Number(b.radius) || 0)), logo_url: str(b.logo_url), cover_url: str(b.cover_url), layout: b.layout === 'cards' ? 'cards' : 'list' },
    intro: str(s.intro), ticket_note: str(s.ticket_note), terms_url: str(s.terms_url), website_url: str(s.website_url), contact_email: str(s.contact_email).toLowerCase(),
    pixel_id: str(s.pixel_id), lang: s.lang === 'en' ? 'en' : 'nl', show_remaining: s.show_remaining !== false,
  };
}
// Wat we naar de server (en het voorbeeld) sturen: lege waarden weglaten.
function payload(draft, fields) {
  const c = canon(draft), brand = {};
  for (const k of ['primary', 'bg', 'surface', 'text', 'font_heading', 'font_body', 'logo_url', 'cover_url']) if (c.brand[k]) brand[k] = c.brand[k];
  brand.radius = c.brand.radius; brand.layout = c.brand.layout;
  const out = { brand, lang: c.lang, show_remaining: c.show_remaining, fields: fields || [] };
  for (const k of ['intro', 'ticket_note', 'terms_url', 'website_url', 'contact_email', 'pixel_id']) if (c[k]) out[k] = c[k];
  return out;
}
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
export function brandDirty(id) { const d = S.brandDrafts.get(id); return !!(d && d.dirty); }
const withScheme = (u) => (u && !/^https?:\/\//i.test(u) ? 'https://' + u : u);

let fontCssLoaded = false;
function loadFontSamples() {
  if (fontCssLoaded || !FONTS.length) return;
  fontCssLoaded = true;
  const text = [...new Set((FONTS.join('') + 'Tickets voor zaterdag0123456789').replace(/\s/g, ''))].join('');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?' + FONTS.map((f) => 'family=' + encodeURIComponent(f).replace(/%20/g, '+')).join('&') + '&text=' + encodeURIComponent(text) + '&display=swap';
  document.head.append(link);
}
const fontStack = (name) => (name ? `"${name}", system-ui, sans-serif` : 'inherit');

let analysis = null;        // laatste resultaat van "huisstijl uit bestand", per event
let analysisFor = null;

export function tabBrand() {
  const e = S.ev.event;
  let server = S.ev.event.shop || {};
  let entry = S.brandDrafts.get(e.id);
  if (!entry || !entry.dirty) { entry = { shop: canon(server), dirty: false }; S.brandDrafts.set(e.id, entry); }
  const draft = entry.shop;
  if (analysisFor !== e.id) { analysis = null; analysisFor = e.id; }
  let device = window.innerWidth < 1180 ? 'mobile' : 'desktop';

  // ----- voorbeeld -----
  const iframe = h('iframe', { class: 'pv-iframe', title: 'Voorbeeld van je shop', src: previewUrl(e) + '&embed=1' });
  let synced = false;
  const post = () => {
    if (!iframe.contentWindow) return;
    try {
      iframe.contentWindow.postMessage({ entreePreview: { shop: payload(draft, (S.ev.event.shop || {}).fields), event: { name: e.name, location: e.location, starts_at: e.starts_at, description: e.description } } }, location.origin);
    } catch { /* het voorbeeld is nog niet geladen */ }
  };
  const postSoon = debounce(post, 90);
  iframe.addEventListener('load', () => { synced = false; [300, 1000, 2500].forEach((ms) => setTimeout(() => { if (iframe.isConnected) post(); }, ms)); });
  const onMsg = (ev) => {
    if (!iframe.isConnected) { window.removeEventListener('message', onMsg); return; }
    if (ev.source !== iframe.contentWindow || ev.origin !== location.origin || !ev.data || !ev.data.entreeShop) return;
    if (!synced) { synced = true; post(); } // de shop is klaar met laden: stuur het concept
  };
  window.addEventListener('message', onMsg);
  const frame = h('div', { class: 'pv-frame' + (device === 'mobile' ? ' is-mobile' : '') }, iframe);
  // Desktop tonen we op 1120 px breed en schalen we passend; mobiel op 390 px.
  const fit = () => {
    const w = frame.clientWidth, hgt = frame.clientHeight;
    if (!w || !hgt) return;
    const base = device === 'mobile' ? 390 : 1120;
    const sc = Math.min(1, w / base);
    iframe.style.width = base + 'px';
    iframe.style.height = Math.round(hgt / sc) + 'px';
    iframe.style.transform = `scale(${sc})`;
    iframe.style.left = Math.max(0, Math.round((w - base * sc) / 2)) + 'px';
  };
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(frame);
  else setTimeout(fit, 50);
  const devBtn = (key, label, ic) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(device === key), class: device === key ? 'is-on' : '', onclick: (ev) => {
    device = key; frame.classList.toggle('is-mobile', key === 'mobile'); fit();
    ev.currentTarget.parentNode.querySelectorAll('button').forEach((b) => { const on = b === ev.currentTarget; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', String(on)); });
  } }, icon(ic, 16), label);
  const preview = h('aside', { class: 'pv', 'aria-label': 'Live voorbeeld' },
    h('div', { class: 'pv-bar' }, h('strong', null, 'Live voorbeeld'),
      h('div', { class: 'seg seg-sm', role: 'radiogroup', 'aria-label': 'Schermformaat van het voorbeeld' }, devBtn('desktop', 'Desktop', 'desktop'), devBtn('mobile', 'Mobiel', 'mobile')),
      h('a', { class: 'icon-btn', href: previewUrl(e), target: '_blank', rel: 'noopener', 'aria-label': 'Voorbeeld openen in een nieuw tabblad', title: 'Openen in een nieuw tabblad' }, icon('external', 17))),
    frame,
    h('p', { class: 'hint pv-hint' }, 'Dit is je echte shop met je conceptwijzigingen. Kopers zien ze pas na Opslaan.'));

  // ----- opslaan -----
  const stateEl = h('span', { class: 'savebar-state' });
  const save = h('button', { class: 'btn btn-primary', type: 'button' }, 'Opslaan');
  const reset = h('button', { class: 'btn', type: 'button' }, 'Terugzetten');
  const bar = h('div', { class: 'savebar' }, stateEl, h('div', { class: 'row' }, reset, save));
  const warnEl = h('div', { 'aria-live': 'polite' });
  const left = h('div', { class: 'brand-left' });

  const resolved = () => (EB ? EB.apply(payload(draft, []).brand, document.createElement('div')) : { primary: '#efa36f', bg: '#faf5ec', surface: '#fffdf8', text: '#14323a' });
  function sync(repost = true) {
    entry.dirty = !same(draft, server);
    stateEl.textContent = entry.dirty ? 'Je hebt onopgeslagen wijzigingen' : 'Alles is opgeslagen';
    bar.classList.toggle('is-dirty', entry.dirty);
    save.disabled = !entry.dirty; reset.disabled = !entry.dirty;
    const tab = document.querySelector('.tabs .tab.is-on'); if (tab) tab.classList.toggle('has-dot', entry.dirty);
    if (EB) {
      const r = resolved();
      const cBg = contrastRatio(EB.luminance(r.text), EB.luminance(r.bg)), cSurf = contrastRatio(EB.luminance(r.text), EB.luminance(r.surface));
      const cPrim = contrastRatio(EB.luminance(r.primary), EB.luminance(r.bg));
      const fmt = (n) => n.toFixed(1).replace('.', ',');
      const msgs = [];
      if (cBg < 4.5) msgs.push(`De tekst is slecht leesbaar op de achtergrond (contrast ${fmt(cBg)}, minimaal 4,5). Kies een donkerdere tekstkleur of een lichtere achtergrond.`);
      else if (cSurf < 4.5) msgs.push(`De tekst is slecht leesbaar op de vlakken (contrast ${fmt(cSurf)}, minimaal 4,5). Pas de tekstkleur of de vlakkleur aan.`);
      if (cPrim < 1.5) msgs.push('Je primaire kleur valt bijna weg tegen de achtergrond. Knoppen zijn dan slecht te zien.');
      warnEl.replaceChildren(...msgs.map((m) => notice('warn', m)));
    }
    if (repost) postSoon();
  }

  // ----- bouwstenen -----
  function colorRow(key, label, hint) {
    const picker = h('input', { type: 'color', 'aria-label': `${label}: kleurkiezer` });
    const text = h('input', { type: 'text', class: 'mono', maxlength: '7', placeholder: 'Standaard', spellcheck: false });
    const clear = h('button', { class: 'icon-btn', type: 'button', 'aria-label': `${label} terug naar standaard`, title: 'Terug naar standaard' }, icon('undo', 16));
    const paint = () => { const v = draft.brand[key]; picker.value = v || resolved()[key]; if (document.activeElement !== text) text.value = v; clear.hidden = !v; };
    picker.addEventListener('input', () => { draft.brand[key] = picker.value.toLowerCase(); setError(text, ''); paint(); sync(); repaintColors(); });
    text.addEventListener('input', () => {
      let v = text.value.trim(); if (v && v[0] !== '#') v = '#' + v;
      if (/^#[0-9a-f]{3}$/i.test(v)) v = '#' + v.slice(1).split('').map((ch) => ch + ch).join('');
      if (HEX.test(v)) { draft.brand[key] = v.toLowerCase(); setError(text, ''); picker.value = v.toLowerCase(); clear.hidden = false; sync(); repaintColors(key); }
      else if (v === '') { draft.brand[key] = ''; setError(text, ''); sync(); repaintColors(key); }
      else setError(text, 'Typ een kleurcode zoals #1a2b3c.');
    });
    text.addEventListener('blur', () => { if (HEX.test(text.value.trim()) || text.value.trim() === '') { setError(text, ''); paint(); } });
    clear.addEventListener('click', () => { draft.brand[key] = ''; setError(text, ''); paint(); sync(); repaintColors(); });
    const node = field(label, text, { hint, wrap: (c) => h('div', { class: 'color-row' }, picker, c, clear) });
    node.paint = paint; node.key = key;
    return node;
  }
  let colorNodes = [];
  function repaintColors(skip) { colorNodes.forEach((n) => { if (n.key !== skip) n.paint(); }); }

  function fontPicker(key, label) {
    const cur = h('span', { class: 'font-cur' });
    const btn = h('button', { class: 'font-btn', type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false' }, cur, icon('down', 16));
    const list = h('div', { class: 'font-list', role: 'listbox', 'aria-label': label, hidden: true });
    const paint = () => { const v = draft.brand[key]; cur.textContent = v || 'Standaard'; cur.style.fontFamily = fontStack(v); };
    const close = () => { list.hidden = true; btn.setAttribute('aria-expanded', 'false'); document.removeEventListener('mousedown', outside); };
    const outside = (ev) => { if (!wrap.contains(ev.target)) close(); };
    const choose = (v) => { draft.brand[key] = v; paint(); close(); btn.focus(); sync(); };
    btn.addEventListener('click', () => {
      if (!list.hidden) return close();
      loadFontSamples();
      list.replaceChildren(...[''].concat(FONTS).map((f) => h('button', { type: 'button', role: 'option', 'aria-selected': String((draft.brand[key] || '') === f), class: 'font-opt' + ((draft.brand[key] || '') === f ? ' is-on' : ''), style: { 'font-family': fontStack(f) }, onclick: () => choose(f) },
        f || 'Standaard', f ? null : h('small', null, 'lettertype van het apparaat'))));
      list.hidden = false; btn.setAttribute('aria-expanded', 'true');
      document.addEventListener('mousedown', outside);
      const on = list.querySelector('.is-on'); if (on) { list.scrollTop = on.offsetTop - 80; on.focus(); }
    });
    const wrap = h('div', { class: 'font-pick', onkeydown: (ev) => {
      if (ev.key === 'Escape' && !list.hidden) { ev.stopPropagation(); close(); btn.focus(); }
      if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && !list.hidden) {
        ev.preventDefault();
        const opts = [...list.children]; const i = opts.indexOf(document.activeElement);
        const n = opts[Math.max(0, Math.min(opts.length - 1, i + (ev.key === 'ArrowDown' ? 1 : -1)))]; if (n) n.focus();
      }
    } }, btn, list);
    const id = 'font-' + key;
    btn.id = id;
    paint();
    return h('div', { class: 'field' }, h('label', { for: id }, label), wrap);
  }

  function uploader(key, label, opts) {
    const input = h('input', { type: 'file', accept: opts.accept, class: 'sr', 'aria-label': `${label} kiezen`, tabindex: '-1' });
    const pick = h('button', { class: 'btn btn-sm', type: 'button', onclick: () => input.click() }, icon('upload', 15), draft.brand[key] ? 'Vervangen' : 'Uploaden');
    const remove = draft.brand[key] ? h('button', { class: 'btn btn-sm btn-danger-ghost', type: 'button', onclick: () => { draft.brand[key] = ''; drawLeft(); sync(); } }, 'Verwijderen') : null;
    const thumb = h('div', { class: 'up-thumb up-' + key }, draft.brand[key] ? h('img', { src: draft.brand[key], alt: `Huidige ${label.toLowerCase()}` }) : icon('image', 22));
    input.addEventListener('change', async () => { const f = input.files[0]; input.value = ''; if (f) await doUpload(key, f, pick, opts); });
    return h('div', { class: 'up' }, thumb, h('div', { class: 'up-body' }, h('strong', null, label), h('p', { class: 'hint' }, opts.hint), h('div', { class: 'row' }, pick, remove, input)));
  }
  async function doUpload(key, file, btn, opts) {
    const ok = await guard(btn, async () => {
      let prep;
      try { prep = await prepareImage(file, { maxW: opts.maxW, allowSvg: opts.svg }); }
      catch (ex) {
        throw new Error(ex.message === 'too_big' ? 'Dit bestand is te groot. Kies een bestand tot 15 MB (SVG tot 1 MB).'
          : ex.message === 'no_svg' ? 'Kies voor de omslagfoto een JPG, PNG of WebP.' : 'Dit bestand kunnen we niet lezen. Kies een JPG, PNG, WebP of SVG.');
      }
      draft.brand[key] = await upload(S.state.org.id, `${key === 'logo_url' ? 'logo' : 'omslag'}-${Date.now().toString(36)}.${prep.ext}`, prep.blob, prep.mime);
      return true;
    });
    if (ok) { toast(key === 'logo_url' ? 'Logo geüpload. Klik op Opslaan om het te gebruiken.' : 'Omslagfoto geüpload. Klik op Opslaan om hem te gebruiken.'); drawLeft(); sync(); }
  }

  // ----- huisstijl uit bestand -----
  function extractor() {
    const input = h('input', { type: 'file', accept: 'image/*,application/pdf,.pdf,.svg', class: 'sr', 'aria-label': 'Logo of stijlgids kiezen', tabindex: '-1' });
    const status = h('div', { class: 'drop-status', 'aria-live': 'polite' });
    const zone = h('button', { class: 'drop', type: 'button', onclick: () => input.click() },
      h('span', { class: 'drop-ic' }, icon('sparkle', 24)),
      h('strong', null, 'Sleep hier je logo of stijlgids'),
      h('span', null, 'Afbeelding of pdf. We halen er je kleuren en lettertypes uit. Of klik om een bestand te kiezen.'));
    const run = async (file) => {
      if (!file) return;
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (!isPdf && !/^image\//.test(file.type) && !/\.(png|jpe?g|webp|gif|svg)$/i.test(file.name)) { status.replaceChildren(notice('warn', 'Dit bestand kunnen we niet gebruiken. Kies een afbeelding (JPG, PNG, WebP, SVG) of een pdf.')); return; }
      zone.disabled = true; zone.classList.add('is-busy');
      status.replaceChildren(h('p', { class: 'hint' }, isPdf ? 'Je pdf wordt gelezen. Dat duurt een paar seconden.' : 'Je afbeelding wordt gelezen.'));
      try {
        const r = isPdf ? await analysePdf(file, FONTS) : await analyseImage(file);
        if (!r.colors.length) throw new Error('unreadable');
        analysis = { ...r, name: file.name, file: isPdf ? null : file, selected: null };
        drawLeft();
        toast('We hebben een voorstel gemaakt. Bekijk het en pas het toe.');
      } catch (ex) {
        status.replaceChildren(notice('warn', ex.message === 'pdfjs_unavailable'
          ? 'De pdf-lezer kon niet geladen worden. Controleer je internetverbinding, of upload een afbeelding van je logo of stijlgids (bijvoorbeeld een schermafbeelding).'
          : isPdf ? 'Deze pdf kunnen we niet lezen. Probeer een andere pdf of upload een afbeelding.' : 'Deze afbeelding kunnen we niet lezen. Kies een JPG, PNG, WebP of SVG.'));
      } finally { zone.disabled = false; zone.classList.remove('is-busy'); }
    };
    input.addEventListener('change', () => { const f = input.files[0]; input.value = ''; run(f); });
    ['dragenter', 'dragover'].forEach((t) => zone.addEventListener(t, (ev) => { ev.preventDefault(); zone.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((t) => zone.addEventListener(t, (ev) => { ev.preventDefault(); zone.classList.remove('is-over'); }));
    zone.addEventListener('drop', (ev) => run(ev.dataTransfer && ev.dataTransfer.files[0]));

    let result = null;
    if (analysis) {
      const a = analysis, sug = a.suggestion;
      const setColor = (k, v) => { draft.brand[k] = v; drawLeft(); sync(); toast('Kleur overgenomen. Je ziet hem in het voorbeeld.'); };
      const roles = [['primary', 'Primair'], ['bg', 'Achtergrond'], ['surface', 'Vlak'], ['text', 'Tekst']];
      const chosen = h('div', { class: 'sw-actions', hidden: !a.selected });
      const paintChosen = () => {
        chosen.hidden = !a.selected;
        if (a.selected) chosen.replaceChildren(h('span', null, 'Gebruik ', h('span', { class: 'mono' }, a.selected), ' als'), ...roles.map(([k, l]) => h('button', { class: 'btn btn-sm', type: 'button', onclick: () => setColor(k, a.selected) }, l)));
      };
      const swatches = h('div', { class: 'swatches', role: 'group', 'aria-label': 'Gevonden kleuren' }, a.colors.map((c) => h('button', { class: 'swatch' + (a.selected === c.hex ? ' is-on' : ''), type: 'button', 'aria-pressed': String(a.selected === c.hex), 'aria-label': `Kleur ${c.hex}`, title: c.hex, style: { '--c': c.hex }, onclick: (ev) => {
        a.selected = a.selected === c.hex ? null : c.hex;
        swatches.querySelectorAll('.swatch').forEach((b) => { const on = b === ev.currentTarget && !!a.selected; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
        paintChosen();
      } }, h('span', { class: 'swatch-c' }), h('span', { class: 'swatch-hex mono' }, c.hex))));
      paintChosen();
      const f = a.fonts;
      const fontLine = f ? (f.heading || f.body
        ? h('p', { class: 'sug-fonts' }, icon('check', 15), h('span', null, 'Lettertypes gevonden: koppen in ', h('strong', { style: { 'font-family': fontStack(f.heading) } }, f.heading), ', tekst in ', h('strong', { style: { 'font-family': fontStack(f.body) } }, f.body), '.'))
        : h('p', { class: 'sug-fonts' }, icon('info', 15), h('span', null, f.other.length ? `In de pdf staat ${f.other.join(', ')}. Die bieden we niet aan. Kies hieronder een lettertype dat erop lijkt.` : 'We vonden geen lettertypes in deze pdf. Kies ze hieronder zelf.'))) : null;
      const apply = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => {
        Object.assign(draft.brand, { primary: sug.primary, bg: sug.bg, surface: sug.surface, text: sug.text });
        if (f && f.heading) draft.brand.font_heading = f.heading;
        if (f && f.body) draft.brand.font_body = f.body;
        loadFontSamples();
        drawLeft(); sync();
        toast('Voorstel toegepast. Bekijk het voorbeeld en klik op Opslaan als het klopt.');
      } }, icon('sparkle', 16), 'Pas voorstel toe');
      const asLogo = a.file ? h('button', { class: 'btn', type: 'button', onclick: (ev) => doUpload('logo_url', a.file, ev.currentTarget, { maxW: 800, svg: true }) }, icon('image', 16), 'Gebruik ook als logo') : null;
      const chip = (label, v) => h('div', { class: 'sug-chip' }, h('span', { class: 'sug-c', style: { '--c': v } }), h('div', null, h('small', null, label), h('span', { class: 'mono' }, v)));
      result = h('div', { class: 'sug' },
        h('div', { class: 'sug-head' }, a.thumb ? h('img', { class: 'sug-thumb', src: a.thumb, alt: '' }) : null,
          h('div', null, h('strong', null, 'Ons voorstel'), h('p', { class: 'hint' }, `Uit ${a.name}`))),
        sug ? h('div', { class: 'sug-chips' }, chip('Primair', sug.primary), chip('Achtergrond', sug.bg), chip('Tekst', sug.text)) : null,
        fontLine,
        h('div', { class: 'row wrap' }, apply, asLogo),
        h('p', { class: 'sug-sub' }, 'Liever zelf kiezen? Klik op een kleur uit je bestand.'),
        swatches, chosen);
    }
    return h('section', { class: 'card pad extract', ondragover: (ev) => ev.preventDefault() },
      h('h3', null, 'Haal je huisstijl uit een bestand'), zone, input, status, result);
  }

  function drawLeft() {
    const b = draft.brand;
    colorNodes = [colorRow('primary', 'Primaire kleur', 'Knoppen, links en accenten.'), colorRow('bg', 'Achtergrond', 'De kleur van de pagina.'), colorRow('surface', 'Vlakken', 'Kaarten en invoervelden.'), colorRow('text', 'Tekst', 'Koppen en lopende tekst.')];
    const radiusOut = h('output', { class: 'range-out' }, `${b.radius} px`);
    const radius = h('input', { type: 'range', min: '0', max: '28', step: '1', value: String(b.radius), oninput: () => { b.radius = Number(radius.value); radiusOut.textContent = `${b.radius} px`; sync(); } });
    const layout = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Weergave van de tickets' }, [['list', 'Lijst'], ['cards', 'Kaarten']].map(([k, l]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(b.layout === k), class: b.layout === k ? 'is-on' : '', onclick: (ev) => {
      b.layout = k; layout.querySelectorAll('button').forEach((x) => { const on = x === ev.currentTarget; x.classList.toggle('is-on', on); x.setAttribute('aria-checked', String(on)); }); sync();
    } }, l)));
    const txt = (key, el) => { el.value = draft[key] || ''; el.addEventListener('input', () => { draft[key] = el.value; setError(el, ''); sync(); }); return el; };
    const intro = txt('intro', h('textarea', { rows: '3', maxlength: '800' }));
    const note = txt('ticket_note', h('textarea', { rows: '3', maxlength: '500' }));
    const terms = txt('terms_url', h('input', { type: 'url', maxlength: '500', placeholder: 'https://jouwevent.nl/voorwaarden', 'data-k': 'terms_url' }));
    const site = txt('website_url', h('input', { type: 'url', maxlength: '500', placeholder: 'https://jouwevent.nl', 'data-k': 'website_url' }));
    const mail = txt('contact_email', h('input', { type: 'email', maxlength: '160', placeholder: 'tickets@jouwevent.nl', 'data-k': 'contact_email' }));
    const pixel = txt('pixel_id', h('input', { type: 'text', inputmode: 'numeric', maxlength: '20', placeholder: 'Bijvoorbeeld 1234567890123456', 'data-k': 'pixel_id' }));
    const lang = h('select', { value: draft.lang, onchange: () => { draft.lang = lang.value; sync(); } }, h('option', { value: 'nl' }, 'Nederlands'), h('option', { value: 'en' }, 'Engels'));
    const remaining = toggle('Toon het resterende aantal', draft.show_remaining, (on) => { draft.show_remaining = on; sync(); }, 'Kopers zien hoeveel tickets er nog zijn als het er weinig worden.');
    const sec = (title, ...kids) => h('section', { class: 'card pad' }, h('h3', null, title), kids);
    left.replaceChildren(
      extractor(),
      sec('Logo en omslagfoto',
        uploader('logo_url', 'Logo', { accept: 'image/png,image/jpeg,image/webp,image/svg+xml,.svg', maxW: 800, svg: true, hint: 'PNG met doorzichtige achtergrond of SVG werkt het mooist.' }),
        uploader('cover_url', 'Omslagfoto', { accept: 'image/png,image/jpeg,image/webp', maxW: 1600, svg: false, hint: 'Liggende foto bovenaan je shop. We verkleinen hem tot 1600 pixels breed.' })),
      sec('Kleuren', h('div', { class: 'grid2' }, colorNodes), warnEl),
      sec('Lettertypes', h('div', { class: 'grid2' }, fontPicker('font_heading', 'Koppen'), fontPicker('font_body', 'Tekst'))),
      sec('Vorm',
        field('Afronding van hoeken', radius, { wrap: (c) => h('div', { class: 'range-row' }, c, radiusOut) }),
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Weergave van de tickets'), layout)),
      sec('Teksten',
        field('Introtekst', intro, { optional: true, hint: 'Staat bovenaan de shop, onder de naam van je event.' }),
        field('Tekst op het ticket', note, { optional: true, hint: 'Praktische info op het ticket en in de mail, zoals openingstijden of de ingang.' })),
      sec('Links en contact',
        field('Link naar je voorwaarden', terms, { optional: true }),
        field('Link naar je website', site, { optional: true }),
        field('Contact-e-mail', mail, { optional: true, hint: 'Antwoorden op de ticketmail komen op dit adres binnen.' })),
      sec('Shop',
        field('Taal van de shop', lang),
        remaining,
        field('Meta Pixel ID', pixel, { optional: true, hint: 'Alleen cijfers. Daarmee meet je verkopen uit je advertenties op Facebook en Instagram.' })));
    colorNodes.forEach((n) => n.paint());
  }

  reset.onclick = () => { const clean = canon(server); Object.keys(clean).forEach((k) => { draft[k] = clean[k]; }); drawLeft(); sync(); toast('Wijzigingen teruggezet.'); };
  save.onclick = async () => {
    const c = canon(draft);
    const q = (k) => left.querySelector(`[data-k="${k}"]`);
    draft.terms_url = withScheme(c.terms_url); draft.website_url = withScheme(c.website_url);
    const urlOk = (u) => u === '' || (/^https?:\/\/[^\s"'<>]+\.[^\s"'<>]+$/.test(u) && u.length <= 500);
    const errs = [
      [q('terms_url'), urlOk(draft.terms_url) ? '' : 'Vul een volledige link in, zoals https://jouwevent.nl/voorwaarden.'],
      [q('website_url'), urlOk(draft.website_url) ? '' : 'Vul een volledige link in, zoals https://jouwevent.nl.'],
      [q('contact_email'), c.contact_email === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.contact_email) ? '' : 'Vul een geldig e-mailadres in of laat het veld leeg.'],
      [q('pixel_id'), c.pixel_id === '' || /^[0-9]{5,20}$/.test(c.pixel_id) ? '' : 'Een Pixel ID bestaat uit 5 tot 20 cijfers.'],
    ];
    let bad = null;
    for (const [el, msg] of errs) { if (!el) continue; if (el.dataset.k.endsWith('_url')) el.value = draft[el.dataset.k]; setError(el, msg); if (msg && !bad) bad = el; }
    if (bad) { bad.focus(); toast('Nog niet opgeslagen. Controleer de gemarkeerde velden.', 'err'); return; }
    const ok = await guard(save, async () => {
      // shop wordt in zijn geheel vervangen: de vragen van nu altijd meesturen
      const fresh = await rpc('entree_event_get', { event_id: e.id });
      await rpc('entree_event_save', { id: e.id, shop: payload(draft, (fresh.event.shop || {}).fields) });
      await loadEvent(e.id);
      loadState().catch(() => {});
      return true;
    });
    if (!ok) return;
    server = S.ev.event.shop || {};
    const saved = canon(server);
    Object.keys(draft).forEach((k) => { draft[k] = saved[k]; });
    drawLeft(); sync();
    toast('Huisstijl opgeslagen. Je shop is bijgewerkt.');
  };

  drawLeft(); sync(false);
  return h('div', { class: 'brand' }, h('div', { class: 'brand-col' }, h('div', { class: 'tab-head' }, h('div', null, h('h2', null, 'Huisstijl'), h('p', { class: 'muted' }, 'Zo ziet je shop, je ticket en je ticketmail eruit.'))), left, bar), preview);
}

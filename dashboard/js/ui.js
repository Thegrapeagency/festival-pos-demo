// Kleine bouwstenen: elementen maken, iconen, toasts, modals, opmaak.

// Elementen maken zonder innerHTML: tekst wordt altijd als tekst geplaatst.
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  let value;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'value') value = v;
      else if (k === 'style' && typeof v === 'object') { for (const [p, x] of Object.entries(v)) el.style.setProperty(p, x); }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (typeof v === 'boolean') { if (k in el) el[k] = v; else el.setAttribute(k, ''); }
      else el.setAttribute(k, v);
    }
  }
  add(el, kids);
  if (value !== undefined) el.value = value;
  return el;
}
function add(el, kids) {
  for (const k of kids) {
    if (k == null || k === false || k === true) continue;
    if (Array.isArray(k)) add(el, k);
    else el.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
}

const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2ZM13 5v2M13 17v2M13 11v2"/>',
  tag: '<path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l8.59-8.59a1 1 0 0 0 0-1.41ZM7 7h.01"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".6"/><circle cx="17.5" cy="10.5" r=".6"/><circle cx="8.5" cy="7.5" r=".6"/><circle cx="6.5" cy="12.5" r=".6"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.83-.44-1.12-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C22 6 17.5 2 12 2Z"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
  code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  desktop: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  mobile: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  card: '<rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/>',
  chart: '<path d="M3 3v18h18M7 16v-5M12 16V8M17 16v-9"/>',
  undo: '<path d="M3 7v6h6M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  sparkle: '<path d="m12 3 1.9 5.8L20 10.7l-6.1 1.9L12 18.4l-1.9-5.8L4 10.7l6.1-1.9ZM19 3v4M21 5h-4"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
};
// Iconen zijn vaste tekst uit deze file, nooit gegevens van de server.
export function icon(name, size = 18) {
  const t = document.createElement('template');
  t.innerHTML = `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  return t.content.firstChild;
}

// ---------- toasts ----------
export function toast(msg, type = 'ok') {
  const box = document.getElementById('toasts');
  const el = h('div', { class: 'toast toast-' + type, role: type === 'err' ? 'alert' : 'status' }, icon(type === 'err' ? 'alert' : 'check', 16), h('span', null, msg));
  box.append(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, type === 'err' ? 6500 : 3200);
}
export const toastErr = (e) => toast((e && e.message) || 'Er ging iets mis. Probeer het opnieuw.', 'err');

// Knop uitschakelen tijdens een verzoek; fouten netjes melden. Geeft undefined bij een fout.
export async function guard(btn, fn) {
  if (btn && btn.disabled) return undefined;
  if (btn) { btn.disabled = true; btn.classList.add('is-busy'); }
  try { return await fn(); }
  catch (e) { if (!e || e.code !== 'session') toastErr(e); return undefined; }
  finally {
    if (btn) {
      btn.disabled = false; btn.classList.remove('is-busy');
      // een uitgeschakelde knop verliest de focus; geef hem terug voor toetsenbordgebruikers
      if (btn.isConnected && (document.activeElement === document.body || !document.activeElement)) btn.focus({ preventScroll: true });
    }
  }
}

// ---------- modals ----------
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
let modalCount = 0;
export function openModal({ title, body, footer, side = false, wide = false, onClose }) {
  const prev = document.activeElement;
  const id = 'modal-title-' + (++modalCount);
  const closeBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Sluiten', onclick: () => close() }, icon('x'));
  const bodyEl = h('div', { class: 'modal-body' }, body);
  const footEl = footer ? h('div', { class: 'modal-foot' }, footer) : null;
  const panel = h('div', { class: 'modal' + (side ? ' modal-side' : '') + (wide ? ' modal-wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id },
    h('div', { class: 'modal-head' }, h('h2', { id }, title), closeBtn), bodyEl, footEl);
  const back = h('div', { class: 'modal-back' + (side ? ' is-side' : '') }, panel);
  let down = null;
  back.addEventListener('mousedown', (e) => { down = e.target; });
  back.addEventListener('click', (e) => { if (e.target === back && down === back) close(); });
  // Escape op documentniveau: ook als de focus even weg is (bijvoorbeeld na een uitgeschakelde knop).
  const onKey = (e) => {
    const all = document.querySelectorAll('.modal-back');
    if (all[all.length - 1] !== back) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === 'Tab' && !panel.contains(document.activeElement)) { e.preventDefault(); closeBtn.focus(); return; }
    if (e.key === 'Tab') {
      const f = [...panel.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener('keydown', onKey, true);
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    back.remove();
    if (!document.querySelector('.modal-back')) document.body.classList.remove('has-modal');
    if (prev && prev.isConnected) prev.focus();
    if (onClose) onClose();
  }
  document.body.append(back);
  document.body.classList.add('has-modal');
  const first = bodyEl.querySelector('input:not([type=hidden]):not([type=checkbox]),select,textarea');
  (first || closeBtn).focus();
  return { close, panel, body: bodyEl, setBody: (n) => bodyEl.replaceChildren(n), setFooter: (n) => footEl && footEl.replaceChildren(...[].concat(n)) };
}

export function confirmDialog({ title, text, confirmLabel = 'Bevestigen', cancelLabel = 'Annuleren', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const ok = h('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), type: 'button', onclick: () => { result = true; m.close(); } }, confirmLabel);
    const cancel = h('button', { class: 'btn', type: 'button', onclick: () => m.close() }, cancelLabel);
    const m = openModal({ title, body: h('div', { class: 'confirm-text' }, [].concat(text).map((t) => (typeof t === 'string' ? h('p', null, t) : t))), footer: [cancel, ok], onClose: () => resolve(result) });
    ok.focus();
  });
}

// ---------- formulieren ----------
let fieldCount = 0;
// Label + invoer + uitleg. `control` is een input, select of textarea.
export function field(label, control, opts = {}) {
  const id = control.id || 'f' + (++fieldCount);
  control.id = id;
  const hint = opts.hint ? h('p', { class: 'hint', id: id + '-h' }, opts.hint) : null;
  if (hint) control.setAttribute('aria-describedby', id + '-h');
  return h('div', { class: 'field' + (opts.class ? ' ' + opts.class : '') },
    h('label', { for: id }, label, opts.optional ? h('span', { class: 'opt' }, ' optioneel') : null), opts.wrap ? opts.wrap(control) : control, hint);
}
export function toggle(label, checked, onchange, hint) {
  const input = h('input', { type: 'checkbox', checked: !!checked, onchange: () => onchange && onchange(input.checked) });
  const el = h('label', { class: 'switch' }, input, h('span', { class: 'switch-track', 'aria-hidden': 'true' }),
    h('span', { class: 'switch-text' }, h('span', null, label), hint ? h('small', null, hint) : null));
  el.input = input;
  return el;
}
export function setError(control, msg) {
  const f = control.closest('.field');
  if (!f) return;
  let e = f.querySelector('.error');
  if (!msg) { if (e) e.remove(); control.removeAttribute('aria-invalid'); return; }
  if (!e) { e = h('p', { class: 'error', role: 'alert' }); f.append(e); }
  e.textContent = msg;
  control.setAttribute('aria-invalid', 'true');
}
export function badge(text, kind = '') { return h('span', { class: 'badge' + (kind ? ' badge-' + kind : '') }, text); }
export function notice(kind, ...kids) {
  return h('div', { class: 'notice notice-' + kind }, icon(kind === 'warn' || kind === 'danger' ? 'alert' : kind === 'ok' ? 'check' : 'info', 18), h('div', null, kids));
}
export function empty(iconName, title, text, action) {
  return h('div', { class: 'empty' }, h('div', { class: 'empty-ic' }, icon(iconName, 26)), h('h3', null, title), h('p', null, text), action || null);
}
export function spinner(label = 'Laden') {
  return h('div', { class: 'loading', role: 'status' }, h('span', { class: 'spinner' }), h('span', null, label));
}

// ---------- opmaak ----------
export const euro = (cents) => '€ ' + ((Number(cents) || 0) / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const euroShort = (cents) => (cents % 100 === 0 ? '€ ' + (cents / 100).toLocaleString('nl-NL') : euro(cents));
export const centsToInput = (c) => ((Number(c) || 0) / 100).toFixed(2).replace('.', ',');
// "12,50", "€ 1.250,00" of "12.5" naar centen. Ongeldig = NaN.
export function parseEuro(s) {
  let t = String(s == null ? '' : s).replace(/[€\s]/g, '');
  if (t === '') return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
  return Math.round(parseFloat(t) * 100);
}
export const num = (n) => (Number(n) || 0).toLocaleString('nl-NL');
// Leeg veld = null, anders een geheel getal (NaN bij onzin).
export function intOrNull(v) {
  const t = String(v == null ? '' : v).trim();
  if (t === '') return null;
  return /^\d+$/.test(t) ? parseInt(t, 10) : NaN;
}
const pad = (n) => String(n).padStart(2, '0');
export function fmtDate(iso, time = true) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const o = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
  if (time) { o.hour = '2-digit'; o.minute = '2-digit'; }
  return d.toLocaleString('nl-NL', o);
}
export function fmtShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
// ISO naar de waarde van een datetime-local veld (lokale tijd).
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// Waarde van een datetime-local veld naar ISO met tijdzone-offset; leeg = null.
export function fromLocalInput(v) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d)) return null;
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

// ---------- kopiëren, downloaden, QR ----------
export async function copyText(text, label = 'Gekopieerd') {
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
    else throw new Error('geen klembord');
  } catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0', top: '0' } });
    ta.value = text; document.body.append(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    if (!ok) { toast('Kopiëren lukte niet. Selecteer de tekst en kopieer hem zelf.', 'err'); return false; }
  }
  toast(label);
  return true;
}
export function copyRow(label, value, opts = {}) {
  const input = h('input', { type: 'text', readonly: true, value, class: 'mono', onfocus: () => input.select() });
  const btn = h('button', { class: 'btn', type: 'button', onclick: async () => { if (await copyText(value, opts.toast || 'Gekopieerd')) { if (opts.onCopy) opts.onCopy(); } } }, icon('copy', 16), 'Kopieer');
  return field(label, input, { hint: opts.hint, wrap: (c) => h('div', { class: 'copy-row' }, c, btn, opts.extra || null) });
}
export function download(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function qrSvgString(text, cell = 4) {
  const q = window.qrcode(0, 'M');
  q.addData(text); q.make();
  return q.createSvgTag({ cellSize: cell, margin: 2, scalable: true });
}
// De QR-bibliotheek maakt de SVG uit onze eigen link; er zit geen vrije tekst in.
export function qrNode(text, size = 160) {
  const box = h('div', { class: 'qr', role: 'img', 'aria-label': 'QR-code', style: { width: size + 'px', height: size + 'px' } });
  try { box.innerHTML = qrSvgString(text); } catch { box.textContent = 'QR-code maken lukte niet.'; }
  return box;
}
export function qrDownloadSvg(text, filename) {
  let svg = qrSvgString(text, 8);
  if (!/xmlns=/.test(svg)) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  download(filename, new Blob([svg], { type: 'image/svg+xml' }));
}
export function qrDownloadPng(text, filename, px = 1024) {
  let svg = qrSvgString(text, 8);
  if (!/xmlns=/.test(svg)) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = px; c.height = px;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, px, px); ctx.imageSmoothingEnabled = false; ctx.drawImage(img, 0, 0, px, px);
    c.toBlob((b) => b && download(filename, b), 'image/png');
  };
  img.onerror = () => toast('De PNG maken lukte niet. Download de SVG.', 'err');
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

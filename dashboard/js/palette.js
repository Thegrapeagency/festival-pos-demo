// Huisstijl uit een bestand halen: kleurpalet uit een afbeelding of pdf,
// lettertypes uit een pdf. Alles gebeurt in de browser; er wordt niets verstuurd.

const PDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';

const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s: Math.min(1, s), l };
}
function lum(r, g, b) {
  const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrastRatio(l1, l2) { const a = Math.max(l1, l2), b = Math.min(l1, l2); return (a + 0.05) / (b + 0.05); }

export function newAcc() { return { buckets: new Map(), total: 0 }; }
// Pixels tellen in vakjes van 8x8x8 (5 bits per kanaal). Doorzichtige pixels tellen niet mee.
export function addPixels(acc, data) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let x = acc.buckets.get(key);
    if (!x) { x = [0, 0, 0, 0]; acc.buckets.set(key, x); }
    x[0]++; x[1] += r; x[2] += g; x[3] += b;
    acc.total++;
  }
}

// Vakjes samenvoegen tot een handvol kleuren en daar een voorstel uit maken.
export function buildPalette(acc) {
  if (!acc.total) return { colors: [], suggestion: null };
  const sorted = [...acc.buckets.values()].sort((a, b) => b[0] - a[0]);
  const clusters = [];
  for (const [n, sr, sg, sb] of sorted) {
    const r = sr / n, g = sg / n, b = sb / n;
    let best = null, bestD = Infinity;
    for (const c of clusters) {
      const d = Math.hypot(c.r - r, c.g - g, c.b - b);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best && (bestD < 36 || clusters.length >= 28)) {
      // het zwaartepunt blijft bij de grootste groep, zodat randjes de kleur niet vervagen
      best.n += n;
    } else clusters.push({ r, g, b, n });
  }
  let colors = clusters.map((c) => {
    const { s, l } = hsl(c.r, c.g, c.b);
    const kind = l > 0.93 && (s < 0.3 || l > 0.97) ? 'white' : l < 0.1 || (l < 0.17 && s < 0.35) ? 'black' : s < 0.13 ? 'grey' : 'color';
    return { hex: toHex(c.r, c.g, c.b), share: c.n / acc.total, s, l, lum: lum(c.r, c.g, c.b), kind };
  });
  const strong = colors.filter((c) => c.share >= 0.004);
  if (strong.length >= 2) colors = strong;
  colors.sort((a, b) => b.share - a.share);

  // aandeel zonder de (bijna) witte achtergrond, zodat een logo op wit goed werkt
  const inkTotal = colors.filter((c) => c.kind !== 'white').reduce((t, c) => t + c.share, 0) || 1;
  const ink = (c) => c.share / inkTotal;
  const chroma = colors.filter((c) => c.kind === 'color' && ink(c) >= 0.03);
  const score = (c) => c.s * (0.45 + 0.55 * Math.min(1, ink(c) * 4)) * (c.l > 0.8 ? 0.45 : c.l < 0.2 ? 0.7 : 1);
  let primary = chroma.sort((a, b) => score(b) - score(a))[0];
  const darkest = colors.filter((c) => c.kind !== 'white').sort((a, b) => a.lum - b.lum)[0];
  if (!primary) primary = darkest;
  const tint = colors.filter((c) => c.l >= 0.88 && c.l <= 0.975 && c.hex !== '#ffffff' && c.share >= 0.08 && (!primary || c.hex !== primary.hex)).sort((a, b) => b.share - a.share)[0];
  const bg = tint ? tint.hex : '#ffffff';
  const bgLum = tint ? tint.lum : 1;
  const textPick = colors.filter((c) => c.share >= 0.004 && contrastRatio(c.lum, bgLum) >= 7).sort((a, b) => a.lum - b.lum)[0];
  const suggestion = primary ? { primary: primary.hex, bg, surface: '#ffffff', text: textPick ? textPick.hex : '#1f1f1f' } : null;

  // stalen: de grootste kleuren, met het voorstel er zeker bij
  const picked = [];
  const push = (hex) => { if (hex && !picked.includes(hex)) picked.push(hex); };
  if (suggestion) { push(suggestion.primary); }
  colors.filter((c) => c.kind === 'color').forEach((c) => push(c.hex));
  colors.filter((c) => c.kind !== 'color').forEach((c) => push(c.hex));
  if (suggestion) { push(suggestion.text); push(suggestion.bg); }
  const byHex = new Map(colors.map((c) => [c.hex, c]));
  const swatches = picked.slice(0, 9).map((hex) => byHex.get(hex) || { hex, share: 0, kind: 'color' });
  return { colors: swatches, suggestion };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
    img.src = url;
  });
}

export async function analyseImage(file) {
  const { img, url } = await loadImage(file);
  const w0 = img.naturalWidth || 300, h0 = img.naturalHeight || 300;
  const scale = Math.min(1, 220 / Math.max(w0, h0));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w0 * scale)); c.height = Math.max(1, Math.round(h0 * scale));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const acc = newAcc();
  addPixels(acc, ctx.getImageData(0, 0, c.width, c.height).data);
  return { ...buildPalette(acc), fonts: null, thumb: url, kind: 'image' };
}

// ---------- pdf ----------
let pdfLoading = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!pdfLoading) {
    pdfLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      const fail = () => { clearTimeout(timer); s.remove(); pdfLoading = null; reject(new Error('pdfjs_unavailable')); };
      const timer = setTimeout(fail, 15000);
      s.src = PDF_CDN + 'pdf.min.js';
      s.onload = () => {
        clearTimeout(timer);
        if (!window.pdfjsLib) return fail();
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_CDN + 'pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      s.onerror = fail;
      document.head.append(s);
    });
  }
  return pdfLoading;
}

const ALIAS = { sourcesanspro: 'Source Sans 3', sourcesans: 'Source Sans 3', garamond: 'EB Garamond', baskerville: 'Libre Baskerville', bodoni: 'Bodoni Moda', playfair: 'Playfair Display', jakarta: 'Plus Jakarta Sans', plexsans: 'IBM Plex Sans' };
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
// "ABCDEF+Montserrat-Bold" wordt Montserrat, als dat in de lijst staat.
export function matchFont(raw, fonts) {
  const n = norm(String(raw).replace(/^[A-Z]{6}\+/, ''));
  let best = null, len = 0;
  for (const f of fonts) { const k = norm(f); if (n.startsWith(k) && k.length > len) { best = f; len = k.length; } }
  if (!best) for (const [k, f] of Object.entries(ALIAS)) { if (n.includes(k) && fonts.includes(f)) { best = f; break; } }
  return best;
}
export function prettyFont(raw) {
  return String(raw).replace(/^[A-Z]{6}\+/, '').split(/[-,]/)[0].replace(/(MT|PS|Std|Pro)$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
}

export async function analysePdf(file, fontList) {
  const lib = await loadPdfJs();
  let doc;
  try { doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; }
  catch { throw new Error('unreadable'); }
  const acc = newAcc();
  const seen = new Map();
  let thumb = null;
  const pages = Math.min(3, doc.numPages);
  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const base = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: Math.min(1.5, 360 / base.width) });
    const c = document.createElement('canvas');
    c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    addPixels(acc, ctx.getImageData(0, 0, c.width, c.height).data);
    if (p === 1) thumb = c.toDataURL('image/png');
    try {
      const tc = await page.getTextContent();
      for (const item of tc.items) {
        if (!item.str || !item.str.trim()) continue;
        let name = null;
        try { const f = page.commonObjs.get(item.fontName); name = f && f.name; } catch { name = null; }
        if (!name && tc.styles && tc.styles[item.fontName]) name = tc.styles[item.fontName].fontFamily;
        if (!name || /^(sans-serif|serif|monospace)$/i.test(name)) continue;
        const size = Math.abs(item.transform ? item.transform[3] : 0) || item.height || 0;
        const rec = seen.get(name) || { chars: 0, sum: 0 };
        rec.chars += item.str.length; rec.sum += size * item.str.length;
        seen.set(name, rec);
      }
    } catch { /* geen tekstlaag: dan alleen kleuren */ }
  }
  // per lettertype uit onze lijst: hoeveel tekst en hoe groot gemiddeld
  const matched = new Map(), other = new Set();
  for (const [raw, rec] of seen) {
    const m = matchFont(raw, fontList);
    if (m) { const x = matched.get(m) || { chars: 0, sum: 0 }; x.chars += rec.chars; x.sum += rec.sum; matched.set(m, x); }
    else { const pretty = prettyFont(raw); if (pretty) other.add(pretty); }
  }
  const list = [...matched.entries()].map(([name, x]) => ({ name, chars: x.chars, size: x.sum / Math.max(1, x.chars) }));
  let fonts = { heading: null, body: null, other: [...other].slice(0, 6), found: list.map((x) => x.name) };
  if (list.length) {
    const body = list.slice().sort((a, b) => b.chars - a.chars)[0];
    const heading = list.filter((x) => x.chars >= 3).sort((a, b) => b.size - a.size)[0] || body;
    fonts = { ...fonts, heading: heading.name, body: body.name };
  }
  try { doc.destroy(); } catch { /* niets */ }
  return { ...buildPalette(acc), fonts, thumb, kind: 'pdf' };
}

// ---------- afbeeldingen klaarzetten voor upload ----------
// Verkleint tot maxW breed. Houdt PNG aan bij transparantie, anders JPEG (of WebP als de bron WebP was).
export async function prepareImage(file, { maxW, allowSvg }) {
  if (file.size > 15 * 1024 * 1024) throw new Error('too_big');
  const type = (file.type || '').toLowerCase();
  if (type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
    if (!allowSvg) throw new Error('no_svg');
    if (file.size > 1024 * 1024) throw new Error('too_big');
    return { blob: file, mime: 'image/svg+xml', ext: 'svg' };
  }
  const { img, url } = await loadImage(file);
  try {
    const w0 = img.naturalWidth, h0 = img.naturalHeight;
    if (!w0 || !h0) throw new Error('unreadable');
    const plain = ['image/jpeg', 'image/png', 'image/webp'].includes(type);
    if (plain && w0 <= maxW && file.size <= 1.5 * 1024 * 1024) return { blob: file, mime: type, ext: type === 'image/jpeg' ? 'jpg' : type.slice(6) };
    const scale = Math.min(1, maxW / w0);
    const c = document.createElement('canvas');
    c.width = Math.round(w0 * scale); c.height = Math.round(h0 * scale);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, c.width, c.height);
    let alpha = false;
    if (type !== 'image/jpeg') {
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 4 * 7) { if (d[i] < 250) { alpha = true; break; } }
    }
    const want = alpha ? 'image/png' : type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise((res) => c.toBlob(res, want, 0.86));
    if (!blob) throw new Error('unreadable');
    const mime = blob.type || want;
    return { blob, mime, ext: mime === 'image/jpeg' ? 'jpg' : mime.slice(6) };
  } finally { URL.revokeObjectURL(url); }
}

/* Entree embed: zet de ticketshop op je eigen site.
 *
 *   Inline:  <div data-entree-shop="SLUG"></div>
 *   Knop:    <button data-entree-button="SLUG">Tickets</button>
 *            <script async src="https://.../embed.js"></script>
 *
 * Optioneel data-code="KORTINGSCODE". utm_*-parameters en ?code= van je pagina
 * gaan vanzelf mee. Voeg je later elementen toe, roep dan window.Entree.scan() aan.
 */
(function () {
  'use strict';
  if (window.Entree && window.Entree.__embed) { window.Entree.scan(); return; }

  var doc = document;
  var frames = [];   // { iframe, slug, modal }
  var modal = null;  // open overlay
  var SLUG = /^[a-z0-9-]{1,80}$/;

  // Basisadres = de map waar dit script staat.
  function findBase() {
    var src = '';
    var cur = doc.currentScript;
    if (cur && cur.src) src = cur.src;
    if (!src) {
      var all = doc.querySelectorAll('script[src*="embed.js"]');
      if (all.length) src = all[all.length - 1].src;
    }
    src = src.replace(/[?#].*$/, '');
    return src.replace(/\/[^\/]*$/, '');
  }
  var BASE = findBase();

  function pageParams() {
    var out = [], code = '';
    var q = (window.location.search || '').replace(/^\?/, '').split('&');
    for (var i = 0; i < q.length; i++) {
      var p = q[i].split('=');
      var key = p[0], val = p.slice(1).join('=');
      if (!key || !val) continue;
      if (/^utm_[a-z_]{1,20}$/.test(key)) out.push(key + '=' + val);
      if (key === 'code') { try { code = decodeURIComponent(val.replace(/\+/g, ' ')); } catch (e) { code = ''; } }
    }
    return { utm: out, code: code };
  }
  function parentUrl() {
    var href = String(window.location.href).replace(/#.*$/, '');
    if (href.length > 500) href = window.location.origin + window.location.pathname;
    return href.length > 500 ? '' : href;
  }
  function shopUrl(slug, code) {
    var pp = pageParams();
    var url = BASE + '/t/?e=' + encodeURIComponent(slug) + '&embed=1&parent=' + encodeURIComponent(parentUrl());
    code = code || pp.code;
    if (code) url += '&code=' + encodeURIComponent(String(code).slice(0, 40));
    if (pp.utm.length) url += '&' + pp.utm.join('&');
    return url;
  }
  function makeFrame(slug, code, title) {
    var f = doc.createElement('iframe');
    f.src = shopUrl(slug, code);
    f.title = title || 'Tickets';
    f.setAttribute('allow', 'payment');
    f.setAttribute('scrolling', 'auto');
    f.setAttribute('frameborder', '0');
    f.style.cssText = 'display:block;width:100%;min-width:100%;max-width:100%;border:0;margin:0;padding:0;background:transparent;color-scheme:normal;height:420px;';
    return f;
  }

  // ---------- inline ----------
  function mountInline(node) {
    if (node.getAttribute('data-entree-ready')) return;
    var slug = (node.getAttribute('data-entree-shop') || '').replace(/^\s+|\s+$/g, '');
    if (!SLUG.test(slug)) return;
    node.setAttribute('data-entree-ready', '1');
    var f = makeFrame(slug, node.getAttribute('data-code'), node.getAttribute('data-title'));
    while (node.firstChild) node.removeChild(node.firstChild);
    node.appendChild(f);
    frames.push({ iframe: f, slug: slug, modal: false });
  }

  // ---------- knop met overlay ----------
  function prepButton(node) {
    if (node.getAttribute('data-entree-ready')) return;
    node.setAttribute('data-entree-ready', '1');
    var tag = node.tagName;
    if (tag !== 'BUTTON' && tag !== 'A' && tag !== 'INPUT') {
      if (!node.getAttribute('role')) node.setAttribute('role', 'button');
      if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '0');
    }
    node.setAttribute('aria-haspopup', 'dialog');
  }
  function trigger(target) {
    var n = target;
    while (n && n !== doc && n.nodeType === 1) {
      if (n.hasAttribute('data-entree-button')) return n;
      n = n.parentNode;
    }
    return null;
  }
  function fitModal() {
    if (!modal) return;
    var room = Math.max(240, (window.innerHeight || doc.documentElement.clientHeight) - 76);
    modal.iframe.style.height = Math.min(modal.wanted || room, room) + 'px';
  }
  function openModal(slug, code, opener) {
    if (!SLUG.test(slug)) return;
    if (modal) closeModal();
    var back = doc.createElement('div');
    back.setAttribute('data-entree-overlay', '');
    back.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483000;background:rgba(17,17,17,.62);display:flex;align-items:flex-start;justify-content:center;' +
      'padding:8px;box-sizing:border-box;overflow:auto;-webkit-overflow-scrolling:touch;opacity:0;transition:opacity .18s ease;';
    var box = doc.createElement('div');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Tickets');
    box.style.cssText = 'position:relative;width:100%;max-width:640px;margin:auto;box-sizing:border-box;';
    var bar = doc.createElement('div');
    bar.style.cssText = 'display:flex;justify-content:flex-end;padding:0 0 8px;margin:0;';
    var close = doc.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Sluiten');
    close.setAttribute('data-entree-close', '');
    close.style.cssText = 'all:initial;box-sizing:border-box;cursor:pointer;width:44px;height:44px;border-radius:50%;background:#ffffff;color:#111111;' +
      'display:flex;align-items:center;justify-content:center;font:400 26px/1 Arial,Helvetica,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.3);';
    close.appendChild(doc.createTextNode('×'));
    close.onfocus = function () { close.style.outline = '3px solid #ffffff'; close.style.outlineOffset = '2px'; };
    close.onblur = function () { close.style.outline = 'none'; };
    var guard = function (to) {
      var g = doc.createElement('div');
      g.tabIndex = 0;
      g.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;';
      g.onfocus = function () { try { to().focus(); } catch (e) {} };
      return g;
    };
    var f = makeFrame(slug, code, 'Tickets');
    f.style.borderRadius = '0';
    bar.appendChild(close);
    box.appendChild(guard(function () { return f; }));
    box.appendChild(bar);
    box.appendChild(f);
    box.appendChild(guard(function () { return close; }));
    back.appendChild(box);

    var root = doc.documentElement;
    modal = { back: back, iframe: f, slug: slug, opener: opener || null, wanted: 0,
      overflow: root.style.overflow, bodyOverflow: doc.body.style.overflow, entry: { iframe: f, slug: slug, modal: true } };
    frames.push(modal.entry);
    root.style.overflow = 'hidden';
    doc.body.style.overflow = 'hidden';
    doc.body.appendChild(back);
    fitModal();
    close.onclick = closeModal;
    back.addEventListener('mousedown', function (e) { if (e.target === back) closeModal(); });
    setTimeout(function () { back.style.opacity = '1'; try { close.focus(); } catch (e) {} }, 10);
  }
  function closeModal() {
    if (!modal) return;
    var m = modal; modal = null;
    for (var i = frames.length - 1; i >= 0; i--) if (frames[i] === m.entry) frames.splice(i, 1);
    if (m.back.parentNode) m.back.parentNode.removeChild(m.back);
    doc.documentElement.style.overflow = m.overflow;
    doc.body.style.overflow = m.bodyOverflow;
    if (m.opener && m.opener.focus) { try { m.opener.focus(); } catch (e) {} }
  }

  // ---------- gebeurtenissen ----------
  doc.addEventListener('click', function (e) {
    var n = trigger(e.target);
    if (!n) return;
    e.preventDefault();
    openModal((n.getAttribute('data-entree-button') || '').replace(/^\s+|\s+$/g, ''), n.getAttribute('data-code'), n);
  });
  doc.addEventListener('keydown', function (e) {
    var key = e.key || e.keyCode;
    if (modal && (key === 'Escape' || key === 'Esc' || key === 27)) { closeModal(); return; }
    if (key === 'Enter' || key === ' ' || key === 'Spacebar' || key === 13 || key === 32) {
      var n = e.target;
      if (n && n.nodeType === 1 && n.hasAttribute('data-entree-button') && n.tagName !== 'BUTTON' && n.tagName !== 'A' && n.tagName !== 'INPUT') {
        e.preventDefault();
        openModal((n.getAttribute('data-entree-button') || '').replace(/^\s+|\s+$/g, ''), n.getAttribute('data-code'), n);
      }
    }
  });
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || typeof d !== 'object' || typeof d.entreeShop !== 'string') return;
    for (var i = 0; i < frames.length; i++) {
      var fr = frames[i];
      if (e.source !== fr.iframe.contentWindow || d.entreeShop !== fr.slug) continue;
      if (typeof d.height === 'number' && d.height > 0 && d.height < 30000) {
        var h = Math.ceil(d.height);
        if (fr.modal && modal && modal.entry === fr) { modal.wanted = h; fitModal(); }
        else fr.iframe.style.height = h + 'px';
      }
      if (d.close === true && fr.modal) closeModal();
    }
  });
  window.addEventListener('resize', fitModal);

  function scan() {
    var i, list = doc.querySelectorAll('[data-entree-shop]');
    for (i = 0; i < list.length; i++) mountInline(list[i]);
    list = doc.querySelectorAll('[data-entree-button]');
    for (i = 0; i < list.length; i++) prepButton(list[i]);
  }

  window.Entree = { __embed: true, scan: scan, open: function (slug, code) { openModal(slug, code, doc.activeElement); }, close: closeModal };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', scan);
  scan();
  window.addEventListener('load', scan);
})();

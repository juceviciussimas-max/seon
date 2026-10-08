/* Cart store, cart drawer and header. Loaded on every page after config.js. */
(function () {
  'use strict';

  var P = window.PERCH;
  var cfg = P.config;
  var variants = {};
  P.product.variants.forEach(function (v) { variants[v.id] = v; });

  var MAX_QTY = 10;
  var KEY = 'perch.cart.v1';
  var fmt = new Intl.NumberFormat(cfg.locale, { style: 'currency', currency: cfg.currency });
  var money = function (cents) { return fmt.format(cents / 100); };
  var cents = function (n) { return Math.round(n * 100); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* ---------- store ---------- */
  var lines = load();
  var listeners = [];

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      return raw.filter(function (l) { return variants[l.id] && l.qty > 0; }).map(function (l) { return { id: l.id, qty: Math.min(MAX_QTY, l.qty | 0) }; });
    } catch (e) { return []; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch (e) { /* private mode: cart lives for this page only */ }
    listeners.forEach(function (fn) { fn(); });
  }

  var cart = {
    lines: function () { return lines.map(function (l) { return { id: l.id, qty: l.qty, v: variants[l.id] }; }); },
    add: function (id, qty) {
      if (!variants[id]) return;
      var l = lines.find(function (x) { return x.id === id; });
      if (l) l.qty = Math.min(MAX_QTY, l.qty + qty); else lines.push({ id: id, qty: Math.min(MAX_QTY, qty) });
      save();
    },
    setQty: function (id, qty) {
      var l = lines.find(function (x) { return x.id === id; });
      if (!l) return;
      if (qty <= 0) lines = lines.filter(function (x) { return x.id !== id; }); else l.qty = Math.min(MAX_QTY, qty);
      save();
    },
    remove: function (id) { lines = lines.filter(function (x) { return x.id !== id; }); save(); },
    clear: function () { lines = []; save(); },
    count: function () { return lines.reduce(function (n, l) { return n + l.qty; }, 0); },
    totals: totals,
    onChange: function (fn) { listeners.push(fn); },
    MAX_QTY: MAX_QTY
  };

  function totals() {
    var units = cart.count();
    var subtotal = lines.reduce(function (s, l) { return s + cents(variants[l.id].price) * l.qty; }, 0);
    var pct = 0;
    var nextRule = null;
    cfg.discounts.slice().sort(function (a, b) { return a.minQty - b.minQty; }).forEach(function (r) {
      if (units >= r.minQty) pct = r.pct; else if (!nextRule) nextRule = r;
    });
    var discount = Math.round(subtotal * pct / 100);
    var after = subtotal - discount;
    var freeAt = cents(cfg.freeShippingOver);
    var shipping = units === 0 ? 0 : (after >= freeAt ? 0 : cents(cfg.shippingFlat));
    return {
      units: units, subtotal: subtotal, pct: pct, discount: discount, shipping: shipping,
      total: after + shipping,
      nextRule: nextRule ? { qty: nextRule.minQty - units, pct: nextRule.pct } : null,
      toFree: shipping > 0 ? freeAt - after : 0
    };
  }

  window.Perch = { cart: cart, money: money, esc: esc, cfg: cfg, product: P.product, variants: variants };

  window.addEventListener('storage', function (e) {
    if (e.key === KEY) { lines = load(); listeners.forEach(function (fn) { fn(); }); }
  });

  /* ---------- header badge ---------- */
  var countEl = document.querySelector('[data-cart-count]');
  var cartBtn = document.querySelector('[data-cart-open]');
  var prevCount = cart.count();
  function renderBadge() {
    var n = cart.count();
    if (countEl) { countEl.textContent = n; countEl.hidden = n === 0; }
    if (cartBtn) cartBtn.setAttribute('aria-label', 'Open cart, ' + n + (n === 1 ? ' item' : ' items'));
    if (n > prevCount && cartBtn) {
      cartBtn.classList.remove('is-bump'); void cartBtn.offsetWidth; cartBtn.classList.add('is-bump');
    }
    prevCount = n;
  }

  /* ---------- drawer ---------- */
  var drawer = document.querySelector('[data-drawer]');
  var panel = drawer && drawer.querySelector('.drawer__panel');
  var body = drawer && drawer.querySelector('[data-drawer-body]');
  var foot = drawer && drawer.querySelector('[data-drawer-foot]');
  var live = document.querySelector('[data-live]');
  var lastFocus = null;
  var isOpen = false;
  var closeTimer = 0;

  function announce(msg) { if (live) { live.textContent = ''; setTimeout(function () { live.textContent = msg; }, 30); } }

  function lineHTML(l) {
    var v = l.v;
    return '<li class="cart-line" data-line="' + esc(l.id) + '">' +
      '<div class="cart-line__img"><img src="' + esc(v.image) + '" alt="" width="76" height="96"></div>' +
      '<div class="cart-line__main">' +
        '<div class="cart-line__top"><div><div class="cart-line__name">' + esc(v.name) + '</div><div class="cart-line__variant">' + esc(v.label) + '</div></div>' +
        '<div class="cart-line__price">' + money(cents(v.price) * l.qty) + '</div></div>' +
        '<div class="cart-line__bottom">' +
          '<div class="qty qty--sm" role="group" aria-label="Quantity">' +
            '<button class="qty__btn" type="button" data-act="minus" data-id="' + esc(l.id) + '" aria-label="Decrease quantity">&minus;</button>' +
            '<output class="qty__val">' + l.qty + '</output>' +
            '<button class="qty__btn" type="button" data-act="plus" data-id="' + esc(l.id) + '" aria-label="Increase quantity"' + (l.qty >= MAX_QTY ? ' disabled' : '') + '>+</button>' +
          '</div>' +
          '<button class="link-btn" type="button" data-act="remove" data-id="' + esc(l.id) + '">Remove</button>' +
        '</div>' +
      '</div></li>';
  }

  function renderDrawer() {
    if (!drawer) return;
    var ls = cart.lines();
    if (!ls.length) {
      body.innerHTML = '<div class="cart-empty"><h3>Your cart is empty</h3><p>Pick a size and colour and it will show up here.</p><button class="btn btn--primary" type="button" data-cart-close data-goto-shop>Shop organizers</button></div>';
      foot.innerHTML = '';
      return;
    }
    var t = totals();
    body.innerHTML = '<ul>' + ls.map(lineHTML).join('') + '</ul>';
    var nudges = [];
    if (t.nextRule) nudges.push('Add ' + t.nextRule.qty + ' more to save ' + t.nextRule.pct + '%.');
    if (t.toFree > 0) nudges.push('Add ' + money(t.toFree) + ' more for free shipping.');
    foot.innerHTML =
      (nudges.length ? '<p class="nudge">' + nudges.join(' ') + '</p>' : '') +
      '<dl class="totals">' +
        '<div class="totals__row"><dt>Subtotal</dt><dd>' + money(t.subtotal) + '</dd></div>' +
        (t.discount ? '<div class="totals__row totals__row--save"><dt>Multi-buy discount (' + t.pct + '%)</dt><dd>-' + money(t.discount) + '</dd></div>' : '') +
        '<div class="totals__row"><dt>Shipping</dt><dd>' + (t.shipping ? money(t.shipping) : 'Free') + '</dd></div>' +
        '<div class="totals__row totals__row--total"><dt>Total</dt><dd>' + money(t.total) + '</dd></div>' +
      '</dl>' +
      '<a class="btn btn--primary" href="checkout.html">Checkout</a>' +
      '<button class="link-btn" type="button" data-cart-close>Continue shopping</button>';
  }

  var inertTargets = function () { return Array.prototype.slice.call(document.querySelectorAll('.site-header, main, .site-footer, .buybar, .skip')); };

  function openDrawer() {
    if (!drawer || isOpen) return;
    isOpen = true;
    clearTimeout(closeTimer);
    lastFocus = document.activeElement;
    renderDrawer();
    drawer.hidden = false;
    void drawer.offsetWidth; // commit the start state so the transition runs
    drawer.classList.add('is-open');
    document.body.classList.add('is-locked');
    inertTargets().forEach(function (el) { el.setAttribute('inert', ''); });
    panel.focus({ preventScroll: true });
  }

  function closeDrawer() {
    if (!drawer || !isOpen) return;
    isOpen = false;
    drawer.classList.remove('is-open');
    inertTargets().forEach(function (el) { el.removeAttribute('inert'); });
    document.body.classList.remove('is-locked');
    closeTimer = setTimeout(function () { drawer.hidden = true; }, 300);
    if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }

  document.addEventListener('click', function (e) {
    var open = e.target.closest('[data-cart-open]');
    if (open) { e.preventDefault(); openDrawer(); return; }
    var close = e.target.closest('[data-cart-close]');
    if (close) {
      var toShop = close.hasAttribute('data-goto-shop');
      closeDrawer();
      if (toShop) {
        var shop = document.getElementById('shop');
        if (shop) shop.scrollIntoView({ behavior: 'smooth' }); else location.href = 'index.html#shop';
      }
      return;
    }
    var act = e.target.closest('[data-act]');
    if (act && drawer && drawer.contains(act)) {
      var id = act.getAttribute('data-id');
      var line = lines.find(function (l) { return l.id === id; });
      if (!line) return;
      var act2 = act.getAttribute('data-act');
      if (act2 === 'plus') cart.setQty(id, line.qty + 1);
      else if (act2 === 'minus') cart.setQty(id, line.qty - 1);
      else { cart.remove(id); announce('Item removed from cart'); }
    }
  });

  document.addEventListener('keydown', function (e) {
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); closeDrawer(); return; }
    if (e.key === 'Tab') {
      var f = panel.querySelectorAll('a[href], button:not([disabled])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  cart.onChange(function () { renderBadge(); if (isOpen) renderDrawer(); });
  cart.openDrawer = openDrawer;
  cart.announce = announce;
  renderBadge();
})();

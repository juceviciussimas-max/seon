/* Seon theme: cart drawer with bundle-aware upsells, quick add, ritual picker, sticky add to cart,
   delivery estimate, accordions, and the scroll story (GSAP + Lenis, off for reduced motion). */
(function () {
  'use strict';

  var S = window.Seon || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var strap = S.products && S.products.strap;
  var belt = S.products && S.products.belt;
  var D = S.bundleDiscount || 0;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* ---------- money ---------- */
  function money(cents) {
    var fmt = S.moneyFormat || '${{amount}}';
    var n = (cents / 100);
    var withDec = n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return fmt.replace(/\{\{\s*(\w+)\s*\}\}/, function (_, key) {
      if (key === 'amount_no_decimals') return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      if (key === 'amount_with_comma_separator') return n.toFixed(2).replace('.', ',');
      if (key === 'amount_no_decimals_with_comma_separator') return Math.round(n).toString();
      return withDec;
    });
  }

  /* ---------- bundle maths (mirrors the automatic discount in Shopify admin) ---------- */
  function bundle(strapQty, beltQty) {
    var sp = strap ? strap.variants[0].price : 0;
    var bp = belt ? belt.variants[0].price : 0;
    var full = sp * strapQty + bp * beltQty;
    var save = beltQty >= 1 ? D * Math.min(strapQty, 2) : 0;
    return { full: full, now: full - save, save: save };
  }
  function firstAvailable(p) { return (p.variants.find(function (v) { return v.available; }) || p.variants[0]).id; }

  /* ---------- cart API ---------- */
  function api(url, body) {
    return fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().then(function (d) { if (!r.ok) throw new Error(d.description || d.message || 'Cart error'); return d; });
    });
  }
  var rootUrl = (S.routes && S.routes.root) || '/';
  function cartUrl(path) { return rootUrl.replace(/\/$/, '') + path; }
  function getCart() { return api(cartUrl('/cart.js')); }
  function addItems(items) {
    items = items.filter(function (i) { return i.id && i.quantity > 0; });
    return api(cartUrl('/cart/add.js'), { items: items });
  }
  function changeLine(key, qty) { return api(cartUrl('/cart/change.js'), { id: key, quantity: qty }); }

  /* ---------- header count ---------- */
  var countEl = $('[data-cart-count]');
  var cartBtn = $('[data-cart-open]');
  var prevCount = countEl ? (+countEl.textContent || 0) : 0;
  function setCount(n) {
    if (countEl) { countEl.textContent = n; countEl.hidden = n === 0; }
    if (cartBtn) cartBtn.setAttribute('aria-label', 'Open cart, ' + n + (n === 1 ? ' item' : ' items'));
    if (n > prevCount && cartBtn) { cartBtn.classList.remove('is-bump'); void cartBtn.offsetWidth; cartBtn.classList.add('is-bump'); }
    prevCount = n;
  }

  /* ---------- drawer ---------- */
  var drawer = $('[data-drawer]');
  var panel = drawer && $('.drawer__panel', drawer);
  var body = drawer && $('[data-drawer-body]', drawer);
  var foot = drawer && $('[data-drawer-foot]', drawer);
  var live = $('[data-live]');
  var isOpen = false, lastFocus = null, closeTimer = 0, current = null;
  function announce(m) { if (live) { live.textContent = ''; setTimeout(function () { live.textContent = m; }, 30); } }

  function countOf(cart, handle) { return cart.items.reduce(function (n, i) { return n + (i.handle === handle ? i.quantity : 0); }, 0); }

  function upsellHTML(cart) {
    if (!strap || !belt) return '';
    var sq = countOf(cart, strap.handle), bq = countOf(cart, belt.handle);
    var sp = strap.variants[0].price, bp = belt.variants[0].price;
    if (bq >= 1 && sq < 2) {
      return '<div class="upsell"><p class="upsell__title">' + (sq === 0 ? 'Complete your set' : 'Make it the Ritual Box') + '</p>' +
        '<div class="upsell__row"><img src="' + esc(strap.image) + '" alt="" width="56" height="56">' +
        '<div><div class="upsell__name">' + (sq === 0 ? esc(strap.title) : 'A second ' + esc(strap.title)) + '</div>' +
        '<div class="upsell__price">' + money(sp - D) + ' with your belt<s>' + money(sp) + '</s></div></div>' +
        '<button class="btn btn--primary upsell__add" type="button" data-upsell-add="' + firstAvailable(strap) + '">Add</button></div></div>';
    }
    if (sq >= 1 && bq === 0) {
      var sizes = belt.variants.map(function (v, i) {
        return '<button type="button" data-upsell-size="' + v.id + '" aria-pressed="' + (i === 1 ? 'true' : 'false') + '"' + (v.available ? '' : ' disabled') + '>' + esc(v.title) + '</button>';
      }).join('');
      var save = D * Math.min(sq, 2);
      return '<div class="upsell"><p class="upsell__title">Complete the ritual and save ' + money(save) + '</p>' +
        '<div class="upsell__row"><img src="' + esc(belt.image) + '" alt="" width="56" height="56">' +
        '<div><div class="upsell__name">' + esc(belt.title) + '</div><div class="upsell__price">' + money(bp) + ', your strap drops by ' + money(D) + '</div>' +
        '<div class="upsell__sizes" role="group" aria-label="Belt size">' + sizes + '</div></div>' +
        '<button class="btn btn--primary upsell__add" type="button" data-upsell-belt>Add</button></div></div>';
    }
    return '';
  }

  function lineHTML(item) {
    var opts = (item.options_with_values || []).filter(function (o) { return o.value && o.value !== 'Default Title'; });
    var variant = opts.map(function (o) { return o.name === 'Title' ? o.value : o.name + ' ' + o.value; }).join(', ');
    var img = item.image ? item.image.replace(/(\.[a-z]+)(\?|$)/i, '$1$2') : '';
    var discounted = item.final_line_price < item.original_line_price;
    return '<li class="cart-line" data-key="' + esc(item.key) + '">' +
      '<a class="cart-line__img" href="' + esc(item.url) + '">' + (img ? '<img src="' + esc(img) + (img.indexOf('?') > -1 ? '&' : '?') + 'width=200" alt="" width="78" height="100">' : '') + '</a>' +
      '<div class="cart-line__main">' +
        '<div class="cart-line__top"><div><div class="cart-line__name">' + esc(item.product_title) + '</div>' + (variant ? '<div class="cart-line__variant">' + esc(variant) + '</div>' : '') + '</div>' +
        '<div class="cart-line__price">' + (discounted ? '<s class="cart-line__was">' + money(item.original_line_price) + '</s> ' : '') + money(item.final_line_price) + '</div></div>' +
        '<div class="cart-line__bottom"><div class="qty qty--sm" role="group" aria-label="Quantity">' +
          '<button class="qty__btn" type="button" data-qty="-1" aria-label="Decrease quantity">&minus;</button>' +
          '<output class="qty__val">' + item.quantity + '</output>' +
          '<button class="qty__btn" type="button" data-qty="1" aria-label="Increase quantity"' + (item.quantity >= 10 ? ' disabled' : '') + '>+</button></div>' +
          '<button class="link-btn" type="button" data-remove>Remove</button></div>' +
      '</div></li>';
  }

  function emptyHTML() {
    var cards = [strap, belt].filter(Boolean).map(function (p) {
      return '<div class="upsell__row"><img src="' + esc(p.image) + '" alt="" width="56" height="56"><div><div class="upsell__name">' + esc(p.title) + '</div><div class="upsell__price">' + money(p.variants[0].price) + '</div></div>' +
        '<a class="btn btn--primary upsell__add" href="' + esc(p.url) + '">View</a></div>';
    }).join('');
    return '<div class="cart-empty"><h3>Your cart is empty</h3><p>Start your evening ritual.</p></div>' + (cards ? '<div class="upsell">' + cards + '</div>' : '');
  }

  var P = S.protection;
  function isProtection(i) { return !!(P && (i.variant_id === P.variant || i.handle === P.handle)); }
  function protectionLine(cart) { return P ? cart.items.find(isProtection) : null; }

  // Ritual savings tracker: strap or belt -> Seon Set -> Ritual Box.
  function trackerHTML(cart) {
    if (!strap || !belt || !D) return '';
    var sq = countOf(cart, strap.handle), bq = countOf(cart, belt.handle);
    if (!sq && !bq) return '';
    var step = (sq >= 2 && bq >= 1) ? 3 : (sq >= 1 && bq >= 1) ? 2 : 1;
    var msg = step === 3 ? 'Ritual Box unlocked. You save ' + money(D * 2) + '.'
      : step === 2 ? 'Seon Set unlocked. Add a second strap to save ' + money(D) + ' more.'
      : sq ? 'Add the posture belt to unlock the Seon Set and save ' + money(D) + '.'
      : 'Add a V-line strap to unlock the Seon Set and save ' + money(D) + '.';
    var steps = [['Your pick', ''], ['Seon Set', '&minus;' + money(D)], ['Ritual Box', '&minus;' + money(D * 2)]];
    return '<div class="tracker" data-step="' + step + '"><p class="tracker__msg">' + msg + '</p>' +
      '<div class="tracker__bar" role="progressbar" aria-label="Bundle savings" aria-valuemin="1" aria-valuemax="3" aria-valuenow="' + step + '"><span style="--p:' + ((step - 1) / 2) + '"></span></div>' +
      '<ol class="tracker__steps">' + steps.map(function (st, i) {
        return '<li class="' + (i < step ? 'is-done' : '') + '"><span class="tracker__dot">' + (i < step ? '&#10003;' : (i + 1)) + '</span><b>' + st[0] + '</b>' + (st[1] ? '<small>' + st[1] + '</small>' : '') + '</li>';
      }).join('') + '</ol></div>';
  }

  function protectRowHTML(cart) {
    if (!P) return '';
    var on = !!protectionLine(cart);
    return '<label class="protect protect--cart"><span class="protect__icon">' + shieldSVG + '</span>' +
      '<span class="protect__text"><strong>Shipping protection <span>' + money(P.price) + '</span></strong><small>Reship or refund if your parcel is lost, stolen or damaged.</small></span>' +
      '<input class="protect__input" type="checkbox" role="switch" data-protect-cart' + (on ? ' checked' : '') + '><span class="protect__switch" aria-hidden="true"></span></label>';
  }
  var shieldTpl = document.querySelector('[data-shield-tpl]');
  var shieldSVG = shieldTpl ? shieldTpl.innerHTML : '';

  function render(cart, target, footTarget) {
    current = cart;
    var goods = cart.items.filter(function (i) { return !isProtection(i); });
    var goodsCount = goods.reduce(function (n, i) { return n + i.quantity; }, 0);
    setCount(goodsCount);
    var extra = $('[data-drawer-extra]');
    if (extra) extra.hidden = !goodsCount;
    if (!target) return;
    if (!goodsCount) { target.innerHTML = emptyHTML(); if (footTarget) footTarget.innerHTML = ''; return; }
    target.innerHTML = trackerHTML(cart) + '<ul>' + goods.map(lineHTML).join('') + '</ul>' + upsellHTML(cart) + protectRowHTML(cart);
    var savings = cart.original_total_price - cart.total_price;
    var pl = protectionLine(cart);
    var html = '<dl class="totals">' +
      (savings > 0 ? '<div class="totals__row"><dt>Subtotal</dt><dd>' + money(cart.original_total_price - (pl ? pl.original_line_price : 0)) + '</dd></div>' +
        '<div class="totals__row totals__row--save"><dt>Bundle savings</dt><dd>&minus;' + money(savings) + '</dd></div>' : '') +
      (pl ? '<div class="totals__row"><dt>Shipping protection</dt><dd>' + money(pl.final_line_price) + '</dd></div>' : '') +
      '<div class="totals__row totals__row--total"><dt>Total <small>Free shipping</small></dt><dd>' + money(cart.total_price) + '</dd></div></dl>' +
      '<a class="btn btn--primary btn--block" href="' + esc(cartUrl('/checkout')) + '">Checkout securely</a>';
    if (footTarget) footTarget.innerHTML = html; else target.insertAdjacentHTML('beforeend', html);
  }

  // Protection on its own makes no sense: drop it when the last product leaves the cart.
  function tidy(cart) {
    var pl = protectionLine(cart);
    if (pl && cart.items.every(isProtection)) return changeLine(pl.key, 0);
    if (pl && pl.quantity > 1) return changeLine(pl.key, 1);
    return Promise.resolve(cart);
  }

  function refresh() {
    return getCart().then(tidy).then(function (c) {
      render(c, body, foot);
      var page = $('[data-cart-page]');
      if (page) render(c, page, null);
      return c;
    });
  }

  var inertTargets = function () { return $$('.site-header, main, .site-footer, .announce, .buybar, .skip'); };
  function openDrawer() {
    if (!drawer || isOpen) return;
    if (document.body.classList.contains('template-cart')) return;
    isOpen = true; clearTimeout(closeTimer); lastFocus = document.activeElement;
    drawer.hidden = false; void drawer.offsetWidth; drawer.classList.add('is-open');
    document.body.classList.add('is-locked');
    inertTargets().forEach(function (el) { el.setAttribute('inert', ''); });
    panel.focus({ preventScroll: true });
    refresh();
  }
  function closeDrawer() {
    if (!drawer || !isOpen) return;
    isOpen = false; drawer.classList.remove('is-open');
    inertTargets().forEach(function (el) { el.removeAttribute('inert'); });
    document.body.classList.remove('is-locked');
    closeTimer = setTimeout(function () { drawer.hidden = true; }, 320);
    if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }

  function withLoading(el, p) {
    if (el) el.classList.add('is-loading');
    return p.catch(function (e) {
      announce(e.message || 'Something went wrong. Please try again.');
      alertInline(e.message);
    }).then(function (r) { if (el) el.classList.remove('is-loading'); return r; });
  }
  function alertInline(msg) {
    if (!body) return;
    var p = document.createElement('p');
    p.className = 'nudge'; p.textContent = msg || 'Something went wrong. Please try again.';
    body.prepend(p); setTimeout(function () { p.remove(); }, 5000);
  }

  // Adds the items, plus shipping protection when its switch near the button is on.
  function addAndOpen(items, btn) {
    var scope = btn && btn.closest('[data-pdp], [data-bundle], [data-card]');
    var sw = scope && $('[data-protect-input]', scope);
    var wantProtection = !!(P && sw && sw.checked);
    var pre = wantProtection ? getCart() : Promise.resolve(null);
    return withLoading(btn, pre.then(function (c) {
      if (wantProtection && !(c && protectionLine(c))) items = items.concat([{ id: P.variant, quantity: 1 }]);
      return addItems(items);
    }).then(function () {
      if (btn) { var l = $('.btn__label', btn) || btn; var old = l.textContent; btn.classList.add('is-done'); l.textContent = 'Added'; setTimeout(function () { btn.classList.remove('is-done'); l.textContent = old; }, 1400); }
      announce('Added to cart');
      if (S.atc === 'checkout' && !document.body.classList.contains('template-cart')) { window.location.href = cartUrl('/checkout'); return; }
      if (document.body.classList.contains('template-cart')) return refresh();
      openDrawer();
    }));
  }

  // Shipping protection switch inside the cart.
  document.addEventListener('change', function (e) {
    if (!e.target.matches('[data-protect-cart]') || !P || !current) return;
    var on = e.target.checked, pl = protectionLine(current);
    var job = on ? (pl ? Promise.resolve() : addItems([{ id: P.variant, quantity: 1 }])) : (pl ? changeLine(pl.key, 0) : Promise.resolve());
    withLoading(e.target.closest('.protect'), job.then(refresh));
  });

  document.addEventListener('click', function (e) {
    var t = e.target;
    var open = t.closest('[data-cart-open]');
    if (open && drawer && !document.body.classList.contains('template-cart')) { e.preventDefault(); openDrawer(); return; }
    if (t.closest('[data-cart-close]')) { closeDrawer(); return; }

    var line = t.closest('.cart-line');
    if (line && current) {
      var key = line.getAttribute('data-key');
      var item = current.items.find(function (i) { return i.key === key; });
      var q = t.closest('[data-qty]');
      if (q && item) { withLoading(line, changeLine(key, Math.min(10, Math.max(0, item.quantity + (+q.getAttribute('data-qty'))))).then(tidy).then(function (c) { render(c, body, foot); var pg = $('[data-cart-page]'); if (pg) render(c, pg, null); })); return; }
      if (t.closest('[data-remove]')) { withLoading(line, changeLine(key, 0).then(tidy).then(function (c) { render(c, body, foot); var pg = $('[data-cart-page]'); if (pg) render(c, pg, null); announce('Removed from cart'); })); return; }
    }

    var size = t.closest('[data-upsell-size]');
    if (size) { $$('[data-upsell-size]', size.parentNode).forEach(function (b) { b.setAttribute('aria-pressed', b === size ? 'true' : 'false'); }); return; }
    var up = t.closest('[data-upsell-add]');
    if (up) { addAndOpen([{ id: +up.getAttribute('data-upsell-add'), quantity: 1 }], up).then(refresh); return; }
    var ub = t.closest('[data-upsell-belt]');
    if (ub) {
      var pressed = $('[data-upsell-size][aria-pressed="true"]', ub.closest('.upsell'));
      addAndOpen([{ id: +(pressed ? pressed.getAttribute('data-upsell-size') : firstAvailable(belt)), quantity: 1 }], ub).then(refresh);
      return;
    }

    // Product cards
    var qa = t.closest('[data-quick-add]');
    if (qa) {
      var card = qa.closest('[data-card]');
      var checked = card && $('input[type=radio]:checked', card);
      addAndOpen([{ id: +(checked ? checked.value : qa.getAttribute('data-variant')), quantity: 1 }], qa);
      return;
    }
    var oa = t.closest('[data-offer-add]');
    if (oa) {
      var oc = oa.closest('[data-offer]');
      var bsel = $('input[type=radio]:checked', oc);
      addAndOpen([
        { id: strap ? firstAvailable(strap) : 0, quantity: +oc.getAttribute('data-strap-qty') },
        { id: +(bsel ? bsel.value : 0), quantity: +oc.getAttribute('data-belt-qty') }
      ], oa);
      return;
    }

    var a = t.closest('[data-scroll-to]');
    if (a) {
      var id = a.getAttribute('href') || '';
      var hash = id.indexOf('#') > -1 ? id.slice(id.indexOf('#')) : '';
      var target = hash && $(hash);
      if (target) { e.preventDefault(); scrollToEl(target); }
    }
  });

  // Size pills update their legend
  document.addEventListener('change', function (e) {
    var r = e.target;
    if (r.type === 'radio' && r.getAttribute('data-title')) {
      var fs = r.closest('fieldset');
      var nm = fs && $('[data-size-name]', fs);
      if (nm) nm.textContent = r.getAttribute('data-title');
    }
  });

  document.addEventListener('keydown', function (e) {
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); closeDrawer(); return; }
    if (e.key === 'Tab') {
      var f = $$('a[href], button:not([disabled])', panel);
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- low stock: only shown when Shopify tracks the real count ---------- */
  function variantInfo(id) {
    var out = null;
    [strap, belt].forEach(function (p) { if (p) p.variants.forEach(function (v) { if (v.id === +id) out = { v: v, p: p }; }); });
    return out;
  }
  function updateStock(items, scope) {
    var box = $('[data-stock]', scope);
    var label = box && $('[data-stock-label]', box), dot = box && $('[data-stock-dot]', box);
    if (!label) return;
    var low = null;
    items.forEach(function (it) {
      var f = variantInfo(it.id);
      if (!f || f.v.inv == null || f.v.inv <= 0) return;
      if (f.v.inv <= (S.lowStock || 0) && (!low || f.v.inv < low.n)) low = { n: f.v.inv, p: f.p, v: f.v };
    });
    if (low) {
      label.textContent = 'Only ' + low.n + ' left' + (low.p === belt && belt.variants.length > 1 ? ' in size ' + low.v.title : '') + '.';
      dot.classList.add('stock__dot--low');
    } else { label.textContent = 'In stock.'; dot.classList.remove('stock__dot--low'); }
  }
  $$('[data-bundle]').forEach(function (b) {
    var sync = function () {
      var sq = +b.getAttribute('data-strap-qty'), bq = +b.getAttribute('data-belt-qty');
      var bsel = $('input[type=radio]:checked', b), items = [];
      if (sq && strap) items.push({ id: firstAvailable(strap), quantity: sq });
      if (bq && bsel) items.push({ id: +bsel.value, quantity: bq });
      updateStock(items, b);
    };
    b.addEventListener('change', sync); sync();
  });

  /* ---------- floating buy bar on the home page ---------- */
  var homeBar = $('[data-home-bar]'), heroEl = $('[data-hero]');
  if (homeBar && heroEl && 'IntersectionObserver' in window) {
    homeBar.hidden = false;
    new IntersectionObserver(function (en) {
      homeBar.classList.toggle('is-in', !en[0].isIntersecting && en[0].boundingClientRect.top < 0);
    }).observe(heroEl);
  }

  /* ---------- announcement rotator ---------- */
  var ann = $$('.announce__item');
  if (ann.length > 1 && !reduceMotion) {
    var ai = 0;
    setInterval(function () {
      if (document.hidden) return;
      ann[ai].classList.remove('is-active'); ann[ai].setAttribute('aria-hidden', 'true');
      ai = (ai + 1) % ann.length;
      ann[ai].classList.add('is-active'); ann[ai].removeAttribute('aria-hidden');
    }, 4200);
  }

  /* ---------- mobile menu ---------- */
  var menu = $('[data-menu]');
  var menuPanel = menu && $('.menu__panel', menu);
  var menuOpen = false, menuLast = null, menuTimer = 0;
  function openMenu() {
    if (!menu || menuOpen) return;
    menuOpen = true; clearTimeout(menuTimer); menuLast = document.activeElement;
    menu.hidden = false; void menu.offsetWidth; menu.classList.add('is-open');
    document.body.classList.add('is-locked');
    inertTargets().forEach(function (el) { el.setAttribute('inert', ''); });
    menuPanel.focus({ preventScroll: true });
  }
  function closeMenu() {
    if (!menu || !menuOpen) return;
    menuOpen = false; menu.classList.remove('is-open');
    inertTargets().forEach(function (el) { el.removeAttribute('inert'); });
    document.body.classList.remove('is-locked');
    menuTimer = setTimeout(function () { menu.hidden = true; }, 320);
    if (menuLast && menuLast.focus && document.contains(menuLast)) menuLast.focus({ preventScroll: true });
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-menu-open]')) { e.preventDefault(); openMenu(); return; }
    if (e.target.closest('[data-menu-close]')) closeMenu();
  });
  document.addEventListener('keydown', function (e) {
    if (!menuOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
    if (e.key === 'Tab') {
      var f = $$('a[href], button:not([disabled])', menuPanel);
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === menuPanel)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  window.matchMedia('(min-width: 761px)').addEventListener('change', function (m) { if (m.matches) closeMenu(); });

  /* ---------- photo swaps (product cards, galleries, offer tiles) ---------- */
  function swapImg(img, src, alt) {
    if (!img || !src || img.getAttribute('src') === src) return;
    img.classList.add('is-swapping');
    var pre = new Image();
    pre.onload = pre.onerror = function () {
      setTimeout(function () {
        img.removeAttribute('srcset'); img.src = src; if (alt != null) img.alt = alt;
        requestAnimationFrame(function () { img.classList.remove('is-swapping'); });
      }, 90);
    };
    pre.src = src;
  }
  document.addEventListener('click', function (e) {
    var th = e.target.closest('[data-card-thumb]');
    if (!th) return;
    var card = th.closest('[data-card]');
    swapImg(card && $('[data-main]', card), th.getAttribute('data-src'), th.getAttribute('data-alt'));
    $$('[data-card-thumb]', card).forEach(function (b) { b.setAttribute('aria-current', b === th ? 'true' : 'false'); });
  });
  $$('[data-gallery]').forEach(function (g) {
    var main = $('[data-gallery-main]', g) || $('.pdp__main img', g);
    if (main) main.setAttribute('data-orig', main.getAttribute('src'));
    $$('[data-thumb]', g).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('[data-thumb]', g).forEach(function (x) { x.setAttribute('aria-current', x === b ? 'true' : 'false'); });
        swapImg(main, b.getAttribute('data-src'), b.getAttribute('data-alt'));
      });
    });
  });

  // Arrows and swipe step through the thumbnails.
  function stepGallery(g, dir) {
    var thumbs = $$('[data-thumb]', g);
    if (thumbs.length < 2) return;
    var i = thumbs.findIndex(function (x) { return x.getAttribute('aria-current') === 'true'; });
    thumbs[(Math.max(0, i) + dir + thumbs.length) % thumbs.length].click();
  }
  $$('[data-gallery]').forEach(function (g) {
    $$('[data-gallery-step]', g).forEach(function (b) { b.addEventListener('click', function () { stepGallery(g, +b.getAttribute('data-gallery-step')); }); });
    var sw = $('[data-swipe]', g);
    if (!sw) return;
    var x0 = null, y0 = 0;
    sw.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    sw.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) stepGallery(g, dx < 0 ? 1 : -1);
      x0 = null;
    }, { passive: true });
  });

  /* ---------- sticky buy bar + delivery estimate (product and bundle pages) ---------- */
  $$('[data-buybar]').forEach(function (bar) {
    var scope = bar.closest('[data-pdp], [data-bundle]') || document;
    var mainBtn = $('[data-pdp-add], [data-main-add]', scope);
    if (!mainBtn || !('IntersectionObserver' in window)) return;
    bar.hidden = false;
    new IntersectionObserver(function (en) {
      bar.classList.toggle('is-in', !en[0].isIntersecting && en[0].boundingClientRect.top < 0);
    }).observe(mainBtn);
  });
  if (S.delivery) {
    var addBiz = function (d, n) { d = new Date(d); while (n > 0) { d.setDate(d.getDate() + 1); var w = d.getDay(); if (w !== 0 && w !== 6) n--; } return d; };
    var fmtDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
    var today = new Date();
    $$('[data-eta]').forEach(function (el) { el.textContent = fmtDay.format(addBiz(today, S.delivery.min)) + ' to ' + fmtDay.format(addBiz(today, S.delivery.max)); });
  }

  if ($('[data-cart-page]')) refresh();

  /* ---------- product page ---------- */
  var pdp = $('[data-pdp]');
  if (pdp) {
    var mainImg = $('[data-gallery-main]', pdp) || $('.pdp__main img', pdp);

    var handle = pdp.getAttribute('data-handle');
    var form = $('[data-pdp-form]', pdp);
    var tiles = $$('input[name=offer]', pdp);
    var sizeGroup = $('[data-size-group]', pdp);
    var priceEl = $('[data-pdp-price]', pdp), compareEl = $('[data-pdp-compare]', pdp), saveEl = $('[data-pdp-save]', pdp);
    var barPrice = $('[data-buybar-price]', pdp), barLabel = $('[data-buybar-label]', pdp);

    tiles.forEach(function (t) {
      var b = bundle(+t.getAttribute('data-strap-qty'), +t.getAttribute('data-belt-qty'));
      var face = t.nextElementSibling;
      $('[data-offer-price]', face).textContent = money(b.now);
      $('[data-offer-compare]', face).textContent = b.save ? money(b.full) : '';
      var sv = $('[data-offer-save]', face);
      if (sv && b.save) { sv.textContent = 'You save ' + money(b.save); sv.hidden = false; }
    });

    function selection() {
      var t = tiles.find(function (x) { return x.checked; });
      var sq, bq;
      if (t) { sq = +t.getAttribute('data-strap-qty'); bq = +t.getAttribute('data-belt-qty'); }
      else if (belt && handle === belt.handle) { sq = 0; bq = 1; }
      else if (strap && handle === strap.handle) { sq = 1; bq = 0; }
      else return { items: [{ id: +$('input[name=id]', form).value, quantity: 1 }], b: null, label: '' };
      var bsel = sizeGroup && $('input[type=radio]:checked', sizeGroup);
      var items = [];
      if (sq) items.push({ id: firstAvailable(strap), quantity: sq });
      if (bq) items.push({ id: +(bsel ? bsel.value : firstAvailable(belt)), quantity: bq });
      var label = t ? $('.offer__text strong', t.nextElementSibling).textContent : '';
      return { items: items, b: bundle(sq, bq), bq: bq, label: label };
    }

    function syncPdp() {
      var s = selection();
      updateStock(s.items, pdp);
      if (sizeGroup) sizeGroup.hidden = !(s.bq > 0);
      if (s.b) {
        priceEl.textContent = money(s.b.now);
        compareEl.hidden = !s.b.save; compareEl.textContent = s.b.save ? money(s.b.full) : '';
        saveEl.hidden = !s.b.save; saveEl.textContent = s.b.save ? 'Save ' + money(s.b.save) : '';
        if (barPrice) barPrice.textContent = money(s.b.now);
        if (barLabel && s.label) barLabel.textContent = s.label;
      }
    }
    pdp.addEventListener('change', function (e) {
      if (e.target.name === 'offer') {
        var hero = e.target.getAttribute('data-hero');
        swapImg(mainImg, hero || (mainImg && mainImg.getAttribute('data-orig')));
        if (!hero) $$('[data-thumb]', pdp).forEach(function (x, i) { x.setAttribute('aria-current', i === 0 ? 'true' : 'false'); });
      }
      if (e.target.name === 'offer' || e.target.name === 'belt-size') syncPdp();
    });
    syncPdp();

    var addBtn = $('[data-pdp-add]', pdp);
    form.addEventListener('submit', function (e) { e.preventDefault(); addAndOpen(selection().items, addBtn); });
    var barBtn = $('[data-buybar-add]', pdp);
    if (barBtn) barBtn.addEventListener('click', function () { addAndOpen(selection().items, barBtn); });

  }

  /* ---------- accordions ---------- */
  $$('[data-acc]').forEach(function (acc) {
    acc.addEventListener('click', function (e) {
      var btn = e.target.closest('.acc__btn');
      if (!btn) return;
      var item = btn.closest('.acc__item');
      var open = !item.classList.contains('is-open');
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (window.ScrollTrigger) setTimeout(function () { window.ScrollTrigger.refresh(); }, 340);
    });
  });

  /* ---------- scroll story ---------- */
  var lenis = null;
  function scrollToEl(el) {
    if (lenis) lenis.scrollTo(el, { offset: -80, duration: 1.2 });
    else el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  var header = $('[data-header]');
  var steps = $$('[data-step]'), stepImgs = $$('[data-step-img]');
  function setStep(i) {
    steps.forEach(function (s) { s.classList.toggle('is-active', +s.getAttribute('data-step') === i); });
    stepImgs.forEach(function (s) { s.classList.toggle('is-active', +s.getAttribute('data-step-img') === i); });
  }
  function ready() { requestAnimationFrame(function () { root.classList.add('is-ready'); }); }
  if (header) {
    var solid = function () { header.classList.toggle('is-solid', window.scrollY > 8); };
    window.addEventListener('scroll', solid, { passive: true });
    solid();
  }

  var hasGsap = !!(window.gsap && window.ScrollTrigger) && !reduceMotion;
  if (!hasGsap) {
    root.classList.add('no-motion');
    steps.forEach(function (s) { s.addEventListener('click', function () { setStep(+s.getAttribute('data-step')); }); });
    ready();
    return;
  }
  var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);
  var isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  if (window.Lenis && !isTouch) {
    lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 0.9 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    new MutationObserver(function () { if (document.body.classList.contains('is-locked')) lenis.stop(); else lenis.start(); })
      .observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
  // Sections fade up as they enter, a few at a time.
  var reveals = $$('[data-reveal]');
  if (reveals.length) {
    gsap.set(reveals, { autoAlpha: 0, y: 26 });
    ScrollTrigger.batch(reveals, {
      start: 'top 90%', once: true,
      onEnter: function (els) { gsap.to(els, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08, overwrite: true, clearProps: 'transform,opacity,visibility' }); }
    });
  }
  if ($('[data-hero-media] img')) {
    gsap.to('[data-hero-media] img', { scale: 1.08, yPercent: 6, ease: 'none', scrollTrigger: { trigger: '[data-hero]', start: 'top top', end: 'bottom top', scrub: true } });
  }
  $$('[data-ritual]').forEach(function (r) {
    ScrollTrigger.create({
      trigger: r, start: 'top top', end: '+=160%', pin: $('.ritual__stage', r), anticipatePin: 1,
      onUpdate: function (self) { setStep(Math.min(2, Math.floor(self.progress * 3))); }
    });
  });
  $$('[data-parallax] img').forEach(function (img) {
    gsap.fromTo(img, { yPercent: -6 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: img.closest('[data-parallax]'), start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  ready();
})();

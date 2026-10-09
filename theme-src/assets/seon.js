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
    var variant = item.variant_title && item.variant_title !== 'Default Title' ? item.variant_title : '';
    var img = item.image ? item.image.replace(/(\.[a-z]+)(\?|$)/i, '$1$2') : '';
    var discounted = item.final_line_price < item.original_line_price;
    return '<li class="cart-line" data-key="' + esc(item.key) + '">' +
      '<a class="cart-line__img" href="' + esc(item.url) + '">' + (img ? '<img src="' + esc(img) + (img.indexOf('?') > -1 ? '&' : '?') + 'width=200" alt="" width="78" height="100">' : '') + '</a>' +
      '<div class="cart-line__main">' +
        '<div class="cart-line__top"><div><div class="cart-line__name">' + esc(item.product_title) + '</div>' + (variant ? '<div class="cart-line__variant">Size ' + esc(variant) + '</div>' : '') + '</div>' +
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

  function render(cart, target, footTarget) {
    current = cart;
    setCount(cart.item_count);
    if (!target) return;
    if (!cart.item_count) { target.innerHTML = emptyHTML(); if (footTarget) footTarget.innerHTML = ''; return; }
    target.innerHTML = '<ul>' + cart.items.map(lineHTML).join('') + '</ul>' + upsellHTML(cart);
    var savings = cart.original_total_price - cart.total_price;
    var html = '<dl class="totals">' +
      '<div class="totals__row"><dt>Subtotal</dt><dd>' + money(cart.original_total_price) + '</dd></div>' +
      (savings > 0 ? '<div class="totals__row totals__row--save"><dt>Bundle savings</dt><dd>&minus;' + money(savings) + '</dd></div>' : '') +
      '<div class="totals__row"><dt>Shipping</dt><dd>Free</dd></div>' +
      '<div class="totals__row totals__row--total"><dt>Total</dt><dd>' + money(cart.total_price) + '</dd></div></dl>' +
      '<a class="btn btn--primary btn--block" href="' + esc(cartUrl('/checkout')) + '">Checkout</a>' +
      '<p class="drawer__secure">Secure checkout. Card, Apple Pay, Google Pay or PayPal.</p>';
    if (footTarget) footTarget.innerHTML = html; else target.insertAdjacentHTML('beforeend', html);
  }

  function refresh() {
    return getCart().then(function (c) {
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

  function addAndOpen(items, btn) {
    return withLoading(btn, addItems(items).then(function () {
      if (btn) { var l = $('.btn__label', btn) || btn; var old = l.textContent; btn.classList.add('is-done'); l.textContent = 'Added'; setTimeout(function () { btn.classList.remove('is-done'); l.textContent = old; }, 1400); }
      announce('Added to cart');
      if (document.body.classList.contains('template-cart')) return refresh();
      openDrawer();
    }));
  }

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
      if (q && item) { withLoading(line, changeLine(key, Math.min(10, Math.max(0, item.quantity + (+q.getAttribute('data-qty'))))).then(function (c) { render(c, body, foot); var pg = $('[data-cart-page]'); if (pg) render(c, pg, null); })); return; }
      if (t.closest('[data-remove]')) { withLoading(line, changeLine(key, 0).then(function (c) { render(c, body, foot); var pg = $('[data-cart-page]'); if (pg) render(c, pg, null); announce('Removed from cart'); })); return; }
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

  if ($('[data-cart-page]')) refresh();

  /* ---------- product page ---------- */
  var pdp = $('[data-pdp]');
  if (pdp) {
    var mainImg = $('[data-gallery-main]', pdp) || $('.pdp__main img', pdp);
    $$('[data-thumb]', pdp).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('[data-thumb]', pdp).forEach(function (x) { x.setAttribute('aria-current', x === b ? 'true' : 'false'); });
        if (!mainImg) return;
        mainImg.classList.add('is-swapping');
        var src = b.getAttribute('data-src');
        var pre = new Image();
        pre.onload = pre.onerror = function () { setTimeout(function () { mainImg.removeAttribute('srcset'); mainImg.src = src; mainImg.alt = b.getAttribute('data-alt') || ''; requestAnimationFrame(function () { mainImg.classList.remove('is-swapping'); }); }, 100); };
        pre.src = src;
      });
    });

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
      if (sizeGroup) sizeGroup.hidden = !(s.bq > 0);
      if (s.b) {
        priceEl.textContent = money(s.b.now);
        compareEl.hidden = !s.b.save; compareEl.textContent = s.b.save ? money(s.b.full) : '';
        saveEl.hidden = !s.b.save; saveEl.textContent = s.b.save ? 'Save ' + money(s.b.save) : '';
        if (barPrice) barPrice.textContent = money(s.b.now);
        if (barLabel && s.label) barLabel.textContent = s.label;
      }
    }
    pdp.addEventListener('change', function (e) { if (e.target.name === 'offer' || e.target.name === 'belt-size') syncPdp(); });
    syncPdp();

    var addBtn = $('[data-pdp-add]', pdp);
    form.addEventListener('submit', function (e) { e.preventDefault(); addAndOpen(selection().items, addBtn); });
    var barBtn = $('[data-buybar-add]', pdp);
    if (barBtn) barBtn.addEventListener('click', function () { addAndOpen(selection().items, barBtn); });

    // Sticky bar appears once the main button scrolls away.
    var bar = $('[data-buybar]', pdp);
    if (bar && addBtn && 'IntersectionObserver' in window) {
      bar.hidden = false;
      new IntersectionObserver(function (en) {
        bar.classList.toggle('is-in', !en[0].isIntersecting && en[0].boundingClientRect.top < 0);
      }).observe(addBtn);
    }

    // Delivery estimate in business days.
    var eta = $('[data-eta]', pdp);
    if (eta && S.delivery) {
      var addBiz = function (d, n) { d = new Date(d); while (n > 0) { d.setDate(d.getDate() + 1); var w = d.getDay(); if (w !== 0 && w !== 6) n--; } return d; };
      var f = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
      var now = new Date();
      eta.textContent = f.format(addBiz(now, S.delivery.min)) + ' to ' + f.format(addBiz(now, S.delivery.max));
    }
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
  if (header) ScrollTrigger.create({ start: 40, end: 'max', onToggle: function (self) { header.classList.toggle('is-solid', self.isActive); } });
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

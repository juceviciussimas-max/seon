/* Seon home: product cards (photos, size, add to cart), accordions, hero reveal, pinned ritual story. */
(function () {
  'use strict';

  var Perch = window.Perch;
  var products = Perch.product.products;
  var money = Perch.money;
  var esc = Perch.esc;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = !!(window.gsap && window.ScrollTrigger) && !reduceMotion;
  if (!hasGsap) root.classList.add('no-motion');
  var cents = function (n) { return Math.round(n * 100); };

  /* ---------- product cards ---------- */
  var grid = $('[data-products]');
  var order = ['set', 'strap', 'belt', 'box'];
  grid.innerHTML = order.map(function (id) {
    var p = products.find(function (x) { return x.id === id; });
    var sized = p.variants.length > 1;
    var thumbs = p.images.map(function (src, i) {
      return '<button class="pcard__thumb" type="button" data-img="' + i + '"' + (i === 0 ? ' aria-current="true"' : '') + ' aria-label="Show photo ' + (i + 1) + '"><img src="' + src + '" alt="" width="64" height="64" loading="lazy"></button>';
    }).join('');
    var sizes = sized ? '<fieldset class="opt"><legend>' + esc(p.sizeLabel || 'Size') + ' <span data-size-name>' + esc(p.variants[1] ? p.variants[1].size : p.variants[0].size) + '</span></legend><div class="opt__row">' +
      p.variants.map(function (v, i) {
        return '<label class="chip chip--sm"><input type="radio" name="size-' + p.id + '" value="' + v.id + '"' + (i === 1 ? ' checked' : '') + '><span class="chip__face">' + esc(v.size) + '</span></label>';
      }).join('') + '</div></fieldset>' : '<p class="pcard__variant">' + esc(p.variants[0].label) + '</p>';
    return '<article class="pcard pcard--' + p.id + '" data-product="' + p.id + '">' +
      '<div class="pcard__media"><img class="pcard__img" data-main src="' + p.images[0] + '" alt="' + esc(p.alts[0]) + '" loading="lazy" decoding="async"><div class="pcard__thumbs">' + thumbs + '</div></div>' +
      '<div class="pcard__body">' +
        (p.id === 'set' ? '<p class="pcard__tag">Most popular</p>' : p.id === 'box' ? '<p class="pcard__tag">Best value</p>' : '') +
        '<h3 class="pcard__name">' + esc(p.name) + '</h3>' +
        '<p class="pcard__short">' + esc(p.short) + '</p>' +
        '<p class="pcard__price">' + money(cents(p.price)) + (p.compareNote ? '<span class="pcard__save">' + esc(p.compareNote) + '</span>' : '') + '</p>' +
        sizes +
        '<button class="btn btn--primary pcard__add" type="button" data-add><span class="btn__label">Add to cart</span></button>' +
        '<p class="pcard__ship">Free US shipping, ' + esc(Perch.cfg.deliveryDays) + '</p>' +
      '</div></article>';
  }).join('');

  grid.addEventListener('click', function (e) {
    var card = e.target.closest('[data-product]');
    if (!card) return;
    var p = products.find(function (x) { return x.id === card.getAttribute('data-product'); });
    var th = e.target.closest('[data-img]');
    if (th) {
      var i = +th.getAttribute('data-img'), img = card.querySelector('[data-main]');
      img.classList.add('is-swapping');
      setTimeout(function () { img.src = p.images[i]; img.alt = p.alts[i] || ''; requestAnimationFrame(function () { img.classList.remove('is-swapping'); }); }, 120);
      card.querySelectorAll('[data-img]').forEach(function (b) { b.setAttribute('aria-current', b === th ? 'true' : 'false'); });
      return;
    }
    var add = e.target.closest('[data-add]');
    if (add) {
      var checked = card.querySelector('input[type=radio]:checked');
      var vid = checked ? checked.value : p.variants[0].id;
      Perch.cart.add(vid, 1);
      Perch.cart.announce(p.name + ' added to cart');
      var label = add.querySelector('.btn__label');
      add.classList.add('is-done'); label.textContent = 'Added';
      setTimeout(function () { add.classList.remove('is-done'); label.textContent = 'Add to cart'; }, 1400);
      Perch.cart.openDrawer();
    }
  });
  grid.addEventListener('change', function (e) {
    if (e.target.type !== 'radio') return;
    var card = e.target.closest('[data-product]');
    var p = products.find(function (x) { return x.id === card.getAttribute('data-product'); });
    var v = p.variants.find(function (x) { return x.id === e.target.value; });
    card.querySelector('[data-size-name]').textContent = v.size;
  });

  /* ---------- accordions ---------- */
  document.querySelectorAll('[data-acc]').forEach(function (acc) {
    acc.addEventListener('click', function (e) {
      var btn = e.target.closest('.acc__btn');
      if (!btn) return;
      var item = btn.closest('.acc__item');
      var open = !item.classList.contains('is-open');
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (window.ScrollTrigger) setTimeout(function () { ScrollTrigger.refresh(); }, 320);
    });
  });

  /* ---------- smooth scroll + anchors ---------- */
  var lenis = null;
  function scrollToEl(el) {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: -8, duration: 1.2 });
    else el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-scroll-to]');
    if (!a) return;
    var id = a.getAttribute('href');
    if (!id || id.charAt(0) !== '#') return;
    e.preventDefault();
    scrollToEl($(id));
  });

  var header = $('[data-header]');
  var steps = document.querySelectorAll('[data-step]');
  var stepImgs = document.querySelectorAll('[data-step-img]');
  function setStep(i) {
    steps.forEach(function (s) { s.classList.toggle('is-active', +s.getAttribute('data-step') === i); });
    stepImgs.forEach(function (s) { s.classList.toggle('is-active', +s.getAttribute('data-step-img') === i); });
  }
  function ready() { requestAnimationFrame(function () { root.classList.add('is-ready'); }); }

  if (!hasGsap) {
    ready();
    steps.forEach(function (s) { s.addEventListener('click', function () { setStep(+s.getAttribute('data-step')); }); });
    header.classList.add('is-solid');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  var isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  if (window.Lenis && !isTouch) {
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.9 });
    window.__perchScroll = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    new MutationObserver(function () {
      if (document.body.classList.contains('is-locked')) lenis.stop(); else lenis.start();
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  ScrollTrigger.create({ start: 40, end: 'max', onToggle: function (self) { header.classList.toggle('is-solid', self.isActive); } });

  // Hero: the portrait drifts and softly scales as you leave it.
  gsap.to('[data-hero-media] img', { scale: 1.08, yPercent: 6, ease: 'none', scrollTrigger: { trigger: '[data-hero]', start: 'top top', end: 'bottom top', scrub: true } });

  // Ritual: pinned; scrolling walks through the three steps.
  ScrollTrigger.create({
    trigger: '[data-ritual]', start: 'top top', end: '+=160%', pin: '.ritual__stage', anticipatePin: 1,
    onUpdate: function (self) { setStep(Math.min(2, Math.floor(self.progress * 3))); }
  });

  // Posture photo drifts slower than the page.
  gsap.fromTo('[data-parallax] img', { yPercent: -6 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '[data-parallax]', start: 'top bottom', end: 'bottom top', scrub: true } });

  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  ready();
})();

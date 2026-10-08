/* Checkout: validation, summary, payment (PayPal when configured, labelled test mode otherwise), confirmation. */
(function () {
  'use strict';

  var Perch = window.Perch;
  var cart = Perch.cart;
  var cfg = Perch.cfg;
  var money = Perch.money;
  var esc = Perch.esc;
  var $ = function (s, r) { return (r || document).querySelector(s); };

  var COUNTRIES = [['US', 'United States']];

  var emptyEl = $('[data-empty]');
  var mainEl = $('[data-main]');
  var confirmEl = $('[data-confirm]');
  var form = $('[data-form]');
  var payEl = $('[data-pay]');
  var payErr = $('[data-pay-error]');
  var done = false;

  /* ---------- country select ---------- */
  var sel = $('#f-country');
  sel.innerHTML = '<option value="">Select a country</option>' + COUNTRIES.map(function (c) { return '<option value="' + c[0] + '">' + c[1] + '</option>'; }).join('');

  /* ---------- summary ---------- */
  function lineRow(l) {
    var v = l.v;
    return '<li class="sum-line"><div class="sum-line__img"><img src="' + esc(v.image) + '" alt="" width="56" height="70"><span class="sum-line__qty" aria-label="Quantity ' + l.qty + '">' + l.qty + '</span></div>' +
      '<div><div class="sum-line__name">' + esc(v.name) + '</div><div class="sum-line__variant">' + esc(v.label) + '</div></div>' +
      '<div class="sum-line__price">' + money(Math.round(v.price * 100) * l.qty) + '</div></li>';
  }
  function totalsRows(t) {
    return '<div><dt>Subtotal</dt><dd>' + money(t.subtotal) + '</dd></div>' +
      (t.discount ? '<div><dt>Multi-buy discount (' + t.pct + '%)</dt><dd>-' + money(t.discount) + '</dd></div>' : '') +
      '<div><dt>Shipping</dt><dd>' + (t.shipping ? money(t.shipping) : 'Free') + '</dd></div>' +
      '<div class="is-total"><dt>Total</dt><dd>' + money(t.total) + '</dd></div>';
  }
  function renderSummary() {
    var ls = cart.lines();
    if (!ls.length && !done) { mainEl.hidden = true; emptyEl.hidden = false; return; }
    if (done) return;
    emptyEl.hidden = true; mainEl.hidden = false;
    var t = cart.totals();
    $('[data-sum-lines]').innerHTML = ls.map(lineRow).join('');
    $('[data-sum-totals]').innerHTML = totalsRows(t);
    $('[data-ship-price]').textContent = t.shipping ? money(t.shipping) : 'Free';
  }
  cart.onChange(renderSummary);

  /* ---------- validation ---------- */
  var rules = {
    email: function (v) { return !v ? 'Enter your email address.' : (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Enter a valid email address, like name@example.com.'); },
    firstName: function (v) { return v ? '' : 'Enter your first name.'; },
    lastName: function (v) { return v ? '' : 'Enter your last name.'; },
    country: function (v) { return v ? '' : 'Choose the country we are delivering to.'; },
    address1: function (v) { return v.length >= 3 ? '' : 'Enter the street and house number.'; },
    postal: function (v) { return v.length >= 3 ? '' : 'Enter your postal code.'; },
    city: function (v) { return v ? '' : 'Enter your city.'; }
  };
  var fieldMap = { email: 'email', firstName: 'first', lastName: 'last', country: 'country', address1: 'address', postal: 'postal', city: 'city' };

  function check(name, quiet) {
    var input = form.elements[name];
    var msg = rules[name](String(input.value || '').trim());
    var err = $('#e-' + fieldMap[name]);
    var wrap = input.closest('.field');
    wrap.classList.toggle('has-error', !!msg);
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (!quiet) { err.textContent = msg; err.hidden = !msg; }
    return msg;
  }
  function validateAll() {
    var first = null;
    Object.keys(rules).forEach(function (n) { if (check(n) && !first) first = form.elements[n]; });
    if (first) { first.focus(); first.scrollIntoView({ block: 'center', behavior: 'smooth' }); return false; }
    return true;
  }
  Object.keys(rules).forEach(function (n) {
    var el = form.elements[n];
    el.addEventListener('blur', function () { if (String(el.value).trim()) check(n); });
    el.addEventListener('input', function () { if (el.closest('.field').classList.contains('has-error')) check(n); });
    el.addEventListener('change', function () { check(n); });
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  /* ---------- order ---------- */
  function readCustomer() {
    var f = form.elements;
    var v = function (n) { return String(f[n].value || '').trim(); };
    return { email: v('email'), firstName: v('firstName'), lastName: v('lastName'), country: v('country'), address1: v('address1'), address2: v('address2'), postal: v('postal'), city: v('city'), phone: v('phone') };
  }
  function buildOrder(payment) {
    var t = cart.totals();
    return {
      id: 'PRC-' + String(Math.floor(100000 + Math.random() * 900000)),
      createdAt: new Date().toISOString(),
      currency: cfg.currency,
      customer: readCustomer(),
      lines: cart.lines().map(function (l) { return { sku: l.id.toUpperCase(), name: l.v.name, variant: l.v.label, cj: l.v.cj, qty: l.qty, unitPrice: l.v.price }; }),
      totals: { subtotal: t.subtotal / 100, discount: t.discount / 100, shipping: t.shipping / 100, total: t.total / 100 },
      payment: payment
    };
  }

  function storeLocally(order) {
    try {
      var all = JSON.parse(localStorage.getItem('perch.orders') || '[]');
      all.push(order);
      localStorage.setItem('perch.orders', JSON.stringify(all.slice(-20)));
    } catch (e) { /* ignore */ }
  }

  function sendOrder(order) {
    if (!cfg.orderEndpoint) return Promise.resolve(true);
    return fetch(cfg.orderEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(order) })
      .then(function (r) { return r.ok; })
      .catch(function () { return false; });
  }

  function complete(payment) {
    var order = buildOrder(payment);
    var summaryLines = cart.lines().map(lineRow).join('');
    var summaryTotals = totalsRows(cart.totals());
    storeLocally(order);
    return sendOrder(order).then(function (sent) {
      done = true;
      cart.clear();
      $('[data-confirm-name]').textContent = order.customer.firstName;
      $('[data-confirm-id]').textContent = order.id;
      $('[data-confirm-email]').textContent = order.customer.email;
      $('[data-confirm-lines]').innerHTML = summaryLines;
      $('[data-confirm-totals]').innerHTML = summaryTotals;
      mainEl.hidden = true; emptyEl.hidden = true; confirmEl.hidden = false;
      document.title = 'Order confirmed | ' + cfg.name;
      window.scrollTo(0, 0);
      confirmEl.focus({ preventScroll: true });
      if (!sent) {
        var p = document.createElement('p');
        p.className = 'pay-test__note';
        p.textContent = 'Your order is saved, but we could not send the details automatically. Please email ' + cfg.email + ' with your order number ' + order.id + '.';
        confirmEl.insertBefore(p, confirmEl.children[2]);
      }
    });
  }

  /* ---------- payment ---------- */
  function showPayError(msg) { payErr.textContent = msg; payErr.hidden = !msg; }

  function renderTestPay() {
    payEl.innerHTML = '<div class="pay-test"><p class="pay-test__note">Test mode: no payment is taken and no card is needed. To accept real payments, add your PayPal client ID in tools/store.config.json and rebuild.</p>' +
      '<button class="btn btn--primary" type="button" data-place>Place order (test)</button></div>';
    $('[data-place]').addEventListener('click', function (e) {
      showPayError('');
      if (!validateAll()) return;
      var b = e.currentTarget; b.disabled = true; b.textContent = 'Placing order';
      complete({ method: 'test', id: 'TEST' });
    });
  }

  function paypalOrderPayload() {
    var t = cart.totals();
    var c = readCustomer();
    var cur = cfg.currency;
    var val = function (n) { return (n / 100).toFixed(2); };
    return {
      intent: 'CAPTURE',
      purchase_units: [{
        description: cfg.name + ' order',
        amount: {
          currency_code: cur, value: val(t.total),
          breakdown: {
            item_total: { currency_code: cur, value: val(t.subtotal) },
            shipping: { currency_code: cur, value: val(t.shipping) },
            discount: { currency_code: cur, value: val(t.discount) }
          }
        },
        items: cart.lines().map(function (l) {
          return { name: (l.v.name + " - " + l.v.label).slice(0, 127), sku: l.id.toUpperCase(), unit_amount: { currency_code: cur, value: l.v.price.toFixed(2) }, quantity: String(l.qty) };
        }),
        shipping: {
          name: { full_name: c.firstName + ' ' + c.lastName },
          address: { address_line_1: c.address1, address_line_2: c.address2 || undefined, admin_area_2: c.city, postal_code: c.postal, country_code: c.country }
        }
      }],
      application_context: { shipping_preference: 'SET_PROVIDED_ADDRESS', user_action: 'PAY_NOW' }
    };
  }

  function renderPayPal() {
    payEl.innerHTML = '<div id="paypal-buttons" aria-label="Pay with PayPal or card"></div><p class="field__hint" style="margin-top:12px">You pay on PayPal\'s secure page. You do not need a PayPal account to pay by card.</p>';
    var s = document.createElement('script');
    s.src = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(cfg.paypalClientId) + '&currency=' + encodeURIComponent(cfg.currency) + '&intent=capture&components=buttons';
    s.onload = function () {
      window.paypal.Buttons({
        style: { layout: 'vertical', shape: 'rect', label: 'pay', height: 48 },
        onClick: function (data, actions) { showPayError(''); return validateAll() ? actions.resolve() : actions.reject(); },
        createOrder: function (data, actions) { return actions.order.create(paypalOrderPayload()); },
        onApprove: function (data, actions) {
          return actions.order.capture().then(function (d) { return complete({ method: 'paypal', id: d.id }); });
        },
        onError: function () { showPayError('The payment could not be completed. You have not been charged. Please try again or use another method.'); }
      }).render('#paypal-buttons');
    };
    s.onerror = function () { payEl.innerHTML = ''; showPayError('Payment options could not load. Check your connection and refresh the page.'); };
    document.head.appendChild(s);
  }

  if (cart.count() > 0) { cfg.paypalClientId ? renderPayPal() : renderTestPay(); }
  renderSummary();
})();

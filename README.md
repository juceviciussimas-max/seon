# Seon store

Static one-product store (V-line strap and posture belt). Plain HTML, CSS and JS, so it runs on GitHub Pages with no server and no domain.

## Preview locally

```bash
cd perch-store
python3 -m http.server 8000
# open http://localhost:8000
```

## Change anything

All settings live in two files. After editing, rebuild (needs Node, nothing to install):

```bash
node tools/build.mjs
```

| File | What it controls |
| --- | --- |
| `tools/store.config.json` | Store name, support email, legal name and address, shipping price, free-shipping threshold, delivery estimate, multi-buy discounts, PayPal client ID, order webhook |
| `tools/catalog.json` | Colours, sizes, prices, gallery photos |
| `tools/src/*.html` | The text of every page |
| `assets/css/style.css` | Design |

## Deploy on GitHub Pages (free, no domain)

```bash
brew install gh          # one time
gh auth login            # one time, follow the browser prompts
cd perch-store
gh repo create perch-store --public --source=. --push
gh api -X POST repos/:owner/perch-store/pages -f "source[branch]=main" -f "source[path]=/"
```

The site goes live in about a minute at `https://<your-username>.github.io/perch-store/`. Put that URL in `siteUrl` in `tools/store.config.json` and rebuild.

Without the command line: create a public repo on github.com, upload the contents of this folder, then Settings > Pages > Deploy from branch > `main` / root.

## Take real payments

The checkout runs in labelled **test mode** until you add a PayPal client ID. Test mode takes no money.

1. Create a PayPal Business account and an app at developer.paypal.com (Apps & Credentials, Live).
2. Copy the **Client ID** into `paypalClientId` in `tools/store.config.json`.
3. Run `node tools/build.mjs`, push. PayPal buttons now replace the test button. Buyers can pay by PayPal or card.

## Receive order details

A static site has no database. Orders are sent to a webhook you choose:

1. Make a free form at formspree.io and copy its endpoint URL.
2. Paste it into `orderEndpoint` in `tools/store.config.json`, rebuild, push.
3. Each order arrives by email with the customer, address, items and totals.

Until then, orders are only saved in the buyer's own browser.

## Fulfilling an order (AliExpress)

Order codes in the email map to the supplier's options:

| Order shows | Order on AliExpress |
| --- | --- |
| GRAY-S / BEIGE-S | Gray S / Beige S (2 shelves, 70 cm) |
| GRAY-M / BEIGE-M | Gray M / Beige M (3 shelves, 95 cm) |
| GRAY-L / BEIGE-L | Gray L / Beige L (4 shelves, 120 cm) |

Ship to the customer's address, then email them the tracking link.

## Before you launch

- Replace the placeholders in `tools/store.config.json`: `email`, `legalName`, `legalAddress`, `vatId`. They appear in the footer, privacy and terms pages.
- Read the shipping, returns, privacy and terms pages and check they match how you really operate. They are a sensible starting point, not legal advice.
- The product photos come from the supplier's listing. Order a sample and replace them with your own photos before running ads, or confirm you have the right to use them.
- There are no customer reviews on purpose. Add real ones after real orders. Fake or copied reviews are illegal in the EU and US.

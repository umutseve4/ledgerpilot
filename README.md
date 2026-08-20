# LedgerPilot — invoicing that pays for itself

[![CI](https://github.com/umutseve4/ledgerpilot/actions/workflows/ci.yml/badge.svg)](https://github.com/umutseve4/ledgerpilot/actions/workflows/ci.yml)

**A freemium invoicing & client-management SaaS for freelancers, built as a zero-dependency browser app.** Create professional invoices, track clients and expenses, see profit and tax reports, and export everything — all data stays in your browser.

> Built in a 1-hour "$1M App" challenge: not a landing-page mockup, but a working vertical slice of a real SaaS product with an honest, product-appropriate monetization model.

---

## 🚀 Run it (10 seconds)

No build step, no dependencies. Either:

```bash
git clone https://github.com/umutseve4/ledgerpilot && cd ledgerpilot
python3 -m http.server 8080   # or just double-click index.html
```

Open http://localhost:8080 in Chrome. Click **"Load demo data"** in the top bar to explore a populated workspace instantly.

**Demo checkout card:** `4242 4242 4242 4242`, any future expiry, any CVC.

---

## 💰 The business model (and why it fits)

LedgerPilot uses a **freemium subscription** — the proven model of Bonsai, FreshBooks and Invoice Ninja:

| | Free | Pro ($12/mo or $96/yr ≈ $8/mo) |
|---|---|---|
| Invoices | **3 / month** | Unlimited |
| Clients & expenses | Unlimited | Unlimited |
| Invoice PDF | With LedgerPilot branding | **No branding** |
| Reports, profit & tax summary | — | ✓ |
| CSV export for accountants | — | ✓ |

**Why this model is the right one for this product:**

1. **The quota sits exactly on the value moment.** A freelancer who sends a 4th invoice in a month has, by definition, real revenue — $12 against hundreds or thousands of dollars invoiced is an easy yes. The paywall converts precisely when willingness to pay peaks.
2. **Free tier is genuinely useful**, so it drives word-of-mouth (and the branded invoice footer is a built-in acquisition channel — every free invoice markets the product to another business owner).
3. **Recurring revenue matches recurring value.** Invoicing is a monthly ritual; a subscription mirrors the usage pattern. Annual billing (−33%) improves cash flow and retention.
4. **Reports/tax-export gating targets the second willingness-to-pay spike:** tax season.

Unit economics sketch: at a 3–5% free→paid conversion (industry norm for prosumer SaaS) and ~$110 average annual revenue per paying user, 10k signups/mo ≈ $400–650k ARR run-rate after year one — the path to a seven-figure valuation for a product in this category.

---

## ✨ Features (all implemented & tested)

- **Onboarding** — 30-second setup (name, email, currency), no account required
- **Dashboard** — revenue/outstanding/overdue KPIs, 6-month revenue chart (hand-rolled canvas, DPI-aware), "needs attention" overdue list with reminder action
- **Invoices** — full editor with dynamic line items, live totals, tax & discount, statuses (draft → sent → paid, auto-**overdue** past due date), print-to-PDF via `window.print()`
- **Clients** — CRUD with per-client lifetime revenue
- **Expenses** — categorized cost tracking feeding net-profit reporting
- **Reports (Pro)** — revenue trend, net profit, top clients, collected-tax summary, CSV export (with CSV-injection sanitization)
- **Monetization** — quota enforcement, feature gates, paywall with monthly/annual toggle, simulated Stripe-style checkout (Luhn card validation, live card preview), subscription management & cancellation
- **Data** — everything in `localStorage`; JSON backup export; full reset. **Privacy is a feature: nothing leaves your device.**

---

## 🏗 Architecture

```
index.html      app shell: sidebar, topbar, onboarding, modal root, print area
css/app.css     design system + @media print styles for PDF invoices
js/store.js     data layer — state, persistence, totals, quotas, demo seed
js/billing.js   monetization — plans, quota rules, simulated payments
js/app.js       UI layer — views, router, modals, canvas chart, paywall
test/smoke.js   headless smoke tests (node test/smoke.js)
```

Deliberate choices:

- **Vanilla JS, zero dependencies, no build step** — instant load, no supply-chain risk, trivially auditable.
- **Strict layering:** `store.js` and `billing.js` know nothing about the DOM — which is what makes them testable headlessly in Node.
- **XSS-safe rendering:** every user string passes through `esc()` before `innerHTML` interpolation.
- **Honest demo:** the checkout explicitly says no real charge is made; in production the payment call is a single function swap to Stripe.

## ✅ Tests

```bash
node test/smoke.js
# ===== OTOMATIK KONTROL =====
# PASS: 14 FAIL: 0 => PASS
```

Covers: invoice math (subtotal/discount/tax/total), free-quota enforcement, auto-overdue status, payment validation (valid + rejected card), plan lifecycle (upgrade → cancel), demo-data integrity.

Continuous integration: every push and PR runs the smoke suite on GitHub Actions (see badge above).

## ⚠️ Known limitations (honest scope)

- Payments are **simulated** — production needs Stripe + a thin backend for webhooks/receipts.
- Data is per-browser (`localStorage`); multi-device sync requires a backend (the natural Pro-tier server feature).
- Email sending (invoice delivery, reminders) is stubbed as toasts.
- No multi-user/team accounts.

## 📄 License

MIT — see [LICENSE](LICENSE).

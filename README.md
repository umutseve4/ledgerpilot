# LedgerPilot — invoicing that pays for itself

[![CI](https://github.com/umutseve4/ledgerpilot/actions/workflows/ci.yml/badge.svg)](https://github.com/umutseve4/ledgerpilot/actions/workflows/ci.yml)

**A freemium invoicing & client-management SaaS prototype for freelancers, built as a browser app with no npm package manifest or package-install step.** Create invoices, track clients and expenses, see profit and tax reports, and export data — application state stays in browser `localStorage`.

> Built in a 1-hour "$1M App" challenge as a working vertical slice with an illustrative freemium model. It is a portfolio prototype, not a production billing service.

---

## 🚀 Run it (10 seconds)

No build step or package install is required. Either:

```bash
git clone https://github.com/umutseve4/ledgerpilot && cd ledgerpilot
python3 -m http.server 8080   # or just double-click index.html
```

Open http://localhost:8080 in Chrome. Click **"Load demo data"** in the top bar to explore a populated workspace instantly.

**Demo checkout card:** `4242 4242 4242 4242`, any future expiry, any CVC. The checkout is simulated and never makes a real charge.

---

## 💰 Illustrative business model

LedgerPilot demonstrates a **freemium subscription**:

| | Free | Pro ($12/mo or $96/yr ≈ $8/mo) |
|---|---|---|
| Invoices | **3 / month** | Unlimited |
| Clients & expenses | Unlimited | Unlimited |
| Invoice PDF | With LedgerPilot branding | **No branding** |
| Reports, profit & tax summary | — | ✓ |
| CSV export for accountants | — | ✓ |

The product logic places the quota at the fourth monthly invoice and gates reports/tax export behind the simulated Pro tier. Pricing, conversion, retention, and valuation have not been validated with real customers; the figures above are product assumptions for the prototype.

---

## ✨ Implemented features

- **Onboarding** — local setup (name, email, currency), no account required
- **Dashboard** — revenue/outstanding/overdue KPIs, 6-month revenue chart, and an overdue list with reminder action
- **Invoices** — editor with dynamic line items, live totals, tax & discount, statuses (draft → sent → paid, auto-**overdue** past due date), print-to-PDF via `window.print()`
- **Clients** — CRUD with per-client lifetime revenue
- **Expenses** — categorized cost tracking feeding net-profit reporting
- **Reports (Pro)** — revenue trend, net profit, top clients, collected-tax summary, CSV export with CSV-injection sanitization
- **Monetization demo** — quota enforcement, feature gates, paywall, monthly/annual toggle, simulated checkout with Luhn validation, and local subscription cancellation
- **Data** — `localStorage`, JSON backup export, and full reset

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

- **Vanilla JS with no package manifest or build step** — no npm runtime/build packages are installed. The app still relies on browser platform APIs such as `localStorage`, canvas, and `window.print()`.
- **Layering:** `store.js` and `billing.js` know nothing about the DOM, enabling headless Node checks.
- **Rendering:** user strings are routed through the app's `esc()` helper before the documented `innerHTML` interpolation paths.
- **Honest demo:** the checkout says no real charge is made. A production payment integration would also require a backend, secure secrets handling, webhooks, receipts, authentication, authorization, monitoring, and operational controls.

## ✅ Automated validation

```bash
node test/smoke.js
# ===== OTOMATIK KONTROL =====
# PASS: 14 FAIL: 0 => PASS
```

The current smoke source contains **14 headless assertions** covering store and billing behavior: invoice math, free-quota enforcement, auto-overdue status, simulated payment validation, local plan lifecycle, and demo-data integrity.

GitHub Actions runs this suite on pushes to `main`, pull requests, and manual dispatch with Node.js `20`.

**Validation boundary:** these checks execute `js/store.js` and `js/billing.js` in a Node VM without a DOM. They do not prove browser rendering, accessibility, end-to-end UI behavior, real PDF output, real email delivery, payment processing, backend security, multi-user isolation, or production readiness.

## ⚠️ Known limitations

- Payments are **simulated**; there is no Stripe integration or real payment backend.
- Data is per-browser (`localStorage`); there is no server-side persistence or multi-device sync.
- Email sending (invoice delivery, reminders) is represented by local UI toasts.
- There are no multi-user/team accounts, authentication, authorization, audit logs, or production monitoring.
- Browser/GPU/UI behavior requires separate end-to-end and manual validation.

## 📄 License

MIT — see [LICENSE](LICENSE).

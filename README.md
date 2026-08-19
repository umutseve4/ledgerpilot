# LedgerPilot — Invoicing & Client Management for Freelancers

> Get paid faster. Look professional. Know your numbers.

LedgerPilot is a browser-based invoicing and client-management SaaS for freelancers and micro-agencies. It runs 100% client-side in Chrome — no build step, no backend, no dependencies — while modeling a complete, realistic freemium business.

## Why this is a real business

Freelancing is a growing market and every freelancer must invoice to get paid. Proven comparables (Bonsai, FreshBooks, Invoice Ninja, Wave) monetize exactly this workflow. LedgerPilot follows the same playbook:

| | Free | Pro ($12/mo or $96/yr) |
|---|---|---|
| Invoices | **3 per month** | Unlimited |
| Clients & expenses | Unlimited | Unlimited |
| Invoice branding | "Made with LedgerPilot" footer | Removed |
| Reports (P&L, top clients, tax summary) | Locked | ✔ |
| CSV export | Locked | ✔ |

The paywall is enforced **where the value is**: the moment a freelancer sends their 4th invoice of the month, they've proven the product works for them — that's the natural upgrade point (activation-based monetization, not a nag screen).

## Features

- **Dashboard** — KPIs (paid, outstanding, overdue, drafts), 6-month revenue chart (hand-rolled canvas), "needs attention" overdue list with one-click reminders
- **Invoices** — line-item editor with live totals, discount & tax, statuses (draft → sent → paid, auto-overdue past due date), print-to-PDF via native print styles
- **Clients** — CRUD with per-client billing history
- **Expenses** — quick capture with categories
- **Reports (Pro)** — revenue vs expenses, net profit, top clients, tax collected, CSV export (with CSV-injection sanitization)
- **Billing** — full simulated Stripe-style checkout: plan toggle (monthly/annual), live card preview, Luhn validation, test card `4242 4242 4242 4242`, subscription manage/cancel
- **Data** — everything in `localStorage` (privacy: your data never leaves the device), JSON backup/restore, one-click demo dataset

## Run it

```bash
git clone https://github.com/umutseve4/ledgerpilot && cd ledgerpilot
python3 -m http.server 8000   # or any static server — or just open index.html
```

Open http://localhost:8000 in Chrome. Click **"Load demo data"** on the top bar to explore with realistic data.

## Architecture

```
index.html      app shell + onboarding
css/app.css     design system, print styles for invoice PDF
js/store.js     data layer — localStorage, totals, statuses, quotas, demo data
js/billing.js   monetization — plans, quota gate, simulated payment (Luhn)
js/app.js       UI — views, router, modals, canvas chart, paywall, checkout
```

Vanilla JS, zero dependencies. Load order matters: `store → billing → app`.

## Honest limitations

- Checkout is **simulated** (clearly labeled in-app). Production would swap `Billing.processPayment` for Stripe Checkout + a webhook-backed entitlement service.
- Single-device storage; production needs a synced backend (PostgreSQL + auth).
- "Recurring invoices" is listed as a Pro feature but not implemented in this MVP.
- Tested: JS logic (headless smoke tests for totals, quota, payment validation, plan lifecycle) and asset serving. UI verified by code review, not automated E2E.

## License

MIT — see [LICENSE](LICENSE).

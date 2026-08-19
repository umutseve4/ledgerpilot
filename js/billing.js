/* =========================================================
   LedgerPilot — Monetization layer (freemium SaaS)

   Business model:
   - Free:  3 invoices / month, unlimited clients, basic dashboard.
   - Pro:   $12/mo or $96/yr (save 33%): unlimited invoices,
            reports & tax summary, recurring invoices, no branding,
            CSV export.
   The paywall is enforced at the action level (quota check on
   invoice creation, feature gates on reports/export/recurring).
   Checkout is a simulated Stripe-style flow — in production the
   confirm step would call a payment provider; the rest of the
   code is production-shaped.
   ========================================================= */
"use strict";

const Billing = (() => {
  const PLANS = {
    monthly: { price: 12, label: "$12", per: "/month", cycle: "monthly" },
    annual:  { price: 96, label: "$96", per: "/year",  cycle: "annual", monthlyEq: 8 }
  };
  const FREE_QUOTA = 3;

  /** Can the user create one more invoice this month? */
  function canCreateInvoice() {
    if (Store.isPro()) return { ok: true };
    const used = Store.invoicesThisMonth();
    if (used >= FREE_QUOTA) return { ok: false, used, quota: FREE_QUOTA };
    return { ok: true, used, quota: FREE_QUOTA };
  }

  /** Feature gates for Pro-only capabilities */
  function gate(feature) {
    if (Store.isPro()) return true;
    return false;
  }

  const PRO_FEATURES = [
    "Unlimited invoices",
    "Income & tax reports",
    "Recurring invoices for retainers",
    "CSV export of all data",
    "Remove LedgerPilot branding from invoices",
    "Priority support"
  ];

  const FREE_FEATURES = [
    "3 invoices per month",
    "Unlimited clients",
    "Basic dashboard",
    "PDF-ready invoices (with branding)"
  ];

  /* ------- simulated checkout ------- */
  function luhnValid(num) {
    const s = num.replace(/\D/g, "");
    if (s.length < 13) return false;
    let sum = 0, dbl = false;
    for (let i = s.length - 1; i >= 0; i--) {
      let d = +s[i];
      if (dbl) { d *= 2; if (d > 9) d -= 9; }
      sum += d; dbl = !dbl;
    }
    return sum % 10 === 0;
  }

  /**
   * Simulate a payment confirmation. Resolves after a short delay
   * to mimic a provider round-trip; validates card shape locally.
   * (Test card: 4242 4242 4242 4242)
   */
  function processPayment({ card, exp, cvc, name, cycle }) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!name || name.trim().length < 2) return reject(new Error("Cardholder name is required."));
        if (!luhnValid(card)) return reject(new Error("Card number failed validation. Try 4242 4242 4242 4242 for demo."));
        if (!/^\d{2}\s*\/\s*\d{2}$/.test(exp)) return reject(new Error("Expiry must be MM/YY."));
        const [mm, yy] = exp.split("/").map(s => parseInt(s.trim(), 10));
        if (mm < 1 || mm > 12) return reject(new Error("Invalid expiry month."));
        const now = new Date();
        if (2000 + yy < now.getFullYear() || (2000 + yy === now.getFullYear() && mm < now.getMonth() + 1))
          return reject(new Error("Card is expired."));
        if (!/^\d{3,4}$/.test(cvc)) return reject(new Error("Invalid CVC."));
        Store.setPlan("pro", cycle);
        resolve({ tier: "pro", cycle });
      }, 900);
    });
  }

  function cancelPro() { Store.setPlan("free", null); }

  return { PLANS, FREE_QUOTA, PRO_FEATURES, FREE_FEATURES, canCreateInvoice, gate, processPayment, cancelPro };
})();

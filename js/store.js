/* =========================================================
   LedgerPilot — Data layer (localStorage-backed store)
   All user data stays on-device. Single source of truth.
   ========================================================= */
"use strict";

const Store = (() => {
  const KEY = "ledgerpilot.v1";

  const defaults = () => ({
    profile: null,                 // {name, email, currency, taxId, address}
    plan: { tier: "free", cycle: null, since: null, renewsAt: null },
    clients: [],                   // {id, name, email, company, address, createdAt}
    invoices: [],                  // {id, number, clientId, issueDate, dueDate, items[], taxRate, discount, status, notes, paidAt, createdAt}
    expenses: [],                  // {id, date, category, description, amount}
    seq: { invoice: 1, client: 1 },
    meta: { createdAt: new Date().toISOString() }
  });

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const parsed = JSON.parse(raw);
      return Object.assign(defaults(), parsed);
    } catch (e) {
      console.error("Store load failed, resetting.", e);
      return defaults();
    }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.error("Store save failed", e); }
  }

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  /* ---------- profile ---------- */
  function setProfile(p) { state.profile = { ...(state.profile || {}), ...p }; save(); }

  /* ---------- clients ---------- */
  function addClient(c) {
    const client = { id: uid(), createdAt: new Date().toISOString(), ...c };
    state.clients.push(client); save(); return client;
  }
  function updateClient(id, patch) {
    const c = state.clients.find(x => x.id === id);
    if (c) { Object.assign(c, patch); save(); }
    return c;
  }
  function deleteClient(id) {
    state.clients = state.clients.filter(c => c.id !== id);
    save();
  }
  const getClient = id => state.clients.find(c => c.id === id) || null;

  /* ---------- invoices ---------- */
  function nextInvoiceNumber() {
    const n = state.seq.invoice;
    return "INV-" + String(n).padStart(4, "0");
  }
  function addInvoice(inv) {
    const invoice = {
      id: uid(),
      number: nextInvoiceNumber(),
      status: "draft",
      createdAt: new Date().toISOString(),
      paidAt: null,
      ...inv
    };
    state.invoices.push(invoice);
    state.seq.invoice += 1;
    save();
    return invoice;
  }
  function updateInvoice(id, patch) {
    const i = state.invoices.find(x => x.id === id);
    if (i) { Object.assign(i, patch); save(); }
    return i;
  }
  function deleteInvoice(id) {
    state.invoices = state.invoices.filter(i => i.id !== id);
    save();
  }
  const getInvoice = id => state.invoices.find(i => i.id === id) || null;

  function invoiceTotals(inv) {
    const sub = inv.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
    const discount = sub * ((Number(inv.discount) || 0) / 100);
    const taxable = sub - discount;
    const tax = taxable * ((Number(inv.taxRate) || 0) / 100);
    return { sub, discount, tax, total: taxable + tax };
  }

  /** effective status: auto-flag overdue */
  function effStatus(inv) {
    if (inv.status === "sent" && inv.dueDate && new Date(inv.dueDate) < startOfToday()) return "overdue";
    return inv.status;
  }
  function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }

  /** invoices created in current calendar month (for free-plan quota) */
  function invoicesThisMonth() {
    const now = new Date();
    return state.invoices.filter(i => {
      const d = new Date(i.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }

  /* ---------- expenses ---------- */
  function addExpense(e) {
    const exp = { id: uid(), createdAt: new Date().toISOString(), ...e };
    state.expenses.push(exp); save(); return exp;
  }
  function deleteExpense(id) { state.expenses = state.expenses.filter(e => e.id !== id); save(); }

  /* ---------- plan ---------- */
  function setPlan(tier, cycle) {
    const now = new Date();
    const renews = new Date(now);
    if (cycle === "annual") renews.setFullYear(renews.getFullYear() + 1);
    else renews.setMonth(renews.getMonth() + 1);
    state.plan = { tier, cycle: cycle || null, since: now.toISOString(), renewsAt: tier === "pro" ? renews.toISOString() : null };
    save();
  }
  const isPro = () => state.plan.tier === "pro";

  /* ---------- analytics helpers ---------- */
  function monthlyRevenue(monthsBack = 6) {
    const out = [];
    const now = new Date();
    for (let k = monthsBack - 1; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      const label = d.toLocaleString("en", { month: "short" });
      const sum = state.invoices
        .filter(i => i.status === "paid" && i.paidAt)
        .filter(i => { const p = new Date(i.paidAt); return p.getFullYear() === d.getFullYear() && p.getMonth() === d.getMonth(); })
        .reduce((s, i) => s + invoiceTotals(i).total, 0);
      out.push({ label, value: sum });
    }
    return out;
  }

  function stats() {
    const totals = { paid: 0, outstanding: 0, overdue: 0, drafts: 0 };
    for (const inv of state.invoices) {
      const t = invoiceTotals(inv).total;
      const st = effStatus(inv);
      if (st === "paid") totals.paid += t;
      else if (st === "overdue") { totals.overdue += t; totals.outstanding += t; }
      else if (st === "sent" || st === "partial") totals.outstanding += t;
      else if (st === "draft") totals.drafts += 1;
    }
    return totals;
  }

  /* ---------- demo data ---------- */
  function loadDemo() {
    const names = [
      ["Acme Studios", "billing@acmestudios.com", "Acme Studios LLC"],
      ["Nova Digital", "accounts@novadigital.io", "Nova Digital Ltd"],
      ["Kaya Consulting", "finance@kayaconsult.com", "Kaya Consulting"],
      ["BrightWeb Agency", "pay@brightweb.co", "BrightWeb Co"]
    ];
    const clients = names.map(([name, email, company]) => addClient({ name, email, company, address: "" }));
    const svc = [
      ["Landing page design", 1, 850], ["React development (hrs)", 24, 60],
      ["Brand identity package", 1, 1200], ["Monthly retainer — maintenance", 1, 400],
      ["API integration", 1, 950], ["SEO audit & report", 1, 300]
    ];
    const now = new Date();
    for (let m = 5; m >= 0; m--) {
      const count = m === 0 ? 2 : 1 + (m % 2);
      for (let j = 0; j < count; j++) {
        const c = clients[(m + j) % clients.length];
        const created = new Date(now.getFullYear(), now.getMonth() - m, 3 + j * 9);
        const due = new Date(created); due.setDate(due.getDate() + 14);
        const pick = svc[(m * 2 + j) % svc.length];
        const inv = addInvoice({
          clientId: c.id,
          issueDate: created.toISOString().slice(0, 10),
          dueDate: due.toISOString().slice(0, 10),
          items: [{ desc: pick[0], qty: pick[1], rate: pick[2] }],
          taxRate: 10, discount: 0, notes: "Payment via bank transfer. Thank you!"
        });
        inv.createdAt = created.toISOString();
        if (m >= 1) { inv.status = "paid"; inv.paidAt = new Date(created.getTime() + 6 * 864e5).toISOString(); }
        else if (j === 0) { inv.status = "sent"; }
        else { inv.status = "sent"; inv.dueDate = new Date(now.getTime() - 5 * 864e5).toISOString().slice(0, 10); }
      }
    }
    ["Software subscriptions|Software|49", "Coworking desk|Office|180", "Stock photos|Assets|25", "Accountant fee|Services|120"]
      .forEach((row, i) => {
        const [description, category, amount] = row.split("|");
        const d = new Date(now.getFullYear(), now.getMonth(), 2 + i * 5);
        addExpense({ date: d.toISOString().slice(0, 10), category, description, amount: Number(amount) });
      });
    save();
  }

  function resetAll() { state = defaults(); save(); }

  return {
    get state() { return state; },
    save, setProfile,
    addClient, updateClient, deleteClient, getClient,
    addInvoice, updateInvoice, deleteInvoice, getInvoice,
    invoiceTotals, effStatus, invoicesThisMonth, nextInvoiceNumber,
    addExpense, deleteExpense,
    setPlan, isPro,
    monthlyRevenue, stats,
    loadDemo, resetAll
  };
})();

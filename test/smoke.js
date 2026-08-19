// Headless smoke tests — run: node test/smoke.js (from repo root)
global.localStorage = { _d:{}, getItem(k){return this._d[k]||null}, setItem(k,v){this._d[k]=v}, removeItem(k){delete this._d[k]} };
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const ctx = vm.createContext({ localStorage: global.localStorage, console, setTimeout, Date, Math, JSON });
for (const f of ["js/store.js", "js/billing.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
}
const { Store, Billing } = vm.runInContext("({ Store, Billing })", ctx);

let pass = 0, fail = 0;
const t = (name, cond) => { cond ? pass++ : (fail++, console.log("FAIL:", name)); };

Store.setProfile({ name: "Test", email: "t@t.com", currency: "USD" });
const c = Store.addClient({ name: "C1", email: "c@c.com" });
const inv = Store.addInvoice({ clientId: c.id, issueDate: "2026-01-01", dueDate: "2026-01-15", items: [{ desc: "X", qty: 2, rate: 100 }], taxRate: 10, discount: 10 });
const tot = Store.invoiceTotals(inv);
t("totals sub=200", tot.sub === 200);
t("totals discount=20", tot.discount === 20);
t("totals tax=18", Math.abs(tot.tax - 18) < 1e-9);
t("totals total=198", Math.abs(tot.total - 198) < 1e-9);
t("quota counts 1", Store.invoicesThisMonth() === 1);
Store.addInvoice({ clientId: c.id, issueDate: "2026-01-01", dueDate: "2026-01-15", items: [], taxRate: 0, discount: 0 });
Store.addInvoice({ clientId: c.id, issueDate: "2026-01-01", dueDate: "2026-01-15", items: [], taxRate: 0, discount: 0 });
t("free quota blocks 4th invoice", Billing.canCreateInvoice().ok === false);
Store.updateInvoice(inv.id, { status: "sent", dueDate: "2020-01-01" });
t("auto overdue", Store.effStatus(Store.getInvoice(inv.id)) === "overdue");

Billing.processPayment({ card: "4242 4242 4242 4242", exp: "12/30", cvc: "123", name: "Umut", cycle: "annual" }).then(r => {
  t("payment resolves pro", r.tier === "pro");
  t("pro unlocks quota", Billing.canCreateInvoice().ok === true);
  Billing.cancelPro();
  t("cancel returns to free", Store.isPro() === false);
  return Billing.processPayment({ card: "1234", exp: "12/30", cvc: "123", name: "X", cycle: "monthly" })
    .then(() => t("bad card should reject", false), () => t("bad card rejected", true));
}).then(() => {
  Store.resetAll(); Store.loadDemo();
  t("demo: 4 clients", Store.state.clients.length === 4);
  t("demo: >5 invoices", Store.state.invoices.length > 5);
  t("demo: revenue nonzero", Store.monthlyRevenue(6).some(m => m.value > 0));
  console.log("===== OTOMATIK KONTROL =====");
  console.log("PASS:", pass, "FAIL:", fail, fail === 0 ? "=> PASS" : "=> FAIL");
  process.exit(fail === 0 ? 0 : 1);
});

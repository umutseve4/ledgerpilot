/* =========================================================
   LedgerPilot — UI layer (views, routing, modals, charts)
   ========================================================= */
"use strict";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const CUR = { USD: "$", EUR: "€", GBP: "£", TRY: "₺" };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtMoney = n => {
  const cur = Store.state.profile?.currency || "USD";
  return (CUR[cur] || "$") + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtDate = d => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function toast(msg, kind = "ok") {
  const el = document.createElement("div");
  el.className = "toast " + kind;
  el.textContent = msg;
  $("#toastWrap").appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* ===================== MODAL ===================== */
const Modal = {
  open(html, wide = false) {
    $("#modalBox").className = "modal" + (wide ? " wide" : "");
    $("#modalBox").innerHTML = html;
    $("#modalBackdrop").classList.remove("hidden");
    $$(".modal-x").forEach(b => b.onclick = Modal.close);
  },
  close() { $("#modalBackdrop").classList.add("hidden"); $("#modalBox").innerHTML = ""; }
};
$("#modalBackdrop").addEventListener("click", e => { if (e.target.id === "modalBackdrop") Modal.close(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") Modal.close(); });

/* ===================== CHART (vanilla canvas) ===================== */
function drawBarChart(canvas, data) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height, padB = 26, padL = 8, padT = 10;
  const max = Math.max(...data.map(d => d.value), 1);
  const n = data.length, gap = 18;
  const bw = Math.min(56, (W - padL * 2 - gap * (n - 1)) / n);
  const totalW = bw * n + gap * (n - 1);
  const x0 = (W - totalW) / 2;
  ctx.clearRect(0, 0, W, H);
  // gridlines
  ctx.strokeStyle = "#eceef6"; ctx.lineWidth = 1;
  for (let g = 1; g <= 3; g++) {
    const y = padT + (H - padB - padT) * g / 4;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  data.forEach((d, i) => {
    const h = (H - padB - padT) * (d.value / max);
    const x = x0 + i * (bw + gap), y = H - padB - h;
    const grad = ctx.createLinearGradient(0, y, 0, H - padB);
    grad.addColorStop(0, "#6d63ff"); grad.addColorStop(1, "#4f46e5");
    ctx.fillStyle = d.value > 0 ? grad : "#e5e7f0";
    const r = 6, hh = Math.max(h, 4);
    ctx.beginPath();
    ctx.roundRect(x, H - padB - hh, bw, hh, [r, r, 0, 0]);
    ctx.fill();
    ctx.fillStyle = "#6b7280"; ctx.font = "11px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(d.label, x + bw / 2, H - 8);
    if (d.value > 0) {
      ctx.fillStyle = "#374151"; ctx.font = "600 10.5px sans-serif";
      ctx.fillText(shortMoney(d.value), x + bw / 2, H - padB - hh - 5);
    }
  });
}
const shortMoney = n => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(Math.round(n));

/* ===================== VIEWS ===================== */
let currentView = "dashboard";

const VIEW_TITLES = {
  dashboard: "Dashboard", invoices: "Invoices", clients: "Clients",
  expenses: "Expenses", reports: "Reports", settings: "Settings"
};

function navigate(view) {
  currentView = view;
  $$(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  $("#viewTitle").textContent = VIEW_TITLES[view];
  render();
}

function render() {
  refreshSidebar();
  const c = $("#viewContainer");
  switch (currentView) {
    case "dashboard": c.innerHTML = viewDashboard(); afterDashboard(); break;
    case "invoices":  c.innerHTML = viewInvoices(); bindInvoiceRows(); break;
    case "clients":   c.innerHTML = viewClients(); bindClientRows(); break;
    case "expenses":  c.innerHTML = viewExpenses(); bindExpenseRows(); break;
    case "reports":   c.innerHTML = viewReports(); afterReports(); break;
    case "settings":  c.innerHTML = viewSettings(); bindSettings(); break;
  }
}

function refreshSidebar() {
  const pro = Store.isPro();
  $("#planBadge").textContent = pro ? "Pro plan ⚡" : "Free plan";
  const card = $("#usageCard");
  if (pro) {
    card.innerHTML = `<div class="usage-title">Pro plan active</div>
      <div style="font-size:12px;color:#cfd2e8">Unlimited invoices · all features unlocked</div>`;
  } else {
    const used = Store.invoicesThisMonth(), q = Billing.FREE_QUOTA;
    card.innerHTML = `<div class="usage-title">Monthly invoices</div>
      <div class="usage-bar"><div class="usage-fill${used >= q ? " warn" : ""}" style="width:${Math.min(100, used / q * 100)}%"></div></div>
      <div class="usage-text">${used} / ${q} used this month</div>
      <button class="btn btn-upgrade" id="sidebarUpgrade">⚡ Upgrade to Pro</button>`;
    $("#sidebarUpgrade").onclick = () => openPaywall("Unlock unlimited invoicing");
  }
  const p = Store.state.profile;
  $("#userRow").innerHTML = p ? `<div class="user-avatar">${esc((p.name || "?")[0].toUpperCase())}</div>
    <div><div style="color:#e6e8f7;font-weight:600">${esc(p.name)}</div><div>${esc(p.email || "")}</div></div>` : "";
}

/* ---------- Dashboard ---------- */
function viewDashboard() {
  const s = Store.stats();
  const invs = Store.state.invoices;
  const overdue = invs.filter(i => Store.effStatus(i) === "overdue");
  const recent = [...invs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const rev = Store.monthlyRevenue(6);
  const thisM = rev[rev.length - 1].value, lastM = rev[rev.length - 2]?.value || 0;
  const delta = lastM > 0 ? ((thisM - lastM) / lastM * 100) : null;

  return `
  <div class="kpi-grid">
    <div class="card kpi"><div class="kpi-label">Revenue (paid)</div><div class="kpi-value">${fmtMoney(s.paid)}</div>
      <div class="kpi-sub ${delta === null || delta >= 0 ? "up" : "down"}">${delta === null ? "all time" : (delta >= 0 ? "▲" : "▼") + " " + Math.abs(delta).toFixed(0) + "% vs last month"}</div></div>
    <div class="card kpi"><div class="kpi-label">Outstanding</div><div class="kpi-value">${fmtMoney(s.outstanding)}</div><div class="kpi-sub muted">awaiting payment</div></div>
    <div class="card kpi"><div class="kpi-label">Overdue</div><div class="kpi-value" style="color:${s.overdue > 0 ? "var(--red)" : "inherit"}">${fmtMoney(s.overdue)}</div><div class="kpi-sub muted">${overdue.length} invoice${overdue.length === 1 ? "" : "s"}</div></div>
    <div class="card kpi"><div class="kpi-label">Clients</div><div class="kpi-value">${Store.state.clients.length}</div><div class="kpi-sub muted">${s.drafts} draft invoice${s.drafts === 1 ? "" : "s"}</div></div>
  </div>
  <div class="grid-2">
    <div class="card">
      <div class="card-head"><h3>Revenue — last 6 months</h3></div>
      <div class="card-body"><div class="chart-wrap"><canvas id="revChart"></canvas></div></div>
    </div>
    <div class="card">
      <div class="card-head"><h3>Needs attention</h3></div>
      <div class="card-body" style="padding:0">
        ${overdue.length === 0 ? `<div class="empty" style="padding:32px"><div class="e-icon">✅</div><h3>All clear</h3><p>No overdue invoices.</p></div>`
        : `<table><tbody>${overdue.map(i => {
            const c = Store.getClient(i.clientId);
            return `<tr><td><strong>${esc(i.number)}</strong><br><span class="muted">${esc(c?.name || "—")}</span></td>
              <td class="t-right"><strong>${fmtMoney(Store.invoiceTotals(i).total)}</strong><br>
              <span class="badge overdue">due ${fmtDate(i.dueDate)}</span></td>
              <td class="t-right"><button class="btn btn-sm btn-ghost remind-btn" data-id="${i.id}">Remind</button></td></tr>`;
          }).join("")}</tbody></table>`}
      </div>
    </div>
  </div>
  <div class="card" style="margin-top:16px">
    <div class="card-head"><h3>Recent invoices</h3><button class="btn-link" id="goInvoices">View all →</button></div>
    <div class="card-body" style="padding:0">
      ${recent.length === 0 ? `<div class="empty"><div class="e-icon">🧾</div><h3>No invoices yet</h3><p>Create your first invoice or load demo data to explore.</p></div>` : invoiceTable(recent)}
    </div>
  </div>`;
}

function afterDashboard() {
  const cv = $("#revChart");
  if (cv) drawBarChart(cv, Store.monthlyRevenue(6));
  $("#goInvoices")?.addEventListener("click", () => navigate("invoices"));
  $$(".remind-btn").forEach(b => b.onclick = () => {
    const inv = Store.getInvoice(b.dataset.id);
    const c = Store.getClient(inv.clientId);
    toast(`Reminder queued for ${c?.name || "client"} (${inv.number}).`);
  });
  bindInvoiceRows();
}

/* ---------- Invoices ---------- */
function invoiceTable(list) {
  return `<table>
    <thead><tr><th>Invoice</th><th>Client</th><th>Issued</th><th>Due</th><th>Status</th><th class="t-right">Total</th><th class="t-right">Actions</th></tr></thead>
    <tbody>${list.map(i => {
      const c = Store.getClient(i.clientId);
      const st = Store.effStatus(i);
      return `<tr>
        <td><strong>${esc(i.number)}</strong></td>
        <td>${esc(c?.name || "—")}</td>
        <td>${fmtDate(i.issueDate)}</td>
        <td>${fmtDate(i.dueDate)}</td>
        <td><span class="badge ${st}">${st}</span></td>
        <td class="t-right"><strong>${fmtMoney(Store.invoiceTotals(i).total)}</strong></td>
        <td><div class="row-actions">
          ${st === "draft" ? `<button class="btn btn-sm btn-ghost act-send" data-id="${i.id}">Send</button>` : ""}
          ${st !== "paid" && st !== "draft" ? `<button class="btn btn-sm btn-ghost act-paid" data-id="${i.id}">Mark paid</button>` : ""}
          <button class="btn btn-sm btn-ghost act-view" data-id="${i.id}">PDF</button>
          <button class="btn btn-sm btn-ghost act-edit" data-id="${i.id}">Edit</button>
          <button class="btn btn-sm btn-danger act-del" data-id="${i.id}">✕</button>
        </div></td></tr>`;
    }).join("")}</tbody></table>`;
}

function viewInvoices() {
  const list = [...Store.state.invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return `<div class="card">
    <div class="card-head"><h3>All invoices (${list.length})</h3>
      <button class="btn btn-primary btn-sm" id="btnNewInvoice2">+ New Invoice</button></div>
    <div class="card-body" style="padding:0">
      ${list.length === 0 ? `<div class="empty"><div class="e-icon">🧾</div><h3>No invoices yet</h3><p>Your first invoice is 30 seconds away.</p><br><button class="btn btn-primary" id="emptyNewInv">+ Create invoice</button></div>` : invoiceTable(list)}
    </div></div>`;
}

function bindInvoiceRows() {
  $("#btnNewInvoice2")?.addEventListener("click", tryNewInvoice);
  $("#emptyNewInv")?.addEventListener("click", tryNewInvoice);
  $$(".act-send").forEach(b => b.onclick = () => { Store.updateInvoice(b.dataset.id, { status: "sent" }); toast("Invoice marked as sent."); render(); });
  $$(".act-paid").forEach(b => b.onclick = () => { Store.updateInvoice(b.dataset.id, { status: "paid", paidAt: new Date().toISOString() }); toast("Payment recorded 🎉"); render(); });
  $$(".act-view").forEach(b => b.onclick = () => printInvoice(b.dataset.id));
  $$(".act-edit").forEach(b => b.onclick = () => openInvoiceEditor(b.dataset.id));
  $$(".act-del").forEach(b => b.onclick = () => {
    if (confirm("Delete this invoice? This cannot be undone.")) { Store.deleteInvoice(b.dataset.id); toast("Invoice deleted."); render(); }
  });
}

/* Quota check → paywall or editor */
function tryNewInvoice() {
  if (Store.state.clients.length === 0) {
    toast("Add a client first — invoices need a recipient.", "err");
    navigate("clients"); openClientEditor(); return;
  }
  const check = Billing.canCreateInvoice();
  if (!check.ok) { openPaywall(`You've used all ${check.quota} free invoices this month`); return; }
  openInvoiceEditor();
}

function openInvoiceEditor(id = null) {
  const inv = id ? Store.getInvoice(id) : null;
  const items = inv?.items?.length ? inv.items : [{ desc: "", qty: 1, rate: 0 }];
  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);

  Modal.open(`
    <div class="modal-head"><h2>${inv ? "Edit " + esc(inv.number) : "New invoice — " + esc(Store.nextInvoiceNumber())}</h2><button class="modal-x">✕</button></div>
    <div class="modal-body">
      <div class="form-row">
        <label>Client
          <select id="invClient">${Store.state.clients.map(c => `<option value="${c.id}" ${inv?.clientId === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
        </label>
        <div class="form-row">
          <label>Issue date<input type="date" id="invIssue" value="${inv?.issueDate || today}"></label>
          <label>Due date<input type="date" id="invDue" value="${inv?.dueDate || due}"></label>
        </div>
      </div>
      <table class="items-table" id="itemsTable">
        <thead><tr><th>Description</th><th style="width:80px">Qty</th><th style="width:110px">Rate</th><th style="width:100px" class="t-right">Amount</th><th style="width:36px"></th></tr></thead>
        <tbody></tbody>
      </table>
      <button class="btn btn-ghost btn-sm" id="addItem" style="margin-top:8px">+ Add line item</button>
      <div class="form-row" style="margin-top:14px">
        <label>Tax rate (%)<input type="number" id="invTax" min="0" max="100" step="0.5" value="${inv?.taxRate ?? 0}"></label>
        <label>Discount (%)<input type="number" id="invDisc" min="0" max="100" step="0.5" value="${inv?.discount ?? 0}"></label>
      </div>
      <label>Notes / payment terms<textarea id="invNotes" rows="2" placeholder="e.g. Payment via bank transfer within 14 days.">${esc(inv?.notes || "")}</textarea></label>
      <div class="inv-totals" id="invTotals"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost modal-x">Cancel</button>
      <button class="btn btn-primary" id="saveInv">${inv ? "Save changes" : "Create invoice"}</button>
    </div>`, true);

  const tbody = $("#itemsTable tbody");
  const addRow = (it = { desc: "", qty: 1, rate: 0 }) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><input class="it-desc" placeholder="Service or product" value="${esc(it.desc)}"></td>
      <td><input class="it-qty" type="number" min="0" step="0.5" value="${it.qty}"></td>
      <td><input class="it-rate" type="number" min="0" step="0.01" value="${it.rate}"></td>
      <td class="t-right it-amt">—</td>
      <td><button class="item-del" title="Remove">✕</button></td>`;
    tr.querySelector(".item-del").onclick = () => { if (tbody.children.length > 1) { tr.remove(); recalc(); } };
    tr.querySelectorAll("input").forEach(i => i.addEventListener("input", recalc));
    tbody.appendChild(tr);
  };
  items.forEach(addRow);
  $("#addItem").onclick = () => addRow();

  const readItems = () => $$("#itemsTable tbody tr").map(tr => ({
    desc: $(".it-desc", tr).value.trim(),
    qty: Number($(".it-qty", tr).value) || 0,
    rate: Number($(".it-rate", tr).value) || 0
  }));

  function recalc() {
    const draft = { items: readItems(), taxRate: $("#invTax").value, discount: $("#invDisc").value };
    $$("#itemsTable tbody tr").forEach(tr => {
      const amt = (Number($(".it-qty", tr).value) || 0) * (Number($(".it-rate", tr).value) || 0);
      $(".it-amt", tr).textContent = fmtMoney(amt);
    });
    const t = Store.invoiceTotals(draft);
    $("#invTotals").innerHTML = `
      <div class="trow"><span>Subtotal</span><span>${fmtMoney(t.sub)}</span></div>
      ${t.discount > 0 ? `<div class="trow"><span>Discount</span><span>−${fmtMoney(t.discount)}</span></div>` : ""}
      ${t.tax > 0 ? `<div class="trow"><span>Tax</span><span>${fmtMoney(t.tax)}</span></div>` : ""}
      <div class="trow grand"><span>Total</span><span>${fmtMoney(t.total)}</span></div>`;
  }
  $("#invTax").addEventListener("input", recalc);
  $("#invDisc").addEventListener("input", recalc);
  recalc();

  $("#saveInv").onclick = () => {
    const items = readItems().filter(i => i.desc);
    if (items.length === 0) { toast("Add at least one line item with a description.", "err"); return; }
    const payload = {
      clientId: $("#invClient").value,
      issueDate: $("#invIssue").value,
      dueDate: $("#invDue").value,
      items, taxRate: Number($("#invTax").value) || 0,
      discount: Number($("#invDisc").value) || 0,
      notes: $("#invNotes").value.trim()
    };
    if (inv) { Store.updateInvoice(inv.id, payload); toast("Invoice updated."); }
    else { Store.addInvoice(payload); toast("Invoice created ✔"); }
    Modal.close(); render();
  };
}

/* ---------- Invoice PDF (print) ---------- */
function printInvoice(id) {
  const inv = Store.getInvoice(id);
  const c = Store.getClient(inv.clientId);
  const p = Store.state.profile || {};
  const t = Store.invoiceTotals(inv);
  const branded = !Store.isPro();
  $("#printArea").innerHTML = `
  <div class="inv-doc">
    <div class="inv-doc-head">
      <div><h1>INVOICE</h1><div class="muted">${esc(inv.number)}</div></div>
      <div class="inv-meta">
        <strong>${esc(p.name || "")}</strong><br>${esc(p.email || "")}<br>${esc(p.address || "")}
        ${p.taxId ? "<br>Tax ID: " + esc(p.taxId) : ""}
      </div>
    </div>
    <div class="inv-parties">
      <div><h4>Billed to</h4><strong>${esc(c?.name || "—")}</strong><br>${esc(c?.company || "")}<br>${esc(c?.email || "")}<br>${esc(c?.address || "")}</div>
      <div style="text-align:right"><h4>Details</h4>Issued: ${fmtDate(inv.issueDate)}<br>Due: ${fmtDate(inv.dueDate)}<br>Status: <strong>${Store.effStatus(inv).toUpperCase()}</strong></div>
    </div>
    <table><thead><tr><th>Description</th><th class="t-right">Qty</th><th class="t-right">Rate</th><th class="t-right">Amount</th></tr></thead>
    <tbody>${inv.items.map(it => `<tr><td>${esc(it.desc)}</td><td class="t-right">${it.qty}</td><td class="t-right">${fmtMoney(it.rate)}</td><td class="t-right">${fmtMoney(it.qty * it.rate)}</td></tr>`).join("")}</tbody></table>
    <div class="inv-doc-totals">
      <div class="trow"><span>Subtotal</span><span>${fmtMoney(t.sub)}</span></div>
      ${t.discount > 0 ? `<div class="trow"><span>Discount (${inv.discount}%)</span><span>−${fmtMoney(t.discount)}</span></div>` : ""}
      ${t.tax > 0 ? `<div class="trow"><span>Tax (${inv.taxRate}%)</span><span>${fmtMoney(t.tax)}</span></div>` : ""}
      <div class="trow grand"><span>Total due</span><span>${fmtMoney(t.total)}</span></div>
    </div>
    ${inv.notes ? `<div class="inv-doc-notes"><strong>Notes:</strong> ${esc(inv.notes)}</div>` : ""}
    ${branded ? `<div class="inv-doc-notes" style="text-align:center">Created free with <strong>LedgerPilot</strong> — ledgerpilot.app</div>` : ""}
  </div>`;
  window.print();
}

/* ---------- Clients ---------- */
function viewClients() {
  const list = Store.state.clients;
  return `<div class="card">
    <div class="card-head"><h3>Clients (${list.length})</h3>
      <button class="btn btn-primary btn-sm" id="btnNewClient">+ Add client</button></div>
    <div class="card-body" style="padding:0">
    ${list.length === 0 ? `<div class="empty"><div class="e-icon">👥</div><h3>No clients yet</h3><p>Add the people and companies you bill.</p><br><button class="btn btn-primary" id="emptyNewClient">+ Add client</button></div>`
    : `<table><thead><tr><th>Name</th><th>Company</th><th>Email</th><th class="t-right">Billed (paid)</th><th class="t-right">Actions</th></tr></thead>
      <tbody>${list.map(c => {
        const paid = Store.state.invoices.filter(i => i.clientId === c.id && i.status === "paid")
          .reduce((s, i) => s + Store.invoiceTotals(i).total, 0);
        return `<tr><td><strong>${esc(c.name)}</strong></td><td>${esc(c.company || "—")}</td><td>${esc(c.email || "—")}</td>
          <td class="t-right">${fmtMoney(paid)}</td>
          <td><div class="row-actions">
            <button class="btn btn-sm btn-ghost cl-edit" data-id="${c.id}">Edit</button>
            <button class="btn btn-sm btn-danger cl-del" data-id="${c.id}">✕</button></div></td></tr>`;
      }).join("")}</tbody></table>`}
    </div></div>`;
}

function bindClientRows() {
  $("#btnNewClient")?.addEventListener("click", () => openClientEditor());
  $("#emptyNewClient")?.addEventListener("click", () => openClientEditor());
  $$(".cl-edit").forEach(b => b.onclick = () => openClientEditor(b.dataset.id));
  $$(".cl-del").forEach(b => b.onclick = () => {
    const used = Store.state.invoices.some(i => i.clientId === b.dataset.id);
    if (used && !confirm("This client has invoices. Delete anyway?")) return;
    Store.deleteClient(b.dataset.id); toast("Client removed."); render();
  });
}

function openClientEditor(id = null) {
  const c = id ? Store.getClient(id) : null;
  Modal.open(`
    <div class="modal-head"><h2>${c ? "Edit client" : "New client"}</h2><button class="modal-x">✕</button></div>
    <div class="modal-body">
      <div class="form-row">
        <label>Name *<input id="clName" value="${esc(c?.name || "")}" placeholder="Jane Doe" maxlength="80"></label>
        <label>Company<input id="clCompany" value="${esc(c?.company || "")}" placeholder="Acme LLC" maxlength="80"></label>
      </div>
      <label>Email<input id="clEmail" type="email" value="${esc(c?.email || "")}" placeholder="jane@acme.com" maxlength="100"></label>
      <label>Billing address<textarea id="clAddr" rows="2" maxlength="200">${esc(c?.address || "")}</textarea></label>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost modal-x">Cancel</button>
      <button class="btn btn-primary" id="saveClient">${c ? "Save" : "Add client"}</button>
    </div>`);
  $("#saveClient").onclick = () => {
    const name = $("#clName").value.trim();
    if (!name) { toast("Client name is required.", "err"); return; }
    const payload = { name, company: $("#clCompany").value.trim(), email: $("#clEmail").value.trim(), address: $("#clAddr").value.trim() };
    if (c) { Store.updateClient(c.id, payload); toast("Client updated."); }
    else { Store.addClient(payload); toast("Client added ✔"); }
    Modal.close(); render();
  };
}

/* ---------- Expenses ---------- */
function viewExpenses() {
  const list = [...Store.state.expenses].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const total = list.reduce((s, e) => s + Number(e.amount || 0), 0);
  return `<div class="card">
    <div class="card-head"><h3>Expenses — total ${fmtMoney(total)}</h3>
      <button class="btn btn-primary btn-sm" id="btnNewExp">+ Add expense</button></div>
    <div class="card-body" style="padding:0">
    ${list.length === 0 ? `<div class="empty"><div class="e-icon">💸</div><h3>No expenses tracked</h3><p>Track business costs to see real profit in Reports.</p></div>`
    : `<table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th class="t-right">Amount</th><th class="t-right"></th></tr></thead>
      <tbody>${list.map(e => `<tr><td>${fmtDate(e.date)}</td><td><span class="badge draft">${esc(e.category)}</span></td>
        <td>${esc(e.description)}</td><td class="t-right"><strong>${fmtMoney(e.amount)}</strong></td>
        <td class="t-right"><button class="btn btn-sm btn-danger ex-del" data-id="${e.id}">✕</button></td></tr>`).join("")}</tbody></table>`}
    </div></div>`;
}

function bindExpenseRows() {
  $("#btnNewExp")?.addEventListener("click", () => {
    Modal.open(`
      <div class="modal-head"><h2>Add expense</h2><button class="modal-x">✕</button></div>
      <div class="modal-body">
        <div class="form-row-3">
          <label>Description *<input id="exDesc" placeholder="e.g. Software subscription" maxlength="100"></label>
          <label>Category<select id="exCat"><option>Software</option><option>Office</option><option>Travel</option><option>Assets</option><option>Services</option><option>Other</option></select></label>
          <label>Amount *<input id="exAmt" type="number" min="0" step="0.01"></label>
        </div>
        <label>Date<input id="exDate" type="date" value="${new Date().toISOString().slice(0, 10)}"></label>
      </div>
      <div class="modal-foot"><button class="btn btn-ghost modal-x">Cancel</button>
        <button class="btn btn-primary" id="saveExp">Add expense</button></div>`);
    $("#saveExp").onclick = () => {
      const d = $("#exDesc").value.trim(), a = Number($("#exAmt").value);
      if (!d || !(a > 0)) { toast("Description and a positive amount are required.", "err"); return; }
      Store.addExpense({ description: d, category: $("#exCat").value, amount: a, date: $("#exDate").value });
      toast("Expense added."); Modal.close(); render();
    };
  });
  $$(".ex-del").forEach(b => b.onclick = () => { Store.deleteExpense(b.dataset.id); render(); });
}

/* ---------- Reports (PRO) ---------- */
function viewReports() {
  const pro = Store.isPro();
  const rev = Store.monthlyRevenue(6);
  const totalRev = rev.reduce((s, r) => s + r.value, 0);
  const totalExp = Store.state.expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const tax = Store.state.invoices.filter(i => i.status === "paid").reduce((s, i) => s + Store.invoiceTotals(i).tax, 0);
  const byClient = {};
  Store.state.invoices.filter(i => i.status === "paid").forEach(i => {
    const n = Store.getClient(i.clientId)?.name || "Unknown";
    byClient[n] = (byClient[n] || 0) + Store.invoiceTotals(i).total;
  });
  const top = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const inner = `
  <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
    <div class="card kpi"><div class="kpi-label">Revenue (6 mo)</div><div class="kpi-value">${fmtMoney(totalRev)}</div></div>
    <div class="card kpi"><div class="kpi-label">Expenses</div><div class="kpi-value">${fmtMoney(totalExp)}</div></div>
    <div class="card kpi"><div class="kpi-label">Net profit</div><div class="kpi-value" style="color:${totalRev - totalExp >= 0 ? "var(--green)" : "var(--red)"}">${fmtMoney(totalRev - totalExp)}</div></div>
  </div>
  <div class="grid-2">
    <div class="card"><div class="card-head"><h3>Revenue trend</h3></div>
      <div class="card-body"><div class="chart-wrap"><canvas id="repChart"></canvas></div></div></div>
    <div class="card"><div class="card-head"><h3>Top clients by revenue</h3></div>
      <div class="card-body" style="padding:0">
      ${top.length === 0 ? `<div class="empty" style="padding:30px">No paid invoices yet.</div>`
      : `<table><tbody>${top.map(([n, v], i) => `<tr><td>${i + 1}. <strong>${esc(n)}</strong></td><td class="t-right">${fmtMoney(v)}</td></tr>`).join("")}</tbody></table>`}
      </div></div>
  </div>
  <div class="card" style="margin-top:16px"><div class="card-head"><h3>Tax summary</h3>
    <button class="btn btn-ghost btn-sm" id="btnCsv">⬇ Export CSV</button></div>
    <div class="card-body">
      <p>Collected tax on paid invoices: <strong>${fmtMoney(tax)}</strong>. Keep this figure for your VAT / sales-tax filing. CSV export includes every invoice line with tax breakdown.</p>
    </div></div>`;

  if (pro) return inner;
  return `<div class="lock-overlay">
    <div class="lock-blur">${inner}</div>
    <div class="lock-msg">
      <div style="font-size:36px">🔒</div>
      <h3>Reports are a Pro feature</h3>
      <p class="muted" style="max-width:380px;text-align:center">See profit, tax summaries and your best clients. Everything you need at filing time.</p>
      <button class="btn btn-upgrade" style="width:auto;padding:10px 26px" id="repUpgrade">⚡ Upgrade to Pro — from $8/mo</button>
    </div></div>`;
}

function afterReports() {
  const cv = $("#repChart");
  if (cv) drawBarChart(cv, Store.monthlyRevenue(6));
  $("#repUpgrade")?.addEventListener("click", () => openPaywall("Unlock reports & tax summaries"));
  $("#btnCsv")?.addEventListener("click", exportCsv);
}

function exportCsv() {
  if (!Store.isPro()) { openPaywall("CSV export is a Pro feature"); return; }
  const sanitize = v => {
    let s = String(v ?? "");
    if (/^[=+\-@]/.test(s)) s = "'" + s;           // CSV-injection guard
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const rows = [["Invoice", "Client", "Issued", "Due", "Status", "Subtotal", "Tax", "Total"]];
  Store.state.invoices.forEach(i => {
    const t = Store.invoiceTotals(i);
    rows.push([i.number, Store.getClient(i.clientId)?.name || "", i.issueDate, i.dueDate, Store.effStatus(i), t.sub.toFixed(2), t.tax.toFixed(2), t.total.toFixed(2)]);
  });
  const csv = rows.map(r => r.map(sanitize).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "ledgerpilot-invoices.csv";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("CSV exported.");
}

/* ---------- Settings ---------- */
function viewSettings() {
  const p = Store.state.profile || {};
  const plan = Store.state.plan;
  return `
  <div class="grid-2">
    <div class="card"><div class="card-head"><h3>Business profile</h3></div>
      <div class="card-body">
        <div class="form-row">
          <label>Name / business<input id="setName" value="${esc(p.name || "")}" maxlength="60"></label>
          <label>Email<input id="setEmail" value="${esc(p.email || "")}" maxlength="80"></label>
        </div>
        <div class="form-row">
          <label>Currency<select id="setCur">${Object.keys(CUR).map(c => `<option ${p.currency === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>
          <label>Tax ID (optional)<input id="setTax" value="${esc(p.taxId || "")}" maxlength="40"></label>
        </div>
        <label>Address (shown on invoices)<textarea id="setAddr" rows="2" maxlength="200">${esc(p.address || "")}</textarea></label>
        <button class="btn btn-primary" id="saveProfile">Save profile</button>
      </div></div>
    <div>
      <div class="card"><div class="card-head"><h3>Subscription</h3></div>
        <div class="card-body">
          ${Store.isPro()
            ? `<p><span class="badge paid">PRO ⚡</span> &nbsp;Billed ${plan.cycle === "annual" ? "$96/year" : "$12/month"} · renews ${fmtDate(plan.renewsAt)}</p>
               <p class="muted" style="margin:10px 0">Unlimited invoices, reports, CSV export, recurring billing, no branding.</p>
               <button class="btn btn-danger btn-sm" id="cancelPro">Cancel subscription</button>`
            : `<p><span class="badge draft">FREE</span> &nbsp;${Store.invoicesThisMonth()} / ${Billing.FREE_QUOTA} invoices used this month.</p>
               <p class="muted" style="margin:10px 0">Upgrade for unlimited invoices, reports and tax exports.</p>
               <button class="btn btn-upgrade" style="width:auto" id="setUpgrade">⚡ Upgrade to Pro</button>`}
        </div></div>
      <div class="card" style="margin-top:16px"><div class="card-head"><h3>Data</h3></div>
        <div class="card-body">
          <p class="muted" style="margin-bottom:12px">All data is stored locally in your browser. Nothing is sent to a server.</p>
          <button class="btn btn-ghost btn-sm" id="exportJson">⬇ Backup (JSON)</button>
          <button class="btn btn-danger btn-sm" id="resetAll" style="margin-left:8px">Reset workspace</button>
        </div></div>
    </div>
  </div>`;
}

function bindSettings() {
  $("#saveProfile").onclick = () => {
    Store.setProfile({
      name: $("#setName").value.trim(), email: $("#setEmail").value.trim(),
      currency: $("#setCur").value, taxId: $("#setTax").value.trim(), address: $("#setAddr").value.trim()
    });
    toast("Profile saved."); refreshSidebar();
  };
  $("#setUpgrade")?.addEventListener("click", () => openPaywall("Go Pro"));
  $("#cancelPro")?.addEventListener("click", () => {
    if (confirm("Cancel Pro? You'll drop back to 3 invoices/month.")) { Billing.cancelPro(); toast("Subscription cancelled."); render(); }
  });
  $("#exportJson").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(Store.state, null, 2)], { type: "application/json" }));
    a.download = "ledgerpilot-backup.json"; a.click(); URL.revokeObjectURL(a.href);
  };
  $("#resetAll").onclick = () => {
    if (confirm("Erase ALL data and start over?")) { Store.resetAll(); location.reload(); }
  };
}

/* ===================== PAYWALL & CHECKOUT ===================== */
function openPaywall(reason) {
  Modal.open(`
    <div class="modal-head"><h2>Upgrade to Pro</h2><button class="modal-x">✕</button></div>
    <div class="modal-body">
      <div class="paywall-hero">
        <div class="pw-icon">⚡</div>
        <h2>${esc(reason)}</h2>
        <p class="muted">Join thousands of freelancers who invoice without limits.</p>
        <div class="billing-toggle">
          <button id="cycMonthly" class="on">Monthly</button>
          <button id="cycAnnual">Annual <span class="save-tag">−33%</span></button>
        </div>
      </div>
      <div class="plans">
        <div class="plan">
          <h4>Free</h4><div class="price">$0<span>/forever</span></div>
          <ul>${Billing.FREE_FEATURES.map(f => `<li>· ${f}</li>`).join("")}</ul>
          <button class="btn btn-ghost btn-block modal-x">Stay on Free</button>
        </div>
        <div class="plan best">
          <div class="plan-flag">MOST POPULAR</div>
          <h4>Pro</h4><div class="price" id="proPrice">$12<span>/month</span></div>
          <ul>${Billing.PRO_FEATURES.map(f => `<li>✓ ${f}</li>`).join("")}</ul>
          <button class="btn btn-primary btn-block" id="goCheckout">Continue to checkout →</button>
        </div>
      </div>
    </div>`, true);

  let cycle = "monthly";
  const setCycle = c => {
    cycle = c;
    $("#cycMonthly").classList.toggle("on", c === "monthly");
    $("#cycAnnual").classList.toggle("on", c === "annual");
    $("#proPrice").innerHTML = c === "annual" ? `$8<span>/mo — $96 billed yearly</span>` : `$12<span>/month</span>`;
  };
  $("#cycMonthly").onclick = () => setCycle("monthly");
  $("#cycAnnual").onclick = () => setCycle("annual");
  $("#goCheckout").onclick = () => openCheckout(cycle);
}

function openCheckout(cycle) {
  const plan = Billing.PLANS[cycle];
  Modal.open(`
    <div class="modal-head"><h2>Checkout — Pro (${cycle})</h2><button class="modal-x">✕</button></div>
    <div class="modal-body">
      <div class="cc-preview">
        <div>LedgerPilot Pro</div>
        <div class="cc-num" id="ccNumPrev">•••• •••• •••• ••••</div>
        <div class="cc-row"><span id="ccNamePrev">CARDHOLDER</span><span id="ccExpPrev">MM/YY</span></div>
      </div>
      <label>Cardholder name<input id="ccName" placeholder="Name on card" maxlength="60" autocomplete="cc-name"></label>
      <label>Card number<input id="ccNum" placeholder="4242 4242 4242 4242" maxlength="19" inputmode="numeric" autocomplete="cc-number"></label>
      <div class="form-row">
        <label>Expiry<input id="ccExp" placeholder="MM/YY" maxlength="5" inputmode="numeric"></label>
        <label>CVC<input id="ccCvc" placeholder="123" maxlength="4" inputmode="numeric"></label>
      </div>
      <div class="secure-note">🔐 Demo checkout — no real charge. In production this posts to Stripe. Total today: <strong>${plan.label}${plan.per}</strong></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost modal-x">Back</button>
      <button class="btn btn-primary" id="payBtn">Pay ${plan.label} &amp; upgrade</button>
    </div>`);

  const num = $("#ccNum");
  num.addEventListener("input", () => {
    num.value = num.value.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
    $("#ccNumPrev").textContent = num.value || "•••• •••• •••• ••••";
  });
  $("#ccName").addEventListener("input", e => $("#ccNamePrev").textContent = (e.target.value || "CARDHOLDER").toUpperCase());
  $("#ccExp").addEventListener("input", e => {
    let v = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
    e.target.value = v; $("#ccExpPrev").textContent = v || "MM/YY";
  });

  $("#payBtn").onclick = async () => {
    const btn = $("#payBtn");
    btn.disabled = true; btn.textContent = "Processing…";
    try {
      await Billing.processPayment({
        name: $("#ccName").value, card: $("#ccNum").value,
        exp: $("#ccExp").value, cvc: $("#ccCvc").value, cycle
      });
      Modal.close();
      toast("Welcome to Pro! Everything is unlocked ⚡");
      render();
    } catch (err) {
      toast(err.message, "err");
      btn.disabled = false; btn.textContent = "Pay & upgrade";
    }
  };
}

/* ===================== ONBOARDING & BOOT ===================== */
function boot() {
  if (Store.state.profile) {
    $("#onboarding").classList.add("hidden");
    $("#app").classList.remove("hidden");
    render();
  } else {
    $("#onboarding").classList.remove("hidden");
    $("#app").classList.add("hidden");
  }
}

$("#obStart").onclick = () => {
  const name = $("#obName").value.trim();
  if (!name) { toast("Please enter your name or business name.", "err"); return; }
  Store.setProfile({ name, email: $("#obEmail").value.trim(), currency: $("#obCurrency").value, taxId: "", address: "" });
  boot();
  toast("Workspace ready. Create your first invoice!");
};

$$(".nav-item").forEach(b => b.onclick = () => {
  navigate(b.dataset.view);
});
$("#btnNewInvoice").onclick = tryNewInvoice;
$("#btnDemoData").onclick = () => {
  if (Store.state.invoices.length > 0 && !confirm("Demo data will be added on top of existing data. Continue?")) return;
  Store.loadDemo();
  toast("Demo data loaded — explore the dashboard.");
  render();
};

window.addEventListener("resize", () => {
  if (currentView === "dashboard" || currentView === "reports") render();
});

boot();

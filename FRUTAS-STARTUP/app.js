/*
  Startup de Frutas (demo offline)
  - Catálogo: lista de frutas com preço e custo estimado
  - Estoque: quantidade disponível e alertas
  - Vender: registra vendas por funcionário no mês
  - Dashboard: vendas por funcionário + custo estimado + lucro
  - Persistência: localStorage
*/

const STORAGE_KEY = "frutaNobre.v1";

const $ = (sel) => document.querySelector(sel);
const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
};

const money = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n || 0));

const monthKeyFromDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

const parseMonthInput = (value) => {
  // value: YYYY-MM
  if (!value) return null;
  const [y, m] = value.split("-").map(Number);
  if (!y || !m) return null;
  return new Date(y, m - 1, 1);
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {}
  }

  // Estado inicial de demonstração
  const initial = {
    funcionarios: [
      { id: crypto.randomUUID(), nome: "Ana" },
      { id: crypto.randomUUID(), nome: "Bruno" },
      { id: crypto.randomUUID(), nome: "Carla" }
    ],
    frutas: [
      {
        id: crypto.randomUUID(),
        nome: "Morango",
        preco: 18.9,
        custo: 9.2,
        estoque: 120,
        baixoEstoque: 30
      },
      {
        id: crypto.randomUUID(),
        nome: "Banana",
        preco: 6.5,
        custo: 3.1,
        estoque: 260,
        baixoEstoque: 60
      },
      {
        id: crypto.randomUUID(),
        nome: "Maçã",
        preco: 12.0,
        custo: 6.2,
        estoque: 140,
        baixoEstoque: 35
      },
      {
        id: crypto.randomUUID(),
        nome: "Uva",
        preco: 24.9,
        custo: 13.0,
        estoque: 65,
        baixoEstoque: 20
      },
      {
        id: crypto.randomUUID(),
        nome: "Laranja",
        preco: 9.9,
        custo: 4.9,
        estoque: 85,
        baixoEstoque: 25
      },
      {
        id: crypto.randomUUID(),
        nome: "Abacaxi",
        preco: 16.5,
        custo: 8.1,
        estoque: 45,
        baixoEstoque: 15
      }
    ],
    // vendas: [{id, dateISO, funcionarioId, frutaId, qty, precoUnit, custoUnit}]
    vendas: []
  };

  return initial;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

function getCurrentMonthKey() {
  return monthKeyFromDate(new Date());
}

// UI: Modal helpers
function openModal(modalEl) {
  modalEl.classList.add("is-open");
  modalEl.setAttribute("aria-hidden", "false");
}
function closeModal(modalEl) {
  modalEl.classList.remove("is-open");
  modalEl.setAttribute("aria-hidden", "true");
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("is-show");
  clearTimeout(toast._tm);
  toast._tm = setTimeout(() => t.classList.remove("is-show"), 2400);
}

function switchPanel(tabBtn) {
  const tab = tabBtn.dataset.tab;
  document.querySelectorAll(".tab").forEach((b) => {
    b.setAttribute("aria-selected", String(b === tabBtn));
  });
  document.querySelectorAll(".panel").forEach((p) => {
    p.classList.toggle("is-active", p.dataset.panel === tab);
  });
}

function renderFuncionariosSelects() {
  const sel1 = $("#funcionarioSelect");
  const sel2 = $("#saleFruitSelect");
  sel1.innerHTML = "";

  for (const f of state.funcionarios) {
    sel1.appendChild(el("option", { value: f.id, text: f.nome }));
  }

  // sel2 is fruit, not funcionário; keep separate.
}

function renderFruitSelectSale() {
  const select = $("#saleFruitSelect");
  select.innerHTML = "";
  for (const fr of state.frutas) {
    select.appendChild(el("option", { value: fr.id, text: fr.nome }));
  }
}

function renderRestockFruitSelect() {
  const select = $("#restockFruitSelect");
  select.innerHTML = "";
  for (const fr of state.frutas) {
    select.appendChild(el("option", { value: fr.id, text: fr.nome }));
  }
}

function fruitById(id) {
  return state.frutas.find((f) => f.id === id);
}

function funcionarioById(id) {
  return state.funcionarios.find((f) => f.id === id);
}

function renderCatalog() {
  const grid = $("#fruitGrid");
  const q = $("#searchInput").value.trim().toLowerCase();

  const filtered = state.frutas.filter((f) => f.nome.toLowerCase().includes(q));

  grid.innerHTML = "";

  for (const fr of filtered) {
    const low = fr.estoque <= fr.baixoEstoque;

    const card = el("div", { class: "fruit-card" });
    const top = el("div", { class: "fruit-title" }, [
      el("div", { class: "fruit-name", text: fr.nome }),
      el("div", { class: `badge ${low ? "low" : "ok"}` , text: low ? "Baixo estoque" : "OK" })
    ]);

    const priceRow = el("div", { class: "price-row" });
    priceRow.appendChild(
      el("div", { class: "kv" }, [
        el("div", { class: "k", text: "Preço (R$/un)" }),
        el("div", { class: "v money", text: money(fr.preco) })
      ])
    );
    priceRow.appendChild(
      el("div", { class: "kv" }, [
        el("div", { class: "k", text: "Custo (R$/un)" }),
        el("div", { class: "v money", text: money(fr.custo) })
      ])
    );

    const stockBadge = low
      ? el("div", { class: "muted", text: `Estoque: ${fr.estoque} (alerta ≤ ${fr.baixoEstoque})` })
      : el("div", { class: "muted", text: `Estoque: ${fr.estoque}` });

    const actions = el("div", { style: "display:flex; gap:10px; margin-top:12px; flex-wrap:wrap;" });
    const btnIncreasePrice = el("button", { class: "btn btn-ghost", type: "button", text: "+ preço (demo)" });
    btnIncreasePrice.addEventListener("click", () => {
      fr.preco = Math.round((fr.preco * 1.05 + Number.EPSILON) * 100) / 100;
      saveState();
      renderAll();
      toast("Preço atualizado (demo)");
    });

    const btnAddOneStock = el("button", { class: "btn btn-ghost", type: "button", text: "+1 estoque (demo)" });
    btnAddOneStock.addEventListener("click", () => {
      fr.estoque += 1;
      saveState();
      renderAll();
      toast("Estoque +1 (demo)");
    });

    actions.appendChild(btnIncreasePrice);
    actions.appendChild(btnAddOneStock);

    card.appendChild(top);
    card.appendChild(priceRow);
    card.appendChild(stockBadge);
    card.appendChild(actions);

    grid.appendChild(card);
  }
}

function renderStock() {
  const grid = $("#stockGrid");
  grid.innerHTML = "";

  const onlyLow = $("#btnLowStockOnly").dataset.on === "1";
  const filtered = onlyLow ? state.frutas.filter((f) => f.estoque <= f.baixoEstoque) : state.frutas;

  for (const fr of filtered) {
    const low = fr.estoque <= fr.baixoEstoque;
    const card = el("div", { class: "fruit-card" });

    const title = el("div", { class: "fruit-title" }, [
      el("div", { class: "fruit-name", text: fr.nome }),
      el("div", { class: `badge ${low ? "low" : "ok"}`, text: low ? "Baixo" : "Normal" })
    ]);

    const row = el("div", { class: "price-row" }, [
      el("div", { class: "kv" }, [
        el("div", { class: "k", text: "Estoque" }),
        el("div", { class: "v", text: `${fr.estoque} un` })
      ])
    ]);

    const stockInput = el("input", { class: "input", type: "number", min: "1", value: "10" });
    const btnAdd = el("button", { class: "btn", type: "button", text: "Repor" });
    btnAdd.addEventListener("click", () => {
      const add = Math.max(1, Number(stockInput.value || 0));
      fr.estoque += add;
      saveState();
      renderAll();
      toast(`Estoque de ${fr.nome}: +${add}`);
    });

    const inline = el("div", { style: "display:flex; gap:10px; align-items:center; margin-top: 12px;" }, [stockInput, btnAdd]);

    card.appendChild(title);
    card.appendChild(row);
    card.appendChild(el("div", { class: "muted", style: "margin-top:10px;", text: `Alerta: ≤ ${fr.baixoEstoque} un` }));
    card.appendChild(inline);

    grid.appendChild(card);
  }
}

function getSelectedMonthKey() {
  const input = $("#monthSelect");
  return input.value || getCurrentMonthKey();
}

function renderSalesTableForMonth(monthKey) {
  const tbody = $("#salesTbody");
  tbody.innerHTML = "";

  const list = state.vendas
    .filter((v) => v.monthKey === monthKey)
    .sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));

  const empty = $("#salesEmpty");
  empty.style.display = list.length ? "none" : "block";

  for (const sale of list) {
    const fr = fruitById(sale.frutaId);
    const fu = funcionarioById(sale.funcionarioId);

    const total = sale.qty * sale.precoUnit;

    const tr = el("tr", {}, [
      el("td", { text: new Date(sale.dateISO).toLocaleDateString("pt-BR") }),
      el("td", { text: fu?.nome || "—" }),
      el("td", { text: fr?.nome || "—" }),
      el("td", { text: String(sale.qty) }),
      el("td", { class: "money", text: money(sale.precoUnit) }),
      el("td", { class: "money", text: money(total) })
    ]);

    tbody.appendChild(tr);
  }
}

function renderDashboard() {
  const dashTbody = $("#dashTbody");
  dashTbody.innerHTML = "";

  const monthKey = getSelectedMonthKey();

  const empty = $("#dashEmpty");

  const vendasMes = state.vendas.filter((v) => v.monthKey === monthKey);

  if (!vendasMes.length) {
    empty.style.display = "block";
  } else {
    empty.style.display = "none";
  }

  // Agrega por funcionário
  const map = new Map();
  for (const f of state.funcionarios) {
    map.set(f.id, { funcionarioId: f.id, qtd: 0, sales: 0, cost: 0 });
  }

  for (const v of vendasMes) {
    const item = map.get(v.funcionarioId) || { funcionarioId: v.funcionarioId, qtd: 0, sales: 0, cost: 0 };
    item.qtd += v.qty;
    item.sales += v.qty * v.precoUnit;
    item.cost += v.qty * v.custoUnit;
    map.set(v.funcionarioId, item);
  }

  const rows = Array.from(map.values()).filter((r) => r.qtd > 0);
  // KPI total empresa
  const totalSales = rows.reduce((acc, r) => acc + r.sales, 0);
  const totalCost = rows.reduce((acc, r) => acc + r.cost, 0);
  const profit = totalSales - totalCost;

  $("#kpiSales").textContent = money(totalSales);
  $("#kpiCost").textContent = money(totalCost);
  $("#kpiProfit").textContent = money(profit);

  // Tabela
  dashTbody.innerHTML = "";
  for (const r of rows.sort((a, b) => b.sales - a.sales)) {
    const profitR = r.sales - r.cost;
    const f = funcionarioById(r.funcionarioId);
    dashTbody.appendChild(
      el("tr", {}, [
        el("td", { text: f?.nome || "—" }),
        el("td", { text: String(r.qtd) }),
        el("td", { class: "money", text: money(r.sales) }),
        el("td", { class: "money", text: money(r.cost) }),
        el("td", { class: "money", text: money(profitR) })
      ])
    );
  }
}

function renderAll() {
  renderFuncionariosSelects();
  renderFruitSelectSale();
  renderRestockFruitSelect();
  renderCatalog();
  renderStock();

  const monthKey = getSelectedMonthKey();
  renderSalesTableForMonth(monthKey);
  renderDashboard();
}

function ensureMonthInput() {
  const input = $("#monthSelect");
  const current = getCurrentMonthKey();
  if (!input.value) input.value = current;
}

function dateISONow() {
  return new Date().toISOString();
}

// Eventos (event delegation simples)
function initEvents() {
  document.querySelectorAll(".tab").forEach((b) => {
    b.addEventListener("click", () => switchPanel(b));
  });

  $("#searchInput").addEventListener("input", () => renderCatalog());

  // Botões de export/reset
  $("#btnExport").addEventListener("click", () => {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "frutaNobre_dados.json";
    a.click();
    URL.revokeObjectURL(url);
    toast("Exportação pronta (JSON)");
  });

  $("#btnReset").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    state = loadState();
    // garantir mês
    ensureMonthInput();
    renderAll();
    toast("Reset concluído (demo)");
  });

  // Low stock toggle
  $("#btnLowStockOnly").dataset.on = "0";
  $("#btnLowStockOnly").addEventListener("click", () => {
    const btn = $("#btnLowStockOnly");
    const on = btn.dataset.on === "1";
    btn.dataset.on = on ? "0" : "1";
    btn.textContent = on ? "Somente baixo estoque" : "Mostrando só baixo estoque";
    renderStock();
  });

  // Modal adicionar fruta (demo)
  const modalFruit = $("#modalFruit");
  const btnAddFruit = $("#btnAddFruit");
  const btnModalFruitSave = $("#btnModalFruitSave");

  const closeFruit = modalFruit.querySelector(".modal-close");
  btnAddFruit.addEventListener("click", () => {
    modalFruit.querySelector("#fruitName").value = "";
    modalFruit.querySelector("#fruitPrice").value = "";
    modalFruit.querySelector("#fruitCost").value = "";
    modalFruit.querySelector("#fruitStock").value = "0";
    modalFruit.querySelector("#fruitLowStock").value = "10";
    openModal(modalFruit);
  });

  closeFruit.addEventListener("click", () => closeModal(modalFruit));
  modalFruit.addEventListener("click", (e) => {
    if (e.target === modalFruit) closeModal(modalFruit);
  });

  btnModalFruitSave.addEventListener("click", () => {
    const nome = modalFruit.querySelector("#fruitName").value.trim();
    const preco = Number(modalFruit.querySelector("#fruitPrice").value);
    const custo = Number(modalFruit.querySelector("#fruitCost").value);
    const estoque = Math.max(0, Math.floor(Number(modalFruit.querySelector("#fruitStock").value || 0)));
    const baixoEstoque = Math.max(1, Math.floor(Number(modalFruit.querySelector("#fruitLowStock").value || 1)));

    if (!nome) return toast("Informe o nome da fruta.");
    if (!Number.isFinite(preco) || preco < 0) return toast("Preço inválido.");
    if (!Number.isFinite(custo) || custo < 0) return toast("Custo inválido.");

    state.frutas.push({
      id: crypto.randomUUID(),
      nome,
      preco: Math.round(preco * 100) / 100,
      custo: Math.round(custo * 100) / 100,
      estoque,
      baixoEstoque
    });

    saveState();
    closeModal(modalFruit);
    renderAll();
    toast("Fruta adicionada");
  });

  // Modal reposição
  const modalRestock = $("#modalRestock");
  const btnRestock = $("#btnRestock");
  const btnModalRestockSave = $("#btnModalRestockSave");
  const closeRestock = modalRestock.querySelector(".modal-close");

  btnRestock.addEventListener("click", () => {
    modalRestock.querySelector("#restockQty").value = "10";
    openModal(modalRestock);
  });

  closeRestock.addEventListener("click", () => closeModal(modalRestock));
  modalRestock.addEventListener("click", (e) => {
    if (e.target === modalRestock) closeModal(modalRestock);
  });

  btnModalRestockSave.addEventListener("click", () => {
    const frutaId = modalRestock.querySelector("#restockFruitSelect").value;
    const qty = Math.max(1, Math.floor(Number(modalRestock.querySelector("#restockQty").value || 0)));
    const fr = fruitById(frutaId);
    if (!fr) return toast("Selecione uma fruta.");

    fr.estoque += qty;
    saveState();
    closeModal(modalRestock);
    renderAll();
    toast(`Repor: ${fr.nome} +${qty}`);
  });

  // Vendas
  $("#monthSelect").addEventListener("change", () => {
    renderSalesTableForMonth(getSelectedMonthKey());
    renderDashboard();
  });

  // default funcionário
  let selectedFuncionarioId = state.funcionarios[0]?.id;
  $("#funcionarioSelect").addEventListener("change", (e) => {
    selectedFuncionarioId = e.target.value;
  });

  // Quando fruta muda, preenche preço do catálogo no campo opcional
  $("#saleFruitSelect").addEventListener("change", () => {
    const fr = fruitById($("#saleFruitSelect").value);
    // deixa campo override vazio: usuário decide
    $("#salePriceOverride").dataset.useDefault = "1";
    $("#salePriceOverride").placeholder = `Preço: ${money(fr?.preco || 0)}`;
    $("#salePriceOverride").value = "";
  });

  $("#btnAddSale").addEventListener("click", () => {
    // Seleção necessária
    const funcionarioId = $("#funcionarioSelect").value || selectedFuncionarioId;
    if (!funcionarioId) return toast("Selecione um funcionário.");

    const frutaId = $("#saleFruitSelect").value;
    const fr = fruitById(frutaId);
    if (!fr) return toast("Selecione uma fruta.");

    const qty = Math.max(1, Math.floor(Number($("#saleQty").value || 0)));
    if (!qty) return toast("Quantidade inválida.");

    // Preço do catálogo ou override
    const overrideRaw = $("#salePriceOverride").value;
    const useOverride = overrideRaw !== "" && Number.isFinite(Number(overrideRaw));
    const precoUnit = useOverride ? Number(overrideRaw) : fr.preco;
    const custoUnit = fr.custo; // custo estimado (poderia variar)

    if (qty > fr.estoque) {
      return toast(`Estoque insuficiente para ${fr.nome}. Em estoque: ${fr.estoque}`);
    }

    // aplica
    fr.estoque -= qty;

    const nowISO = dateISONow();
    const monthKey = getSelectedMonthKey();

    // se o mês selecionado for diferente do mês atual, mantemos vendas naquele mês (por KPI)
    // mantemos data real para exibir
    state.vendas.push({
      id: crypto.randomUUID(),
      dateISO: nowISO,
      monthKey,
      funcionarioId,
      frutaId,
      qty,
      precoUnit: Math.round(precoUnit * 100) / 100,
      custoUnit: Math.round(custoUnit * 100) / 100
    });

    saveState();

    // Atualiza UI
    renderAll();
    toast("Venda registrada");

    // opcional: limpa override
    $("#salePriceOverride").value = "";
    $("#saleQty").value = "1";
  });
}

// Corrigir: IDs do HTML
// No HTML está id="btnAddSale" e id="salePriceOverride" etc.
// (Mantemos o init para evitar erro)

function fixBindings() {
  // set listener correto
  const btn = $("#btnAddSale");
  if (!btn) return;

  btn.replaceWith(btn.cloneNode(true));
  const btn2 = $("#btnAddSale");

  btn2.addEventListener("click", () => {
    const funcionarioId = $("#funcionarioSelect").value || state.funcionarios[0]?.id;
    if (!funcionarioId) return toast("Selecione um funcionário.");

    const frutaId = $("#saleFruitSelect").value;
    const fr = fruitById(frutaId);
    if (!fr) return toast("Selecione uma fruta.");

    const qty = Math.max(1, Math.floor(Number($("#saleQty").value || 0)));
    if (!qty) return toast("Quantidade inválida.");

    const overrideRaw = $("#salePriceOverride").value;
    const useOverride = overrideRaw !== "" && Number.isFinite(Number(overrideRaw));
    const precoUnit = useOverride ? Number(overrideRaw) : fr.preco;
    const custoUnit = fr.custo;

    if (qty > fr.estoque) {
      return toast(`Estoque insuficiente para ${fr.nome}. Em estoque: ${fr.estoque}`);
    }

    fr.estoque -= qty;

    const nowISO = dateISONow();
    const monthKey = getSelectedMonthKey();

    state.vendas.push({
      id: crypto.randomUUID(),
      dateISO: nowISO,
      monthKey,
      funcionarioId,
      frutaId,
      qty,
      precoUnit: Math.round(precoUnit * 100) / 100,
      custoUnit: Math.round(custoUnit * 100) / 100
    });

    saveState();

    renderAll();
    toast("Venda registrada");

    $("#salePriceOverride").value = "";
    $("#saleQty").value = "1";
  });
}

function main() {
  // garantir mês inicial
  ensureMonthInput();

  // set placeholder do preço override
  const fr0 = fruitById($("#saleFruitSelect").value);
  $("#salePriceOverride").placeholder = `Preço: ${money(fr0?.preco || 0)}`;

  initEvents();
  fixBindings();
  renderAll();

  // ajustar botão low stock label
  const btnLow = $("#btnLowStockOnly");
  btnLow.textContent = "Somente baixo estoque";
}

// Boot
main();


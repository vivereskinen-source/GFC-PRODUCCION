
const DB_KEY = "gfc_produccion_db_v1";
let db = loadDB();
let currentCalculation = null;

function loadDB() {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) return { materials: [], formulas: [], lots: [] };
  try {
    const parsed = JSON.parse(raw);
    return {
      materials: parsed.materials || [],
      formulas: parsed.formulas || [],
      lots: parsed.lots || []
    };
  } catch {
    return { materials: [], formulas: [], lots: [] };
  }
}
function saveDB() {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  refreshAll();
}
function id(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}
function money(n) {
  return new Intl.NumberFormat("es-VE", { style:"currency", currency:"USD", minimumFractionDigits:2 }).format(Number(n)||0);
}
function num(n, d=4) {
  return new Intl.NumberFormat("es-VE", { minimumFractionDigits:d, maximumFractionDigits:d }).format(Number(n)||0);
}
function today() { return new Date().toISOString().slice(0,10); }
async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,"0")).join("");
}

function showView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === viewId));
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === viewId));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.view)));
document.querySelectorAll("[data-go]").forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.go)));

function refreshStats() {
  document.getElementById("statMaterials").textContent = db.materials.length;
  document.getElementById("statFormulas").textContent = db.formulas.length;
  document.getElementById("statLots").textContent = db.lots.length;
  const last = db.lots.at(-1);
  document.getElementById("statLastCost").textContent = last ? money(last.costPerKg) : money(0);
}

function renderMaterials() {
  const q = document.getElementById("materialSearch").value.toLowerCase();
  const list = document.getElementById("materialsList");
  const rows = db.materials.filter(m => m.name.toLowerCase().includes(q));
  list.innerHTML = rows.length ? rows.map(m => `
    <div class="list-item">
      <h4>${escapeHtml(m.name)}</h4>
      <p>${money(m.pricePerKg)} por kg</p>
      <p>${m.supplier ? `Proveedor: ${escapeHtml(m.supplier)} · ` : ""}Precio actualizado: ${m.priceDate}</p>
      <div class="item-actions">
        <button class="secondary" onclick="editMaterial('${m.id}')">Editar</button>
      </div>
    </div>
  `).join("") : `<p class="muted">No hay materias primas registradas.</p>`;
}

document.getElementById("materialPriceDate").value = today();
document.getElementById("productionDate").value = today();

document.getElementById("materialForm").addEventListener("submit", e => {
  e.preventDefault();
  const material = {
    id: document.getElementById("materialId").value || id("mat"),
    name: document.getElementById("materialName").value.trim(),
    pricePerKg: Number(document.getElementById("materialPrice").value),
    supplier: document.getElementById("materialSupplier").value.trim(),
    priceDate: document.getElementById("materialPriceDate").value
  };
  const idx = db.materials.findIndex(m => m.id === material.id);
  if (idx >= 0) db.materials[idx] = material; else db.materials.push(material);
  resetMaterialForm();
  saveDB();
});
function editMaterial(materialId) {
  const m = db.materials.find(x => x.id === materialId);
  if (!m) return;
  document.getElementById("materialId").value = m.id;
  document.getElementById("materialName").value = m.name;
  document.getElementById("materialPrice").value = m.pricePerKg;
  document.getElementById("materialSupplier").value = m.supplier;
  document.getElementById("materialPriceDate").value = m.priceDate;
  document.getElementById("cancelMaterialEdit").classList.remove("hidden");
  showView("materials");
}
function resetMaterialForm() {
  document.getElementById("materialForm").reset();
  document.getElementById("materialId").value = "";
  document.getElementById("materialPriceDate").value = today();
  document.getElementById("cancelMaterialEdit").classList.add("hidden");
}
document.getElementById("cancelMaterialEdit").addEventListener("click", resetMaterialForm);
document.getElementById("materialSearch").addEventListener("input", renderMaterials);

function materialOptions(selected="") {
  return `<option value="">Seleccione...</option>` + db.materials.map(m =>
    `<option value="${m.id}" ${m.id===selected?"selected":""}>${escapeHtml(m.name)}</option>`
  ).join("");
}
function addIngredientRow(data={materialId:"", amount:""}) {
  const tpl = document.getElementById("ingredientRowTemplate");
  const node = tpl.content.cloneNode(true);
  const row = node.querySelector(".ingredient-row");
  const select = row.querySelector(".ingredient-material");
  select.innerHTML = materialOptions(data.materialId);
  row.querySelector(".ingredient-amount").value = data.amount;
  row.querySelector(".remove-ingredient").addEventListener("click", () => {
    row.remove(); updateFormulaTotal();
  });
  row.querySelector(".ingredient-amount").addEventListener("input", updateFormulaTotal);
  document.getElementById("ingredientsEditor").appendChild(node);
  updateFormulaTotal();
}
document.getElementById("addIngredientBtn").addEventListener("click", () => addIngredientRow());
document.getElementById("formulaMode").addEventListener("change", () => {
  document.getElementById("formulaTotalUnit").textContent = document.getElementById("formulaMode").value === "percent" ? "%" : "kg";
});
function updateFormulaTotal() {
  const total = [...document.querySelectorAll(".ingredient-amount")].reduce((s, el) => s + Number(el.value || 0), 0);
  document.getElementById("formulaTotal").textContent = num(total, 4);
}
document.getElementById("formulaForm").addEventListener("submit", e => {
  e.preventDefault();
  const mode = document.getElementById("formulaMode").value;
  const ingredients = [...document.querySelectorAll(".ingredient-row")].map(row => ({
    materialId: row.querySelector(".ingredient-material").value,
    amount: Number(row.querySelector(".ingredient-amount").value)
  })).filter(x => x.materialId && x.amount > 0);

  if (!ingredients.length) return alert("Agrega al menos un ingrediente.");
  const total = ingredients.reduce((s,x)=>s+x.amount,0);
  if (mode === "percent" && Math.abs(total - 100) > 0.001) {
    return alert("Cuando la fórmula está en porcentaje, el total debe ser 100%.");
  }

  const formula = {
    id: document.getElementById("formulaId").value || id("for"),
    name: document.getElementById("formulaName").value.trim(),
    mode,
    ingredients
  };
  const idx = db.formulas.findIndex(f => f.id === formula.id);
  if (idx >= 0) db.formulas[idx] = formula; else db.formulas.push(formula);
  resetFormulaForm();
  saveDB();
});
function resetFormulaForm() {
  document.getElementById("formulaForm").reset();
  document.getElementById("formulaId").value = "";
  document.getElementById("ingredientsEditor").innerHTML = "";
  document.getElementById("formulaTotalUnit").textContent = "kg";
  document.getElementById("cancelFormulaEdit").classList.add("hidden");
  addIngredientRow();
}
function editFormula(formulaId) {
  const f = db.formulas.find(x => x.id === formulaId);
  if (!f) return;
  document.getElementById("formulaId").value = f.id;
  document.getElementById("formulaName").value = f.name;
  document.getElementById("formulaMode").value = f.mode;
  document.getElementById("formulaTotalUnit").textContent = f.mode === "percent" ? "%" : "kg";
  document.getElementById("ingredientsEditor").innerHTML = "";
  f.ingredients.forEach(addIngredientRow);
  document.getElementById("cancelFormulaEdit").classList.remove("hidden");
  showView("formulas");
}
document.getElementById("cancelFormulaEdit").addEventListener("click", resetFormulaForm);

function renderFormulas() {
  const list = document.getElementById("formulasList");
  list.innerHTML = db.formulas.length ? db.formulas.map(f => {
    const total = f.ingredients.reduce((s,x)=>s+x.amount,0);
    return `
      <div class="list-item">
        <h4>${escapeHtml(f.name)}</h4>
        <p>${f.ingredients.length} ingredientes · Base: ${num(total,4)} ${f.mode==="percent"?"%":"kg"}</p>
        <div class="item-actions">
          <button class="secondary" onclick="editFormula('${f.id}')">Editar</button>
          <button onclick="useFormula('${f.id}')">Usar en producción</button>
        </div>
      </div>`;
  }).join("") : `<p class="muted">No hay fórmulas guardadas.</p>`;
}

function renderProductionFormulaOptions() {
  const el = document.getElementById("productionFormula");
  const current = el.value;
  el.innerHTML = `<option value="">Seleccione...</option>` + db.formulas.map(f =>
    `<option value="${f.id}" ${f.id===current?"selected":""}>${escapeHtml(f.name)}</option>`
  ).join("");
}
function useFormula(formulaId) {
  renderProductionFormulaOptions();
  document.getElementById("productionFormula").value = formulaId;
  showView("production");
}

document.getElementById("calculateBtn").addEventListener("click", calculateProduction);
function calculateProduction() {
  const formula = db.formulas.find(f => f.id === document.getElementById("productionFormula").value);
  const targetKg = Number(document.getElementById("targetKg").value);
  if (!formula || targetKg <= 0) return alert("Selecciona una fórmula e indica una cantidad válida.");

  const baseTotal = formula.ingredients.reduce((s,x)=>s+x.amount,0);
  const rows = formula.ingredients.map(i => {
    const mat = db.materials.find(m => m.id === i.materialId);
    const ratio = formula.mode === "percent" ? i.amount/100 : i.amount/baseTotal;
    const quantityKg = ratio * targetKg;
    const pricePerKg = mat ? mat.pricePerKg : 0;
    return {
      materialId: i.materialId,
      materialName: mat?.name || "Materia prima eliminada",
      quantityKg,
      pricePerKg,
      cost: quantityKg * pricePerKg,
      priceDate: mat?.priceDate || "",
      supplier: mat?.supplier || ""
    };
  });
  const materialsCost = rows.reduce((s,x)=>s+x.cost,0);
  const extraCosts = Number(document.getElementById("extraCosts").value || 0);
  const totalCost = materialsCost + extraCosts;
  const actualKg = Number(document.getElementById("actualKg").value || 0);
  const divisorKg = actualKg > 0 ? actualKg : targetKg;
  const wastePercent = actualKg > 0 ? Math.max(0, ((targetKg-actualKg)/targetKg)*100) : 0;

  currentCalculation = {
    formulaId: formula.id,
    formulaName: formula.name,
    formulaMode: formula.mode,
    formulaSnapshot: JSON.parse(JSON.stringify(formula)),
    targetKg, actualKg: actualKg || null,
    date: document.getElementById("productionDate").value,
    responsible: document.getElementById("productionResponsible").value.trim(),
    notes: document.getElementById("productionNotes").value.trim(),
    rows, materialsCost, extraCosts, totalCost,
    costPerKg: totalCost / divisorKg,
    wastePercent
  };

  document.getElementById("calculationFormulaName").textContent = formula.name;
  document.getElementById("calculationRows").innerHTML = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.materialName)}</td>
      <td>${num(r.quantityKg,4)} kg</td>
      <td>${money(r.pricePerKg)}</td>
      <td>${money(r.cost)}</td>
    </tr>`).join("");
  document.getElementById("materialsCost").textContent = money(materialsCost);
  document.getElementById("extraCostSummary").textContent = money(extraCosts);
  document.getElementById("totalCost").textContent = money(totalCost);
  document.getElementById("costPerKg").textContent = money(currentCalculation.costPerKg);
  document.getElementById("wastePercent").textContent = `${num(wastePercent,2)}%`;
  document.getElementById("calculationCard").classList.remove("hidden");
}

document.getElementById("saveLotBtn").addEventListener("click", async () => {
  if (!currentCalculation) return;
  const previousHash = db.lots.at(-1)?.recordHash || "";
  const lotNumber = `L-${new Date().getFullYear()}-${String(db.lots.length+1).padStart(4,"0")}`;
  const immutableData = {
    ...currentCalculation,
    lotNumber,
    createdAt: new Date().toISOString(),
    previousHash
  };
  const recordHash = await sha256(JSON.stringify(immutableData));
  db.lots.push({ ...immutableData, recordHash });
  saveDB();
  currentCalculation = null;
  document.getElementById("calculationCard").classList.add("hidden");
  document.getElementById("productionForm").reset();
  document.getElementById("productionDate").value = today();
  document.getElementById("extraCosts").value = 0;
  alert(`Lote ${lotNumber} registrado. El registro quedó cerrado.`);
  showView("history");
});

function renderHistory() {
  const q = document.getElementById("historySearch").value.toLowerCase();
  const list = document.getElementById("historyList");
  const lots = [...db.lots].reverse().filter(l =>
    l.formulaName.toLowerCase().includes(q) || l.lotNumber.toLowerCase().includes(q)
  );
  list.innerHTML = lots.length ? lots.map(l => `
    <div class="list-item">
      <h4>${escapeHtml(l.lotNumber)} · ${escapeHtml(l.formulaName)}</h4>
      <p>${l.date} · Planificado: ${num(l.targetKg,3)} kg ${l.actualKg ? `· Real: ${num(l.actualKg,3)} kg` : ""}</p>
      <p><strong>${money(l.totalCost)}</strong> total · <strong>${money(l.costPerKg)}</strong>/kg</p>
      <details class="history-details">
        <summary>Ver detalle inalterable</summary>
        <p>Responsable: ${escapeHtml(l.responsible || "No indicado")}</p>
        <p>Merma: ${num(l.wastePercent,2)}%</p>
        <p>Observaciones: ${escapeHtml(l.notes || "Sin observaciones")}</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Ingrediente</th><th>Cantidad</th><th>Precio histórico</th><th>Costo</th></tr></thead>
            <tbody>${l.rows.map(r => `
              <tr><td>${escapeHtml(r.materialName)}</td><td>${num(r.quantityKg,4)} kg</td><td>${money(r.pricePerKg)}</td><td>${money(r.cost)}</td></tr>
            `).join("")}</tbody>
          </table>
        </div>
        <p class="muted">Huella: ${l.recordHash.slice(0,20)}…</p>
      </details>
    </div>
  `).join("") : `<p class="muted">No hay lotes registrados.</p>`;
}
document.getElementById("historySearch").addEventListener("input", renderHistory);

document.getElementById("backupBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gfc-respaldo-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function refreshAll() {
  refreshStats();
  renderMaterials();
  renderFormulas();
  renderProductionFormulaOptions();
  renderHistory();
}
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
}
resetFormulaForm();
refreshAll();

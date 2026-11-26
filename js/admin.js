(function () {
  const API = window.FortinAPI;
  const { price, esc } = window.FortinUtils;
  const $ = (s, r = document) => r.querySelector(s);

  let products = [];
  let editing = null;      // producto en edición (null = nuevo)
  let pendingFile = null;  // archivo elegido sin subir
  let imageUrl = null;     // url de imagen actual del formulario

  // ---------- Toasts ----------
  function toast(msg, type = "ok") {
    const el = document.createElement("div");
    el.className = `toast toast--${type}`;
    el.textContent = msg;
    $("#toasts").appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
  const errMsg = (e) => (e && e.message) || "Ocurrió un error inesperado.";

  // ---------- Vistas ----------
  async function boot() {
    $("#demoBanner").hidden = !API.isDemo;
    const session = await API.getSession();
    if (session) showApp(session); else showLogin();
  }
  function showLogin() {
    $("#appView").hidden = true;
    $("#loginView").hidden = false;
    if (API.isDemo) $("#loginForm [name=email]").value = "demo@elfortin.com";
  }
  async function showApp(session) {
    $("#loginView").hidden = true;
    $("#appView").hidden = false;
    $("#userEmail").textContent = session.user?.email || "";
    await refresh();
  }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = e.target.querySelector("button[type=submit]");
    $("#loginError").textContent = "";
    btn.disabled = true;
    try {
      await API.signIn(f.get("email").trim(), f.get("password"));
      showApp(await API.getSession());
    } catch (err) {
      $("#loginError").textContent = errMsg(err);
    } finally {
      btn.disabled = false;
    }
  });
  $("#logout").addEventListener("click", async () => { await API.signOut(); showLogin(); });
  $("#resetDemo").addEventListener("click", async () => {
    await API.resetDemo();
    toast("Se restauraron los productos de ejemplo.");
    if (!$("#appView").hidden) refresh();
  });

  // ---------- Listado ----------
  async function refresh() {
    try {
      products = await API.listProducts();
    } catch (e) {
      toast("No se pudieron cargar los productos: " + errMsg(e), "err");
      products = [];
    }
    render();
  }

  function render() {
    const q = $("#q").value.trim().toLowerCase();
    const list = products.filter((p) => !q || `${p.name} ${p.brand || ""} ${p.category || ""}`.toLowerCase().includes(q));
    const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
    const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))];

    $("#sTotal").textContent = products.length;
    $("#sFeat").textContent = products.filter((p) => p.featured).length;
    $("#sOut").textContent = products.filter((p) => p.available === false).length;
    $("#sCats").textContent = cats.length;
    $("#cats").innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join("");
    $("#brands").innerHTML = brands.map((c) => `<option value="${esc(c)}">`).join("");

    $("#aEmpty").hidden = products.length > 0;
    $("#list").innerHTML = list.map((p) => `
      <div class="row" data-id="${esc(p.id)}">
        <img class="row__img" src="${esc(p.image_url || "img/logo.svg")}" alt="" loading="lazy" />
        <div>
          <p class="row__name">${esc(p.name)}</p>
          <div class="row__meta">
            ${p.brand ? `<span class="pillx pillx--dark">${esc(p.brand)}</span>` : ""}
            ${p.category ? `<span class="pillx">${esc(p.category)}</span>` : ""}
            ${p.featured ? `<span class="pillx pillx--orange">Destacado</span>` : ""}
            ${p.available === false ? `<span class="pillx pillx--dark">Sin stock</span>` : ""}
          </div>
        </div>
        <span class="row__price">${price(p.price)}</span>
        <div class="row__actions">
          <button class="icon-btn" data-act="edit" title="Editar" aria-label="Editar ${esc(p.name)}">✏️</button>
          <button class="icon-btn icon-btn--danger" data-act="del" title="Eliminar" aria-label="Eliminar ${esc(p.name)}">🗑️</button>
        </div>
      </div>`).join("");
  }

  $("#q").addEventListener("input", render);
  $("#list").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const p = products.find((x) => String(x.id) === btn.closest(".row").dataset.id);
    if (!p) return;
    if (btn.dataset.act === "edit") openEditor(p);
    if (btn.dataset.act === "del") askDelete(p);
  });

  // ---------- Editor ----------
  const form = $("#pForm");
  function setPreview(src) {
    $("#preview").hidden = !src;
    if (src) $("#preview").src = src; else $("#preview").removeAttribute("src");
    $("#dropHint").hidden = !!src;
    $("#imgActions").hidden = !src;
  }

  function openEditor(p = null) {
    editing = p;
    pendingFile = null;
    imageUrl = p?.image_url || null;
    form.reset();
    form.name.classList.remove("is-invalid");
    $(".drawer__body").scrollTop = 0;
    $("#formError").textContent = "";
    $("#edTitle").textContent = p ? "Editar producto" : "Nuevo producto";
    form.name.value = p?.name || "";
    form.brand.value = p?.brand || "";
    form.category.value = p?.category || "";
    form.price.value = p?.price ?? "";
    form.description.value = p?.description || "";
    form.featured.checked = !!p?.featured;
    form.available.checked = p ? p.available !== false : true;
    setPreview(imageUrl);
    $("#editor").hidden = false;
    document.body.classList.add("no-scroll");
    setTimeout(() => form.name.focus(), 50);
  }
  function closeEditor() {
    $("#editor").hidden = true;
    document.body.classList.remove("no-scroll");
  }
  $("#newBtn").addEventListener("click", () => openEditor());
  $("#editor").addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeEditor(); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!$("#confirm").hidden) closeConfirm();
    else if (!$("#editor").hidden) closeEditor();
    else if (!$("#bulk").hidden) closeBulk();
  });

  // Imagen
  const fileInput = $("#file");
  function pickFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast("El archivo tiene que ser una imagen.", "err"); return; }
    if (file.size > 15 * 1024 * 1024) { toast("La imagen es muy pesada (máx. 15 MB).", "err"); return; }
    pendingFile = file;
    setPreview(URL.createObjectURL(file));
  }
  $("#drop").addEventListener("click", () => fileInput.click());
  $("#drop").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } });
  $("#changeImg").addEventListener("click", () => fileInput.click());
  $("#removeImg").addEventListener("click", () => { pendingFile = null; imageUrl = null; setPreview(null); });
  fileInput.addEventListener("change", () => { pickFile(fileInput.files[0]); fileInput.value = ""; });
  ["dragenter", "dragover"].forEach((ev) => $("#drop").addEventListener(ev, (e) => { e.preventDefault(); $("#drop").classList.add("is-over"); }));
  ["dragleave", "drop"].forEach((ev) => $("#drop").addEventListener(ev, (e) => { e.preventDefault(); $("#drop").classList.remove("is-over"); }));
  $("#drop").addEventListener("drop", (e) => pickFile(e.dataTransfer.files[0]));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#formError").textContent = "";
    const name = form.name.value.trim();
    form.name.classList.remove("is-invalid");
    if (!name) {
      $("#formError").textContent = "Falta el nombre del producto (primer campo de arriba).";
      form.name.classList.add("is-invalid");
      form.name.scrollIntoView({ behavior: "smooth", block: "center" });
      form.name.focus({ preventScroll: true });
      return;
    }
    const priceRaw = form.price.value.trim();
    if (priceRaw !== "" && (isNaN(Number(priceRaw)) || Number(priceRaw) < 0)) {
      $("#formError").textContent = "El precio tiene que ser un número positivo."; form.price.focus(); return;
    }

    const btn = $("#saveBtn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Guardando...`;
    const oldImage = editing?.image_url || null;
    try {
      let finalUrl = imageUrl;
      if (pendingFile) finalUrl = await API.uploadImage(pendingFile);
      const data = {
        name,
        brand: form.brand.value.trim() || null,
        category: form.category.value.trim() || null,
        price: priceRaw === "" ? null : Math.round(Number(priceRaw)),
        description: form.description.value.trim() || null,
        featured: form.featured.checked,
        available: form.available.checked,
        image_url: finalUrl,
      };
      if (editing) await API.updateProduct(editing.id, data);
      else await API.createProduct(data);
      if (oldImage && oldImage !== finalUrl) API.deleteImage(oldImage).catch(() => {});
      closeEditor();
      toast(editing ? "Producto actualizado ✔" : "Producto publicado ✔");
      await refresh();
    } catch (err) {
      $("#formError").textContent = "No se pudo guardar: " + errMsg(err);
    } finally {
      btn.disabled = false;
      btn.textContent = "Guardar";
    }
  });

  // ---------- Confirmación genérica ----------
  let confirmFn = null;
  function askConfirm({ title, text, ok, danger = true, run }) {
    $("#cfText").textContent = title;
    $("#cfSub").textContent = text;
    $("#cfOk").textContent = ok;
    $("#cfOk").className = "btn " + (danger ? "btn--danger" : "btn--primary");
    confirmFn = run;
    $("#confirm").hidden = false;
    $("#cfOk").focus();
  }
  function closeConfirm() { $("#confirm").hidden = true; confirmFn = null; }
  $("#confirm").addEventListener("click", (e) => { if (e.target.closest("[data-cancel]")) closeConfirm(); });
  $("#cfOk").addEventListener("click", async () => {
    const run = confirmFn;
    if (!run) return;
    const label = $("#cfOk").textContent;
    $("#cfOk").disabled = true;
    $("#cfOk").innerHTML = `<span class="spinner"></span> Procesando...`;
    try {
      await run();
      closeConfirm();
    } catch (err) {
      toast(errMsg(err), "err");
    } finally {
      $("#cfOk").disabled = false;
      $("#cfOk").textContent = label;
    }
  });

  // ---------- Eliminar ----------
  function askDelete(p) {
    askConfirm({
      title: `¿Eliminar "${p.name}"?`,
      text: "Esta acción no se puede deshacer.",
      ok: "Eliminar",
      run: async () => {
        await API.deleteProduct(p.id);
        API.deleteImage(p.image_url).catch(() => {});
        toast("Producto eliminado");
        await refresh();
      },
    });
  }

  // ---------- Actualización masiva de precios ----------
  const bulk = $("#bulk"), bf = $("#bulkForm");
  let facets = { brands: [], categories: [] };
  let lastPreview = null;
  const fmtN = (n) => Number(n).toLocaleString("es-AR");
  const calc = (price, pct, r) => Math.max(Math.round((Number(price) * (1 + pct / 100)) / r) * r, 0);

  async function openBulk() {
    bf.reset();
    $("#bulkError").textContent = "";
    $("#bulkPreview").innerHTML = "";
    bulk.hidden = false;
    document.body.classList.add("no-scroll");
    try { facets = await API.priceFacets(); } catch (e) { facets = { brands: [], categories: [] }; }
    fillValues();
    updatePreview();
    renderHistory();
  }
  function closeBulk() { bulk.hidden = true; document.body.classList.remove("no-scroll"); }

  function fillValues() {
    const scope = bf.scope.value;
    $("#valueWrap").hidden = scope === "all";
    $("#valueLabel").textContent = scope === "brand" ? "Marca" : "Categoría";
    const list = scope === "brand" ? facets.brands : facets.categories;
    bf.value.innerHTML = list.length
      ? list.map((x) => `<option value="${esc(x.name)}">${esc(x.name)} (${fmtN(x.total)})</option>`).join("")
      : `<option value="">No hay ${scope === "brand" ? "marcas" : "categorías"} cargadas</option>`;
  }
  function bulkFilters() {
    const scope = bf.scope.value, v = bf.value.value || null;
    return { brand: scope === "brand" ? v : null, category: scope === "category" ? v : null, missing: scope !== "all" && !v };
  }
  function bulkPercent() {
    const n = Number(String(bf.percent.value).replace(",", "."));
    if (!n || n <= 0 || n > 500) return null;
    return bf.dir.value === "down" ? -n : n;
  }

  let pvTimer, pvSeq = 0;
  function updatePreview() {
    clearTimeout(pvTimer);
    pvTimer = setTimeout(async () => {
      const seq = ++pvSeq;
      const f = bulkFilters(), pct = bulkPercent(), r = Number(bf.round.value);
      $("#bulkApply").disabled = true;
      lastPreview = null;
      if (f.missing) { $("#bulkPreview").innerHTML = "Elegí una opción para ver qué productos se actualizan."; return; }
      let pv;
      try { pv = await API.previewPriceUpdate(f); } catch (e) { $("#bulkPreview").textContent = "No se pudo calcular la vista previa."; return; }
      if (seq !== pvSeq) return;
      if (!pv.total) { $("#bulkPreview").innerHTML = "No hay productos con precio cargado para esa selección."; return; }
      const head = pct === null
        ? `Hay <b>${fmtN(pv.total)}</b> productos con precio en esta selección. Ingresá el porcentaje.`
        : `Se van a ${pct > 0 ? "aumentar" : "rebajar"} <b>${fmtN(pv.total)}</b> productos un <b>${Math.abs(pct)}%</b>. Ejemplos:`;
      const rows = pct === null ? "" : `<ul>${pv.sample.map((p) =>
        `<li><span>${esc(p.name)}</span><span><span class="old">${price(p.price)}</span><span class="new ${pct < 0 ? "is-down" : ""}">${price(calc(p.price, pct, r))}</span></span></li>`).join("")}</ul>`;
      $("#bulkPreview").innerHTML = head + rows;
      if (pct !== null) { lastPreview = { ...f, total: pv.total, percent: pct, round: r }; $("#bulkApply").disabled = false; }
    }, 250);
  }
  ["change", "input"].forEach((ev) => bf.addEventListener(ev, (e) => {
    if (e.target === bf.scope) fillValues();
    $("#bulkError").textContent = "";
    updatePreview();
  }));

  bf.addEventListener("submit", (e) => {
    e.preventDefault();
    const pv = lastPreview;
    if (!pv) { $("#bulkError").textContent = "Completá el porcentaje (entre 0,1 y 500)."; return; }
    const what = pv.brand ? `a la marca ${pv.brand}` : pv.category ? `a la categoría ${pv.category}` : "a todos los productos";
    askConfirm({
      title: `¿${pv.percent > 0 ? "Aumentar" : "Rebajar"} ${Math.abs(pv.percent)}% ${what}?`,
      text: `Se van a actualizar ${fmtN(pv.total)} productos. Si te equivocás, lo podés deshacer desde "Últimos cambios de precios".`,
      ok: "Sí, actualizar precios",
      danger: false,
      run: async () => {
        const res = await API.applyPriceUpdate({ brand: pv.brand, category: pv.category, percent: pv.percent, round: pv.round });
        toast(`Precios actualizados: ${fmtN(res.affected)} productos ✔`);
        bf.percent.value = "";
        await refresh();
        updatePreview();
        renderHistory();
      },
    });
  });

  async function renderHistory() {
    let list = [];
    try { list = await API.listPriceBatches(); } catch (e) { $("#bulkHist").innerHTML = `<p class="muted">No se pudo cargar el historial.</p>`; return; }
    if (!list.length) { $("#bulkHist").innerHTML = `<p class="muted">Todavía no hubo cambios masivos.</p>`; return; }
    const undoable = list.find((b) => !b.reverted_at);
    $("#bulkHist").innerHTML = list.map((b) => {
      const up = Number(b.percent) > 0;
      const d = new Date(b.created_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      return `<div class="hist-row ${b.reverted_at ? "is-reverted" : ""}">
        <div><b>${esc(b.description)}</b> · <span class="${up ? "pct-up" : "pct-down"}">${up ? "+" : ""}${Number(b.percent)}%</span><br>
        <span class="muted">${d} · ${fmtN(b.affected)} productos${b.reverted_at ? " · deshecho" : ""}</span></div>
        ${undoable && undoable.id === b.id ? `<button type="button" class="btn btn--outline btn--sm" data-undo="${esc(b.id)}">Deshacer</button>` : ""}
      </div>`;
    }).join("");
  }
  $("#bulkHist").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-undo]");
    if (!btn) return;
    askConfirm({
      title: "¿Deshacer este cambio de precios?",
      text: "Los productos vuelven al precio que tenían antes de ese cambio.",
      ok: "Sí, deshacer",
      danger: false,
      run: async () => {
        const n = await API.revertPriceUpdate(btn.dataset.undo);
        toast(`Cambio deshecho: ${fmtN(n)} productos volvieron a su precio anterior.`);
        await refresh();
        updatePreview();
        renderHistory();
      },
    });
  });

  $("#bulkBtn").addEventListener("click", openBulk);
  bulk.addEventListener("click", (e) => { if (e.target.closest("[data-bclose]")) closeBulk(); });

  boot();
})();

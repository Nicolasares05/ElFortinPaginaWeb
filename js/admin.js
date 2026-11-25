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
    const list = products.filter((p) => !q || `${p.name} ${p.category || ""}`.toLowerCase().includes(q));
    const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];

    $("#sTotal").textContent = products.length;
    $("#sFeat").textContent = products.filter((p) => p.featured).length;
    $("#sOut").textContent = products.filter((p) => p.available === false).length;
    $("#sCats").textContent = cats.length;
    $("#cats").innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join("");

    $("#aEmpty").hidden = products.length > 0;
    $("#list").innerHTML = list.map((p) => `
      <div class="row" data-id="${esc(p.id)}">
        <img class="row__img" src="${esc(p.image_url || "img/logo.svg")}" alt="" loading="lazy" />
        <div>
          <p class="row__name">${esc(p.name)}</p>
          <div class="row__meta">
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

  // ---------- Eliminar ----------
  let toDelete = null;
  function askDelete(p) {
    toDelete = p;
    $("#cfText").textContent = `¿Eliminar "${p.name}"?`;
    $("#confirm").hidden = false;
    $("#cfOk").focus();
  }
  function closeConfirm() { $("#confirm").hidden = true; toDelete = null; }
  $("#confirm").addEventListener("click", (e) => { if (e.target.closest("[data-cancel]")) closeConfirm(); });
  $("#cfOk").addEventListener("click", async () => {
    const p = toDelete;
    if (!p) return;
    $("#cfOk").disabled = true;
    try {
      await API.deleteProduct(p.id);
      API.deleteImage(p.image_url).catch(() => {});
      toast("Producto eliminado");
      closeConfirm();
      await refresh();
    } catch (err) {
      toast("No se pudo eliminar: " + errMsg(err), "err");
    } finally {
      $("#cfOk").disabled = false;
    }
  });

  boot();
})();

(function () {
  const cfg = window.FORTIN_CONFIG;
  const API = window.FortinAPI;
  const { price, esc, waLink } = window.FortinUtils;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---------- Datos del negocio en el HTML ----------
  $$("[data-bind]").forEach((el) => { el.textContent = cfg.business[el.dataset.bind] || ""; });
  $$("[data-bind-href]").forEach((el) => { el.href = cfg.business[el.dataset.bindHref] || "#"; });
  $$("[data-wa]").forEach((el) => { el.href = waLink(el.dataset.wa); });
  $("#year").textContent = new Date().getFullYear();

  // ---------- Header / menú ----------
  const header = $("#header");
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 10);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const burger = $("#burger"), nav = $("#nav");
  burger.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", String(open));
  });
  $$("#nav a").forEach((a) => a.addEventListener("click", () => {
    nav.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
  }));

  // ---------- Animaciones al hacer scroll ----------
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      }), { threshold: 0.12 })
    : null;
  const observe = (els) => els.forEach((el) => (io ? io.observe(el) : el.classList.add("is-in")));
  observe($$(".reveal"));

  // ---------- Productos ----------
  let products = [];
  const state = { q: "", cat: "Todos", sort: "new" };

  const card = (p) => `
    <article class="product reveal" data-id="${esc(p.id)}" tabindex="0" role="button" aria-label="Ver ${esc(p.name)}">
      <div class="product__media">
        ${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy" />` : `<div class="product__noimg"><img src="img/logo.svg" alt="" /></div>`}
        ${p.available === false ? `<span class="badge badge--out">Sin stock</span>` : p.featured ? `<span class="badge">Destacado</span>` : ""}
      </div>
      <div class="product__body">
        ${p.brand || p.category ? `<span class="product__cat">${esc([p.brand, p.category].filter(Boolean).join(" · "))}</span>` : ""}
        <h3>${esc(p.name)}</h3>
        <div class="product__foot">
          <span class="product__price ${p.price == null ? "is-ask" : ""}">${price(p.price)}</span>
          <span class="product__more" aria-hidden="true">Ver más →</span>
        </div>
      </div>
    </article>`;

  const skeletons = (n) => Array.from({ length: n }, () =>
    `<div class="product product--skel"><div class="product__media"></div><div class="product__body"><i></i><i></i><i></i></div></div>`).join("");

  function renderFeatured() {
    const feat = products.filter((p) => p.featured).slice(0, 4);
    $("#destacados-wrap").hidden = feat.length === 0;
    $("#featured").innerHTML = feat.map(card).join("");
    observe($$("#featured .reveal"));

    const hero = feat.find((p) => p.image_url) || products.find((p) => p.image_url);
    if (hero) {
      $("#heroCard").innerHTML = `
        <img class="hero__photo" src="${esc(hero.image_url)}" alt="" />
        <div class="hero__caption"><span>${esc(hero.name)}</span><b>${price(hero.price)}</b></div>`;
      $("#heroCard").classList.add("has-photo");
    }
  }

  function renderChips() {
    const cats = ["Todos", ...new Set(products.map((p) => p.category).filter(Boolean))];
    if (!cats.includes(state.cat)) state.cat = "Todos";
    $("#chips").innerHTML = cats.map((c) =>
      `<button class="chip ${c === state.cat ? "is-active" : ""}" role="tab" aria-selected="${c === state.cat}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
  }

  function renderCatalog() {
    const q = state.q.trim().toLowerCase();
    let list = products.filter((p) =>
      (state.cat === "Todos" || p.category === state.cat) &&
      (!q || `${p.name} ${p.brand || ""} ${p.description || ""} ${p.category || ""}`.toLowerCase().includes(q)));
    const num = (v) => (v == null ? Infinity : Number(v));
    if (state.sort === "price-asc") list.sort((a, b) => num(a.price) - num(b.price));
    if (state.sort === "price-desc") list.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    if (state.sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "es"));
    $("#catalog").innerHTML = list.map(card).join("");
    $("#empty").hidden = list.length > 0;
    observe($$("#catalog .reveal"));
  }

  async function load() {
    $("#featured").innerHTML = skeletons(4);
    $("#catalog").innerHTML = skeletons(8);
    try {
      products = await API.listProducts();
    } catch (e) {
      console.error(e);
      $("#catalog").innerHTML = `<p class="error">No pudimos cargar los productos. Probá recargar la página.</p>`;
      $("#featured").innerHTML = "";
      return;
    }
    renderFeatured();
    renderChips();
    renderCatalog();
  }

  $("#chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    state.cat = b.dataset.cat;
    renderChips();
    renderCatalog();
  });
  let t;
  $("#search").addEventListener("input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = e.target.value; renderCatalog(); }, 150);
  });
  $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; renderCatalog(); });
  $("#clearFilters").addEventListener("click", () => {
    state.q = ""; state.cat = "Todos"; $("#search").value = "";
    renderChips(); renderCatalog();
  });

  // ---------- Modal ----------
  const modal = $("#modal");
  let lastFocus = null;
  function openModal(p) {
    lastFocus = document.activeElement;
    $("#mImg").src = p.image_url || "img/logo.svg";
    $("#mImg").alt = p.name;
    $("#mCat").textContent = [p.brand, p.category].filter(Boolean).join(" · ") || "Producto";
    $("#mTitle").textContent = p.name;
    $("#mPrice").textContent = price(p.price);
    $("#mDesc").textContent = p.description || "";
    $("#mWa").href = waLink(`Hola El Fortín! Me interesa "${p.name}"${p.price != null ? ` (${price(p.price)})` : ""}. ¿Está disponible?`);
    modal.hidden = false;
    document.body.classList.add("no-scroll");
    $(".modal__close", modal).focus();
  }
  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("no-scroll");
    if (lastFocus) lastFocus.focus();
  }
  modal.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

  const openFromEvent = (e) => {
    const el = e.target.closest(".product[data-id]");
    if (!el) return;
    const p = products.find((x) => String(x.id) === el.dataset.id);
    if (p) openModal(p);
  };
  ["#featured", "#catalog"].forEach((sel) => {
    $(sel).addEventListener("click", openFromEvent);
    $(sel).addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFromEvent(e); }
    });
  });

  // ---------- Formulario de contacto -> WhatsApp ----------
  $("#contactForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const msg = `Hola El Fortín! Soy ${f.get("name")}${f.get("phone") ? ` (${f.get("phone")})` : ""}.\n\n${f.get("msg")}`;
    window.open(waLink(msg), "_blank", "noopener");
  });

  load();
})();

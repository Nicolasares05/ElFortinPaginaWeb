/* =========================================================
   Capa de datos: habla con Supabase o, si no está configurado,
   usa el "modo demo" (localStorage del navegador).
   ========================================================= */
(function () {
  const cfg = window.FORTIN_CONFIG;
  const isDemo = !(cfg.supabaseUrl && cfg.supabaseAnonKey);
  let sb = null;

  if (!isDemo) {
    if (!window.supabase) {
      console.error("No se cargó la librería de Supabase.");
    } else {
      sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    }
  }

  // ---------- Utilidades ----------
  const FIELDS = ["name", "description", "price", "category", "image_url", "featured", "available"];
  const clean = (p) => {
    const o = {};
    FIELDS.forEach((k) => { if (k in p) o[k] = p[k]; });
    return o;
  };
  const uid = () =>
    (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  // Imagen de ejemplo (se reemplaza subiendo fotos reales desde el panel)
  const ICONS = {
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8M8 9h2"/>',
    print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/>',
    ring: '<path d="M4 4h16v16H4zM8 4v16M4 8h-2M4 12h-2M4 16h-2M12 9h5M12 13h5"/>',
    layers: '<path d="M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
    pen: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>',
  };
  function placeholder(label, icon, a, b) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<rect width="600" height="600" fill="url(#g)"/>
<circle cx="300" cy="260" r="120" fill="#fff" opacity=".12"/>
<g fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(204 164) scale(8)">${ICONS[icon]}</g>
<text x="300" y="480" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="#fff" text-anchor="middle">${label}</text>
</svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  const now = Date.now();
  const SEED = [
    { name: "Fotocopia blanco y negro A4", category: "Fotocopias", price: 150, featured: true, available: true,
      description: "Precio por carilla. Simple o doble faz.\nConsultá descuentos por cantidad.\n\n(Producto y precio de ejemplo: editalo desde el panel)",
      image_url: placeholder("Fotocopias B/N", "doc", "#1F3C8F", "#0A2A6B") },
    { name: "Impresión color A4", category: "Impresiones", price: 600, featured: true, available: true,
      description: "Impresión láser color en papel 75 g u obra. Ideal para trabajos prácticos y presentaciones.\n\n(Ejemplo)",
      image_url: placeholder("Impresión color", "print", "#F26A21", "#C2410C") },
    { name: "Anillado hasta 100 hojas", category: "Encuadernación", price: 2500, featured: true, available: true,
      description: "Anillado plástico con tapa transparente y contratapa.\n\n(Ejemplo)",
      image_url: placeholder("Anillados", "ring", "#2563EB", "#1E3A8A") },
    { name: "Plastificado A4", category: "Encuadernación", price: 1500, featured: true, available: true,
      description: "Plastificado brillante para documentos, carteles y credenciales.\n\n(Ejemplo)",
      image_url: placeholder("Plastificados", "layers", "#0F766E", "#134E4A") },
    { name: "Impresión de planos A3", category: "Impresiones", price: null, featured: false, available: true,
      description: "Sin precio cargado: se muestra como \"Consultar\".\n\n(Ejemplo)",
      image_url: placeholder("Planos A3", "print", "#1D4ED8", "#F26A21") },
    { name: "Resma A4 75 g (500 hojas)", category: "Librería", price: 9500, featured: false, available: true,
      description: "Resma de papel A4 para impresora y fotocopiadora.\n\n(Ejemplo)",
      image_url: placeholder("Resma A4", "box", "#475569", "#1E293B") },
    { name: "Kit escolar de librería", category: "Librería", price: 12900, featured: false, available: false,
      description: "Marcado como sin stock: se ve en la página con la etiqueta correspondiente.\n\n(Ejemplo)",
      image_url: placeholder("Kit escolar", "pen", "#F26A21", "#1F3C8F") },
  ].map((p, i) => ({ ...p, id: "demo-" + i, created_at: new Date(now - i * 3600e3).toISOString() }));

  const DEMO_KEY = "fortin_demo_products_v2";
  const DEMO_SESSION = "fortin_demo_session";

  function demoLoad() {
    try {
      const raw = localStorage.getItem(DEMO_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* sin storage: usamos los de ejemplo */ }
    return SEED.map((x) => ({ ...x }));
  }
  function demoSave(list) {
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(list));
    } catch (e) {
      throw new Error("No se pudo guardar en modo demo (almacenamiento del navegador lleno o bloqueado).");
    }
  }

  function translateAuth(msg) {
    if (/invalid login/i.test(msg)) return "Email o contraseña incorrectos.";
    if (/email not confirmed/i.test(msg)) return "Tenés que confirmar el email antes de ingresar.";
    return msg;
  }

  // ---------- Compresión de imágenes ----------
  function compressImage(file, maxSize, quality) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => resolve(blob || file), "image/webp", quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }
  const blobToDataURL = (blob) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });

  // ---------- API pública ----------
  const API = {
    isDemo,

    async listProducts() {
      if (isDemo) {
        return demoLoad().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }
      const { data, error } = await sb.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },

    async createProduct(p) {
      if (isDemo) {
        const list = demoLoad();
        const item = { ...clean(p), id: uid(), created_at: new Date().toISOString() };
        list.push(item);
        demoSave(list);
        return item;
      }
      const { data, error } = await sb.from("products").insert(clean(p)).select().single();
      if (error) throw error;
      return data;
    },

    async updateProduct(id, p) {
      if (isDemo) {
        const list = demoLoad();
        const i = list.findIndex((x) => x.id === id);
        if (i < 0) throw new Error("Producto no encontrado");
        list[i] = { ...list[i], ...clean(p) };
        demoSave(list);
        return list[i];
      }
      const { data, error } = await sb.from("products").update(clean(p)).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },

    async deleteProduct(id) {
      if (isDemo) {
        demoSave(demoLoad().filter((x) => x.id !== id));
        return;
      }
      const { error } = await sb.from("products").delete().eq("id", id);
      if (error) throw error;
    },

    async uploadImage(file) {
      if (isDemo) {
        const blob = await compressImage(file, 900, 0.8);
        return blobToDataURL(blob);
      }
      const blob = await compressImage(file, 1400, 0.85);
      const ext = blob.type === "image/webp" ? "webp" : (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await sb.storage.from(cfg.storageBucket)
        .upload(path, blob, { contentType: blob.type || file.type, cacheControl: "31536000" });
      if (error) throw error;
      return sb.storage.from(cfg.storageBucket).getPublicUrl(path).data.publicUrl;
    },

    async deleteImage(url) {
      if (isDemo || !url) return;
      const marker = `/storage/v1/object/public/${cfg.storageBucket}/`;
      const i = url.indexOf(marker);
      if (i < 0) return;
      await sb.storage.from(cfg.storageBucket).remove([decodeURIComponent(url.slice(i + marker.length))]);
    },

    // --- Autenticación ---
    async getSession() {
      if (isDemo) {
        try { return sessionStorage.getItem(DEMO_SESSION) ? { user: { email: "demo@elfortin.com" } } : null; }
        catch (e) { return null; }
      }
      const { data } = await sb.auth.getSession();
      return data.session;
    },

    async signIn(email, password) {
      if (isDemo) {
        if (password !== "demo") throw new Error('Modo demo: la contraseña es "demo".');
        try { sessionStorage.setItem(DEMO_SESSION, "1"); } catch (e) { /* ignorar */ }
        return;
      }
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(translateAuth(error.message));
    },

    async signOut() {
      if (isDemo) {
        try { sessionStorage.removeItem(DEMO_SESSION); } catch (e) { /* ignorar */ }
        return;
      }
      await sb.auth.signOut();
    },

    async resetDemo() {
      try { localStorage.removeItem(DEMO_KEY); } catch (e) { /* ignorar */ }
    },
  };

  // ---------- Helpers compartidos ----------
  const fmt = new Intl.NumberFormat(cfg.currency.locale, {
    style: "currency", currency: cfg.currency.code, maximumFractionDigits: 0,
  });
  window.FortinUtils = {
    price: (v) => (v === null || v === undefined || v === "" ? "Consultar" : fmt.format(Number(v))),
    esc: (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
    waLink: (text) =>
      `https://wa.me/${cfg.business.whatsapp}?text=${encodeURIComponent(text)}`,
  };

  window.FortinAPI = API;
})();

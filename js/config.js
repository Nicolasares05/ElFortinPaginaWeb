/* =========================================================
   CONFIGURACIÓN DE EL FORTÍN
   Este es el único archivo que necesitás tocar para:
   - Conectar la base de datos (Supabase)
   - Cambiar los datos de contacto del negocio
   ========================================================= */
window.FORTIN_CONFIG = {
  // --- Supabase (base de datos + imágenes + login del panel) ---
  // Si dejás estos dos campos vacíos, la página funciona en "MODO DEMO":
  // los productos se guardan solo en tu navegador (ideal para mostrarle al cliente).
  supabaseUrl: "",      // ej: "https://abcdefgh.supabase.co"
  supabaseAnonKey: "",  // la "anon public key" de Supabase (es pública, no es secreta)
  storageBucket: "productos",

  // --- Datos del negocio ---
  business: {
    name: "El Fortín",
    whatsapp: "5491100000000",            // código de país + área + número, sin + ni espacios
    phone: "+54 9 11 0000-0000",
    email: "contacto@elfortin.com",
    address: "Av. Siempre Viva 123, Buenos Aires",
    hours: "Lunes a Sábado · 9 a 20 hs",
    instagram: "https://instagram.com/",
    facebook: "https://facebook.com/",
  },

  // --- Moneda ---
  currency: { locale: "es-AR", code: "ARS" },
};

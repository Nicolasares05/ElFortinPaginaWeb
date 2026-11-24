# El Fortín · Centro de Copiado

Página web de El Fortín con **panel de administración**. El dueño entra a `/admin.html`, carga o edita productos y servicios con foto, precio y categoría, y los cambios aparecen **al instante** en la página.

- **Página pública** (`index.html`): portada, destacados, catálogo con buscador y filtros por categoría, sección "Nosotros", contacto por WhatsApp y diseño adaptado a celular.
- **Panel** (`admin.html`): acceso con email y contraseña, alta, edición y borrado de productos, subida de fotos (se comprimen solas), destacados y control de stock.
- **Tecnología**: HTML, CSS y JavaScript puros, sin compilar nada. Los datos, las fotos y el login van en [Supabase](https://supabase.com), que tiene plan gratis.

---

## 0. Probarlo ya (modo demo)

Abrí `index.html` en el navegador. Mientras Supabase no esté configurado, la página funciona en **modo demo**:
- Muestra productos de ejemplo.
- En `admin.html` entrás con cualquier email y la contraseña **`demo`**.
- Los cambios se guardan solo en tu navegador. Sirve para mostrarle al cliente cómo funciona.

> Tip: para verla como en un servidor real, corré `python3 -m http.server 8000` en la carpeta y entrá a http://localhost:8000

## 1. Crear la base de datos (Supabase, gratis)

1. Creá una cuenta en https://supabase.com y después un **New project**. Elegí la región São Paulo, que es la más cercana a Argentina.
2. Entrá a **SQL Editor → New query**, pegá todo el contenido de `supabase/schema.sql` y apretá **Run**.
3. Entrá a **Authentication → Users → Add user → Create new user**. Poné el email y la contraseña del cliente y tildá *Auto Confirm User*. Ese será su usuario para el panel.
4. Entrá a **Authentication → Sign In / Providers** y **desactivá "Allow new users to sign up"**. Así nadie más puede crearse una cuenta.
5. Entrá a **Project Settings → API** y copiá:
   - `Project URL`
   - `anon public` key
6. Pegá esos dos valores en `js/config.js`:

```js
supabaseUrl: "https://xxxx.supabase.co",
supabaseAnonKey: "eyJhbGciOi...",
```

La *anon key* es pública: está pensada para ir en la página. La seguridad la dan las reglas del paso 2: cualquiera puede **ver** los productos, pero solo un usuario logueado puede **modificarlos**.

## 2. Datos del negocio

En `js/config.js` cambiá el número de WhatsApp, el teléfono, el email, la dirección, los horarios y las redes. Se actualizan solos en toda la página.

Los textos de la portada, "Nosotros", etc. están en `index.html`.

**Logo:** `img/logo.svg` es el logo en vector (tipografías convertidas a trazos, se ve nítido en cualquier tamaño). Los colores son azul `#2A3482` y naranja `#E8642E`.

## 3. Publicar la página (gratis)

Opción recomendada: **Netlify** o **Vercel**.
1. Creá una cuenta e importá este repositorio de GitHub (*Add new site → Import from Git*).
2. No hace falta configurar nada: no hay comando de build y la carpeta de publicación es la raíz.
3. Cada vez que hagas cambios en GitHub, la página se actualiza sola.

Los **productos** no necesitan volver a publicarse: se cargan desde el panel y se ven al instante.

## 4. Dominio

> ⚠️ **elfortin.com ya está registrado** por otra persona desde 1997 y está renovado hasta 2027. También están ocupados elfortin.com.ar y elfortin.ar.

Opciones:
- **Opción A: un .com libre con el nombre del negocio.** Por ejemplo `elfortincopias.com`, `elfortincopiado.com` o `fortincopias.com`. Comprobá la disponibilidad en Namecheap, GoDaddy o Cloudflare antes de comprar.
- **Opción B: un .com.ar en [NIC Argentina](https://nic.ar).** Es muy barato, por ejemplo `elfortincopias.com.ar`.
- **Opción C: intentar comprar elfortin.com.** Se le puede hacer una oferta al dueño actual con el servicio de *Domain Broker* de GoDaddy. Puede ser caro y no siempre lo venden.

Con el dominio comprado, en Netlify o Vercel entrá a **Domain settings → Add domain** y seguí las instrucciones para apuntar los DNS. El certificado HTTPS es automático.

## Estructura

```
index.html          Página pública
admin.html          Panel de administración
css/styles.css      Estilos y paleta (variables al inicio del archivo)
css/admin.css       Estilos del panel
js/config.js        ← Configuración (Supabase + datos del negocio)
js/data.js          Conexión con la base de datos / modo demo
js/main.js          Lógica de la página
js/admin.js         Lógica del panel
supabase/schema.sql Script de la base de datos
img/logo.svg        Logo
```

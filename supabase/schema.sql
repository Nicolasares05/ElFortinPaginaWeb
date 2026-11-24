-- =========================================================
-- EL FORTÍN · Base de datos (Supabase)
-- Pegá TODO este archivo en Supabase → SQL Editor → Run.
-- =========================================================

-- 1) Tabla de productos
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 2000),
  price       numeric(12,2) check (price is null or price >= 0),
  category    text check (char_length(category) <= 60),
  image_url   text,
  featured    boolean not null default false,
  available   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 2) Seguridad: cualquiera puede VER, solo usuarios logueados pueden MODIFICAR
alter table public.products enable row level security;

drop policy if exists "Lectura pública" on public.products;
create policy "Lectura pública" on public.products
  for select using (true);

drop policy if exists "Admin inserta" on public.products;
create policy "Admin inserta" on public.products
  for insert to authenticated with check (true);

drop policy if exists "Admin edita" on public.products;
create policy "Admin edita" on public.products
  for update to authenticated using (true) with check (true);

drop policy if exists "Admin borra" on public.products;
create policy "Admin borra" on public.products
  for delete to authenticated using (true);

-- 3) Carpeta pública para las fotos de los productos
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do update set public = true;

drop policy if exists "Fotos: lectura pública" on storage.objects;
create policy "Fotos: lectura pública" on storage.objects
  for select using (bucket_id = 'productos');

drop policy if exists "Fotos: admin sube" on storage.objects;
create policy "Fotos: admin sube" on storage.objects
  for insert to authenticated with check (bucket_id = 'productos');

drop policy if exists "Fotos: admin edita" on storage.objects;
create policy "Fotos: admin edita" on storage.objects
  for update to authenticated using (bucket_id = 'productos');

drop policy if exists "Fotos: admin borra" on storage.objects;
create policy "Fotos: admin borra" on storage.objects
  for delete to authenticated using (bucket_id = 'productos');

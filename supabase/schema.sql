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

-- =========================================================
-- 4) Marca + actualización masiva de precios (ej: "+5% a BIC")
-- =========================================================
alter table public.products add column if not exists brand text check (char_length(brand) <= 60);
create index if not exists products_brand_idx    on public.products (lower(brand));
create index if not exists products_category_idx on public.products (lower(category));

-- Historial de cambios masivos (permite "Deshacer")
create table if not exists public.price_batches (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  description text not null,
  percent     numeric(8,3) not null,
  affected    integer not null default 0,
  reverted_at timestamptz
);
create table if not exists public.price_history (
  batch_id   bigint not null references public.price_batches(id) on delete cascade,
  product_id uuid   not null references public.products(id) on delete cascade,
  old_price  numeric(12,2),
  primary key (batch_id, product_id)
);
alter table public.price_batches enable row level security;
alter table public.price_history enable row level security;
drop policy if exists "Admin historial lotes" on public.price_batches;
create policy "Admin historial lotes" on public.price_batches for all to authenticated using (true) with check (true);
drop policy if exists "Admin historial precios" on public.price_history;
create policy "Admin historial precios" on public.price_history for all to authenticated using (true) with check (true);

-- Marcas y categorías con cantidad de productos
create or replace function public.product_facets()
returns json language sql stable security invoker set search_path = public as $$
  select json_build_object(
    'brands', coalesce((select json_agg(x order by x.name) from (
        select min(brand) as name, count(*) as total from products
        where coalesce(brand, '') <> '' group by lower(brand)) x), '[]'::json),
    'categories', coalesce((select json_agg(x order by x.name) from (
        select min(category) as name, count(*) as total from products
        where coalesce(category, '') <> '' group by lower(category)) x), '[]'::json)
  );
$$;

-- Vista previa: cuántos productos se tocan y 3 ejemplos
create or replace function public.preview_price_update(p_brand text, p_category text)
returns json language sql stable security invoker set search_path = public as $$
  with t as (
    select name, price from products
    where price is not null
      and (p_brand is null or lower(brand) = lower(p_brand))
      and (p_category is null or lower(category) = lower(p_category))
  )
  select json_build_object(
    'total',  (select count(*) from t),
    'sample', coalesce((select json_agg(s) from (select name, price from t order by name limit 3) s), '[]'::json)
  );
$$;

-- Aplicar el porcentaje (una sola consulta, sirve para cientos de miles de productos)
create or replace function public.apply_price_update(p_brand text, p_category text, p_percent numeric, p_round integer default 1)
returns json language plpgsql security invoker set search_path = public as $$
declare
  b bigint;
  n integer;
  r integer := greatest(coalesce(p_round, 1), 1);
begin
  if auth.uid() is null then raise exception 'No autorizado'; end if;
  if p_percent is null or p_percent = 0 or p_percent <= -100 or p_percent > 500 then
    raise exception 'Porcentaje inválido';
  end if;

  insert into price_batches (description, percent)
  values (coalesce('Marca: ' || nullif(p_brand, ''), 'Categoría: ' || nullif(p_category, ''), 'Todos los productos'), p_percent)
  returning id into b;

  insert into price_history (batch_id, product_id, old_price)
  select b, id, price from products
  where price is not null
    and (p_brand is null or lower(brand) = lower(p_brand))
    and (p_category is null or lower(category) = lower(p_category));

  update products p
     set price = greatest(round(h.old_price * (1 + p_percent / 100) / r) * r, 0)
    from price_history h
   where h.batch_id = b and h.product_id = p.id;
  get diagnostics n = row_count;

  update price_batches set affected = n where id = b;
  return json_build_object('batch_id', b, 'affected', n);
end $$;

-- Deshacer (solo el último cambio que no fue deshecho)
create or replace function public.revert_price_update(p_batch bigint)
returns integer language plpgsql security invoker set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'No autorizado'; end if;
  if not exists (select 1 from price_batches where id = p_batch and reverted_at is null) then
    raise exception 'Ese cambio ya fue deshecho o no existe.';
  end if;
  if exists (select 1 from price_batches where id > p_batch and reverted_at is null) then
    raise exception 'Primero deshacé los cambios más recientes.';
  end if;
  update products p set price = h.old_price
    from price_history h
   where h.batch_id = p_batch and h.product_id = p.id;
  get diagnostics n = row_count;
  update price_batches set reverted_at = now() where id = p_batch;
  return n;
end $$;

-- Solo el usuario logueado (el dueño) puede usar estas funciones
revoke all on function public.product_facets()                                   from public, anon;
revoke all on function public.preview_price_update(text, text)                   from public, anon;
revoke all on function public.apply_price_update(text, text, numeric, integer)   from public, anon;
revoke all on function public.revert_price_update(bigint)                        from public, anon;
grant execute on function public.product_facets()                                 to authenticated;
grant execute on function public.preview_price_update(text, text)                 to authenticated;
grant execute on function public.apply_price_update(text, text, numeric, integer) to authenticated;
grant execute on function public.revert_price_update(bigint)                      to authenticated;

-- Más tiempo para operaciones grandes (ej: actualizar 500.000 precios de una vez)
alter role authenticated set statement_timeout = '120s';

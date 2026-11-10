-- Vespra Event : stockage du back-office dans Supabase
-- À coller dans Supabase > SQL Editor > New query > Run (une seule fois).
-- Sans risque : le script peut être relancé, il ne supprime rien.

create table if not exists public.kv (
  store    text        not null,                 -- ex. vespra-admin-data
  key      text        not null,                 -- ex. reservations/123
  texte    text,                                 -- contenu texte / JSON
  octets   text,                                 -- contenu binaire (PDF, photos) en base64
  metadata jsonb       not null default '{}'::jsonb,
  etag     text        not null default gen_random_uuid()::text,
  maj      timestamptz not null default now(),
  primary key (store, key)
);

-- Sécurité : RLS activée SANS aucune règle = personne n'accède à la table
-- avec la clé publique (anon). Seule la clé secrète « service_role »,
-- gardée dans les variables Netlify, passe.
alter table public.kv enable row level security;
revoke all on public.kv from anon, authenticated;

-- Liste des clés d'un « dossier » (équivalent de store.list({ prefix })).
create or replace function public.kv_liste(
  p_store text, p_prefix text default '', p_depart int default 0, p_lot int default 1000
) returns table(key text, etag text)
language sql stable security invoker set search_path = public as $$
  select k.key, k.etag from public.kv k
  where k.store = p_store and starts_with(k.key, p_prefix)
  order by k.key offset p_depart limit p_lot
$$;
revoke all on function public.kv_liste(text, text, int, int) from public, anon, authenticated;
grant execute on function public.kv_liste(text, text, int, int) to service_role;
grant all on public.kv to service_role;

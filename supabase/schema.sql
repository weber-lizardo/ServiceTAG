-- Execute no SQL Editor do Supabase
create table if not exists public.service_tags (
  id                 bigint generated always as identity primary key,
  local              text        not null,
  service_tag        text        not null unique,
  dispositivo        text,
  garantia           text,
  garantia_status    text,
  garantia_expira_em date,
  consultado_em      timestamptz not null default now()
);

create index if not exists service_tags_local_idx on public.service_tags (local);

-- O servidor usa a service_role key, que ignora RLS.
-- Com RLS ligado e sem políticas, a anon key não lê nem grava nada.
alter table public.service_tags enable row level security;

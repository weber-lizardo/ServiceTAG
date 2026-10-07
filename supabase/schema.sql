-- Execute no SQL Editor do Supabase
-- Padrão do projeto: toda tabela começa com "servicetag_".
create table if not exists public.servicetag_service_tags (
  id                 bigint generated always as identity primary key,
  local              text        not null check (local in (
                       'ADRA-ES','ADRA-MG','ADRA-RJ','AES','AMC','AML','AMS','ARC','ARF',
                       'ARS','ASES','EDESSA','FADMINAS','IPAE','MMN','MMO','NET','USEB')),
  service_tag        text        not null unique check (service_tag ~ '^[A-Z0-9]{5,7}$'),
  dispositivo        text,
  garantia           text,
  garantia_status    text,
  garantia_expira_em date,
  -- pendente: aguardando o GitHub Action | concluida | erro
  situacao           text        not null default 'pendente'
                       check (situacao in ('pendente', 'concluida', 'erro')),
  erro               text,
  criado_em          timestamptz not null default now(),
  consultado_em      timestamptz
);

create index if not exists servicetag_service_tags_local_idx
  on public.servicetag_service_tags (local);
create index if not exists servicetag_service_tags_situacao_idx
  on public.servicetag_service_tags (situacao);

-- Acesso pela página publicada (anon key, sem login):
-- qualquer pessoa pode ler e enviar tags para consulta, mas não apagar
-- nem escrever dispositivo/garantia (isso só o GitHub Action, com a service_role key).
alter table public.servicetag_service_tags enable row level security;

drop policy if exists servicetag_service_tags_select on public.servicetag_service_tags;
create policy servicetag_service_tags_select on public.servicetag_service_tags
  for select to anon using (true);

drop policy if exists servicetag_service_tags_insert on public.servicetag_service_tags;
create policy servicetag_service_tags_insert on public.servicetag_service_tags
  for insert to anon with check (situacao = 'pendente');

drop policy if exists servicetag_service_tags_update on public.servicetag_service_tags;
create policy servicetag_service_tags_update on public.servicetag_service_tags
  for update to anon using (true) with check (situacao = 'pendente');

revoke all on public.servicetag_service_tags from anon;
grant select on public.servicetag_service_tags to anon;
grant insert (local, service_tag, situacao, erro) on public.servicetag_service_tags to anon;
grant update (local, service_tag, situacao, erro) on public.servicetag_service_tags to anon;

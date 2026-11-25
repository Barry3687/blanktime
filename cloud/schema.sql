-- Run once in the user's Supabase SQL editor. No public course or file storage.
begin;
create table if not exists public.blanktime_documents (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('course', 'progress', 'mastery', 'timer', 'schedule')),
  document_id text not null check (document_id ~ '^[a-z0-9][a-z0-9:-]{0,159}$'),
  revision bigint not null default 1 check (revision > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, document_id)
);
alter table public.blanktime_documents drop constraint if exists blanktime_documents_kind_check;
alter table public.blanktime_documents add constraint blanktime_documents_kind_check check (kind in ('course','progress','mastery','timer','schedule'));
create table if not exists public.blanktime_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  request jsonb not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);
alter table public.blanktime_documents enable row level security;
alter table public.blanktime_operations enable row level security;
revoke all on public.blanktime_documents, public.blanktime_operations from anon, authenticated;
grant select on public.blanktime_documents to authenticated;
drop policy if exists blanktime_read_own on public.blanktime_documents;
create policy blanktime_read_own on public.blanktime_documents
  for select to authenticated using ((select auth.uid()) = user_id);
-- Writes are only allowed through the checked, revision-aware function below.
create or replace function public.blanktime_read_documents()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); result jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) into result
  from public.blanktime_documents d where d.user_id = actor;
  return jsonb_build_object('documents', result, 'server_now', extract(epoch from clock_timestamp()) * 1000);
end;
$$;
create or replace function public.blanktime_put_document(
  p_kind text, p_document_id text, p_expected_revision bigint,
  p_payload jsonb, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); current_row public.blanktime_documents%rowtype;
  prior public.blanktime_operations%rowtype; request_value jsonb; result jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_kind not in ('course','progress','mastery','timer','schedule') or p_kind is null
    or p_document_id is null or p_document_id !~ '^[a-z0-9][a-z0-9:-]{0,159}$'
    or p_expected_revision is null or p_expected_revision < 0 or p_operation_id is null
    or p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 5242880 then
    raise exception 'Invalid document' using errcode = '22023';
  end if;
  if p_kind = 'timer' and p_document_id <> 'shared' then
    raise exception 'Only one shared timer is allowed' using errcode = '22023';
  end if;
  request_value := jsonb_build_object('kind',p_kind,'id',p_document_id,'revision',p_expected_revision,'payload',p_payload);
  -- Serialize requests per account, including initial creation and request replay.
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  select * into prior from public.blanktime_operations
    where user_id = actor and operation_id = p_operation_id;
  if found then
    if prior.request <> request_value then raise exception 'Operation ID reused with different content'; end if;
    return prior.response || jsonb_build_object('server_now',extract(epoch from clock_timestamp()) * 1000);
  end if;
  select * into current_row from public.blanktime_documents
    where user_id = actor and kind = p_kind and document_id = p_document_id for update;
  if (found and current_row.revision <> p_expected_revision)
     or (not found and p_expected_revision <> 0) then
    return jsonb_build_object('ok',false,'conflict',true,
      'document',case when current_row.user_id is null then null else to_jsonb(current_row) end,
      'server_now',extract(epoch from clock_timestamp()) * 1000);
  end if;
  insert into public.blanktime_documents(user_id,kind,document_id,revision,payload,updated_at)
  values(actor,p_kind,p_document_id,p_expected_revision+1,p_payload,clock_timestamp())
  on conflict (user_id,kind,document_id) do update
    set revision=excluded.revision,payload=excluded.payload,updated_at=excluded.updated_at
  returning * into current_row;
  result := jsonb_build_object('ok',true,'document',to_jsonb(current_row),
    'server_now',extract(epoch from clock_timestamp()) * 1000);
  insert into public.blanktime_operations(user_id,operation_id,request,response)
    values(actor,p_operation_id,request_value,result);
  return result;
end;
$$;
revoke all on function public.blanktime_read_documents() from public, anon;
revoke all on function public.blanktime_put_document(text,text,bigint,jsonb,uuid) from public, anon;
grant execute on function public.blanktime_read_documents() to authenticated;
grant execute on function public.blanktime_put_document(text,text,bigint,jsonb,uuid) to authenticated;
commit;

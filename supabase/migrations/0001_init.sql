create table if not exists entities (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('paybill', 'till', 'phone', 'url')),
  value text not null,
  report_count int not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique (kind, value)
);

create table if not exists reports (
  id bigint generated always as identity primary key,
  kind text not null,
  value text not null,
  scam_type text,
  note text,
  created_at timestamptz not null default now()
);

create or replace function report_entity(p_kind text, p_value text, p_scam text, p_note text)
returns void
language plpgsql
as $$
begin
  insert into reports (kind, value, scam_type, note) values (p_kind, p_value, p_scam, p_note);
  insert into entities (kind, value) values (p_kind, p_value)
  on conflict (kind, value)
  do update set report_count = entities.report_count + 1, last_seen = now();
end;
$$;

alter table entities enable row level security;
alter table reports enable row level security;

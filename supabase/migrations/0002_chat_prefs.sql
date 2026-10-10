create table if not exists chat_prefs (
  chat_id bigint primary key,
  lang text not null default 'en' check (lang in ('en', 'sw', 'sheng'))
);

alter table chat_prefs enable row level security;

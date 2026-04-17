create table if not exists entity (
    entity_id bigint primary key,
    canonical_name varchar(255) not null,
    type varchar(64) not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_entity_canonical_name on entity (canonical_name);

create table if not exists entity_alias (
    alias_id bigint primary key,
    entity_id bigint not null,
    alias varchar(255) not null,
    lang varchar(32) not null,
    source varchar(64) not null,
    unique (entity_id, alias, lang)
);

create index if not exists idx_entity_alias_alias on entity_alias (alias);

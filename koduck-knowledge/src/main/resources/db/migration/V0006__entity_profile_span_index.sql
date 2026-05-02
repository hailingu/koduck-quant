create table if not exists entity_profile_span (
    span_id bigserial primary key,
    profile_id bigint not null,
    entity_id bigint not null,
    entry_code varchar(64) not null,
    blob_uri text not null,
    span_from timestamptz,
    span_to timestamptz,
    summary text,
    granularity varchar(32) not null default 'UNKNOWN',
    sort_order int not null default 0,
    constraint fk_entity_profile_span_profile
        foreign key (profile_id) references entity_profile (profile_id) on delete cascade,
    constraint chk_entity_profile_span_window
        check (span_to is null or span_from is null or span_to > span_from)
);

create index if not exists idx_entity_profile_span_entity_window
    on entity_profile_span (entity_id, span_from, span_to, entry_code, sort_order);

create index if not exists idx_entity_profile_span_profile
    on entity_profile_span (profile_id, sort_order);

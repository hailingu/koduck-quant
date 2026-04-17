create table if not exists entity_basic_profile (
    entity_id bigint not null,
    domain_class varchar(64) not null,
    entity_name varchar(255) not null,
    valid_from timestamptz not null,
    valid_to timestamptz,
    basic_profile_entry_id int not null,
    basic_profile_s3_uri text not null,
    primary key (entity_id, domain_class, valid_from),
    constraint chk_basic_profile_window check (valid_to is null or valid_to > valid_from)
);

create table if not exists entity_profile (
    profile_id bigserial primary key,
    entity_id bigint not null,
    profile_entry_id int not null,
    blob_uri text not null,
    version int not null,
    is_current boolean not null,
    loaded_at timestamptz not null default now(),
    unique (entity_id, profile_entry_id, version)
);

create unique index if not exists ux_entity_profile_current
    on entity_profile (entity_id, profile_entry_id)
    where is_current = true;

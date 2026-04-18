begin;

-- Replace the sample values below with your real data before loading.
-- Reference dictionary values in current MVP:
--   basic_profile_entry_id = 1  -> BASIC
--   profile_entry_id = 2        -> BIO
--   profile_entry_id = 3        -> HONOR
-- Typical URI patterns:
--   s3://knowledge/basic/<entity_id>/BASIC/<timestamp>.json
--   s3://knowledge/profile/<entity_id>/<entry_code>/<version>.json

insert into entity (
    entity_id,
    canonical_name,
    type
)
values (
    100,
    '贵州茅台',
    'stock'
)
on conflict (entity_id) do update
set canonical_name = excluded.canonical_name,
    type = excluded.type;

insert into entity_alias (
    alias_id,
    entity_id,
    alias,
    lang,
    source
)
values
    (100001, 100, '贵州茅台', 'zh-CN', 'manual'),
    (100002, 100, 'Kweichow Moutai', 'en', 'manual'),
    (100003, 100, '600519', 'zh-CN', 'manual')
on conflict (entity_id, alias, lang) do update
set source = excluded.source;

insert into entity_basic_profile (
    entity_id,
    domain_class,
    entity_name,
    valid_from,
    valid_to,
    basic_profile_entry_id,
    basic_profile_s3_uri
)
values (
    100,
    'finance',
    '贵州茅台',
    '2025-01-01T00:00:00Z',
    null,
    1,
    's3://knowledge/basic/100/BASIC/20250101T000000Z.json'
)
on conflict (entity_id, domain_class, valid_from) do update
set entity_name = excluded.entity_name,
    valid_to = excluded.valid_to,
    basic_profile_entry_id = excluded.basic_profile_entry_id,
    basic_profile_s3_uri = excluded.basic_profile_s3_uri;

-- If you are loading a new current version, first clear the existing current row
-- for the same entity_id + profile_entry_id, then insert the target version.
update entity_profile
set is_current = false
where entity_id = 100
  and profile_entry_id in (2, 3)
  and is_current = true;

insert into entity_profile (
    entity_id,
    profile_entry_id,
    blob_uri,
    version,
    is_current,
    loaded_at
)
values
    (
        100,
        2,
        's3://knowledge/profile/100/BIO/1.json',
        1,
        true,
        now()
    ),
    (
        100,
        3,
        's3://knowledge/profile/100/HONOR/1.json',
        1,
        true,
        now()
    )
on conflict (entity_id, profile_entry_id, version) do update
set blob_uri = excluded.blob_uri,
    is_current = excluded.is_current,
    loaded_at = excluded.loaded_at;

commit;

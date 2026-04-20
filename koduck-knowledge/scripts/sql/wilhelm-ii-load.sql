begin;

insert into domain_dict (
    domain_class,
    display_name,
    description
)
values
    (
        'history',
        'History',
        'Historical figure knowledge domain'
    ),
    (
        'politics',
        'Politics',
        'Political figure and governance knowledge domain'
    ),
    (
        'military',
        'Military',
        'Military leadership and war history knowledge domain'
    )
on conflict (domain_class) do update
set display_name = excluded.display_name,
    description = excluded.description;

insert into entity (
    entity_id,
    canonical_name,
    type
)
values (
    10000001,
    '威廉二世',
    'person'
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
    (1000000101, 10000001, '威廉二世', 'zh-CN', 'manual'),
    (1000000102, 10000001, 'Wilhelm II', 'de', 'manual'),
    (1000000103, 10000001, 'William II, German Emperor', 'en', 'manual'),
    (1000000104, 10000001, '腓特烈·威廉·维克托·阿尔贝特·冯·普鲁士', 'zh-CN', 'manual'),
    (1000000105, 10000001, 'Friedrich Wilhelm Viktor Albert von Preußen', 'de', 'manual')
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
values
    (
        10000001,
        'history',
        '威廉二世',
        '1859-01-27T00:00:00Z',
        null,
        1,
        's3://knowledge/basic/10000001/BASIC/18590127T000000Z.json'
    ),
    (
        10000001,
        'politics',
        '威廉二世',
        '1859-01-27T00:00:00Z',
        null,
        1,
        's3://knowledge/basic/10000001/politics/BASIC/18590127T000000Z.json'
    ),
    (
        10000001,
        'military',
        '威廉二世',
        '1859-01-27T00:00:00Z',
        null,
        1,
        's3://knowledge/basic/10000001/military/BASIC/18590127T000000Z.json'
    )
on conflict (entity_id, domain_class, valid_from) do update
set entity_name = excluded.entity_name,
    valid_to = excluded.valid_to,
    basic_profile_entry_id = excluded.basic_profile_entry_id,
    basic_profile_s3_uri = excluded.basic_profile_s3_uri;

update entity_profile
set is_current = false
where entity_id = 10000001
  and profile_entry_id = 2
  and is_current = true;

insert into entity_profile (
    entity_id,
    profile_entry_id,
    blob_uri,
    version,
    is_current,
    loaded_at
)
values (
    10000001,
    2,
    's3://knowledge/profile/10000001/BIO/1.json',
    1,
    true,
    now()
)
on conflict (entity_id, profile_entry_id, version) do update
set blob_uri = excluded.blob_uri,
    is_current = excluded.is_current,
    loaded_at = excluded.loaded_at;

commit;

create table if not exists domain_dict (
    domain_class varchar(64) primary key,
    display_name varchar(128) not null,
    description text
);

create table if not exists profile_entry_dict (
    profile_entry_id int primary key,
    code varchar(64) not null unique,
    is_basic boolean not null default false
);

insert into domain_dict (domain_class, display_name, description)
values ('finance', 'Finance', 'MVP finance knowledge domain')
on conflict (domain_class) do update
set display_name = excluded.display_name,
    description = excluded.description;

insert into profile_entry_dict (profile_entry_id, code, is_basic)
values (1, 'BASIC', true),
       (2, 'BIO', false),
       (3, 'HONOR', false)
on conflict (profile_entry_id) do update
set code = excluded.code,
    is_basic = excluded.is_basic;

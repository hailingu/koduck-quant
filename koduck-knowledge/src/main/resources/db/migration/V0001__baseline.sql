create table if not exists flyway_anchor (
    id int primary key,
    note varchar(64) not null
);

insert into flyway_anchor (id, note)
values (1, 'knowledge-baseline')
on conflict (id) do nothing;

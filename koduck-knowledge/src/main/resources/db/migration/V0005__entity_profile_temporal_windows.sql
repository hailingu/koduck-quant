alter table entity_profile
    add column if not exists valid_from timestamptz,
    add column if not exists valid_to timestamptz;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'chk_entity_profile_window'
    ) then
        alter table entity_profile
            add constraint chk_entity_profile_window
            check (valid_to is null or valid_from is null or valid_to > valid_from);
    end if;
end $$;

create index if not exists idx_entity_profile_temporal_lookup
    on entity_profile (entity_id, profile_entry_id, valid_from, valid_to, version);

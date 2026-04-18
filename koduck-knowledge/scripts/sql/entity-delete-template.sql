begin;

-- Replace the sample values below with the target entity and paths you want to delete.
-- Run this SQL with the dev cleaner tool, then remove matching MinIO objects separately.

delete from entity_profile
where entity_id = 100
  and profile_entry_id in (2, 3);

delete from entity_basic_profile
where entity_id = 100
  and domain_class = 'finance';

delete from entity_alias
where entity_id = 100;

delete from entity
where entity_id = 100;

commit;

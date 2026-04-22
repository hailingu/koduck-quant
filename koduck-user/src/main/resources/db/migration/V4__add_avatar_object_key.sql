ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar_object_key VARCHAR(512);

UPDATE users
SET avatar_object_key = substring(avatar_url from '^/api/v1/users/avatar-files/(.+)$')
WHERE avatar_object_key IS NULL
  AND avatar_url LIKE '/api/v1/users/avatar-files/%';

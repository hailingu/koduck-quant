ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS llm_config JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN user_settings.llm_config IS '用户级大模型配置 JSON（provider/apiKey/apiBase）';

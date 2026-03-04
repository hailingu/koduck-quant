-- 修复演示用户数据 (已废弃)
-- 此迁移文件已废弃，演示用户现由 DataInitializer 在应用启动时创建
-- 密码通过环境变量 APP_DEMO_PASSWORD 或 app.demo.password 配置
-- 详见: https://github.com/hailingu/koduck-quant/issues/115

-- 保留 USER 角色分配逻辑，但不再处理 demo 用户
-- 1. 确保所有现有用户都有 USER 角色
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, 2
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = 2);

-- 2. 更新序列，确保下次插入不会冲突
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 0) + 1, false);

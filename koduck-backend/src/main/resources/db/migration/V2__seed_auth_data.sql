-- 初始化角色数据
INSERT INTO roles (id, name, description) VALUES 
(1, 'ADMIN', '系统管理员'),
(2, 'USER', '普通用户')
ON CONFLICT (id) DO NOTHING;

-- 初始化权限数据
INSERT INTO permissions (id, code, name, resource, action) VALUES
(1, 'user:read', '查看用户', 'user', 'read'),
(2, 'user:write', '编辑用户', 'user', 'write'),
(3, 'user:delete', '删除用户', 'user', 'delete'),
(4, 'strategy:read', '查看策略', 'strategy', 'read'),
(5, 'strategy:write', '编辑策略', 'strategy', 'write'),
(6, 'backtest:run', '执行回测', 'backtest', 'execute'),
(7, 'market:read', '查看市场数据', 'market', 'read'),
(8, 'indicator:read', '查看指标', 'indicator', 'read'),
(9, 'indicator:write', '编辑指标', 'indicator', 'write')
ON CONFLICT (id) DO NOTHING;

-- 为 ADMIN 角色分配所有权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions
ON CONFLICT DO NOTHING;

-- 为 USER 角色分配基本权限
INSERT INTO role_permissions (role_id, permission_id) VALUES
(2, 1),   -- user:read
(2, 4),   -- strategy:read
(2, 5),   -- strategy:write
(2, 6),   -- backtest:run
(2, 7),   -- market:read
(2, 8),   -- indicator:read
(2, 9)    -- indicator:write
ON CONFLICT DO NOTHING;

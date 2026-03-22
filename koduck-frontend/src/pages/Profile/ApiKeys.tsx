import React, { useState } from 'react';

interface ApiKey {
  id: string;
  name: string;
  keyPreview: string;
  permissions: string;
  createdAt: string;
  lastUsedAt: string;
  isActive: boolean;
}

export const ApiKeys: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState('');
  
  const handleCreateKey = async (name: string, permissions: string) => {
    // Create new API key
    setNewKeyValue('sk-...');
    setShowNewKey(true);
  };
  
  const handleDeleteKey = async (id: string) => {
    // Delete API key
  };
  
  const handleToggleKey = async (id: string, isActive: boolean) => {
    // Enable/disable key
  };
  
  return (
    <div className="api-keys">
      <h2>API 密钥管理</h2>
      <button onClick={() => handleCreateKey('New Key', 'readonly')}>
        新建密钥
      </button>
      {showNewKey && (
        <div className="new-key-alert">
          <p>请立即复制您的 API 密钥，它只显示一次：</p>
          <code>{newKeyValue}</code>
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>密钥</th>
            <th>权限</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {apiKeys.map(key => (
            <tr key={key.id}>
              <td>{key.name}</td>
              <td>{key.keyPreview}</td>
              <td>{key.permissions}</td>
              <td>{key.createdAt}</td>
              <td>
                <button onClick={() => handleToggleKey(key.id, !key.isActive)}>
                  {key.isActive ? '禁用' : '启用'}
                </button>
                <button onClick={() => handleDeleteKey(key.id)}>删除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

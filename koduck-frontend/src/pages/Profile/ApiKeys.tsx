import { useState } from 'react';

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
  const [apiKeys, _setApiKeys] = useState<ApiKey[]>([]);
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState('');
  
  const handleCreateKey = async (_name: string, _permissions: string) => {
    // Create new API key
    setNewKeyValue('sk-...');
    setShowNewKey(true);
  };
  
  const handleDeleteKey = async (id: string) => {
    // Delete API key
    console.log('Deleting key:', id);
  };
  
  const handleToggleKey = async (id: string, isActive: boolean) => {
    // Enable/disable key
    console.log('Toggling key:', id, isActive);
  };
  
  return (
    <div className="api-keys p-6">
      <h2 className="text-2xl font-bold mb-6">API 密钥管理</h2>
      <button 
        onClick={() => handleCreateKey('New Key', 'readonly')}
        className="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-400 transition-colors"
      >
        新建密钥
      </button>
      {showNewKey && (
        <div className="new-key-alert mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded">
          <p>请立即复制您的 API 密钥，它只显示一次：</p>
          <code className="block mt-2 p-2 bg-slate-800 rounded text-cyan-400">{newKeyValue}</code>
        </div>
      )}
      <table className="w-full mt-6">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-3 text-slate-400">名称</th>
            <th className="text-left py-3 text-slate-400">密钥</th>
            <th className="text-left py-3 text-slate-400">权限</th>
            <th className="text-left py-3 text-slate-400">创建时间</th>
            <th className="text-left py-3 text-slate-400">操作</th>
          </tr>
        </thead>
        <tbody>
          {apiKeys.map(key => (
            <tr key={key.id} className="border-b border-slate-800">
              <td className="py-3 text-slate-200">{key.name}</td>
              <td className="py-3 text-slate-400">{key.keyPreview}</td>
              <td className="py-3 text-slate-400">{key.permissions}</td>
              <td className="py-3 text-slate-400">{key.createdAt}</td>
              <td className="py-3">
                <button 
                  onClick={() => handleToggleKey(key.id, !key.isActive)}
                  className="text-sm text-cyan-400 hover:text-cyan-300 mr-2"
                >
                  {key.isActive ? '禁用' : '启用'}
                </button>
                <button 
                  onClick={() => handleDeleteKey(key.id)}
                  className="text-sm text-rose-400 hover:text-rose-300"
                >
                  删除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ApiKeys;

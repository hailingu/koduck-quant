import { useState } from 'react';

export const Preferences: React.FC = () => {
  const [theme, setTheme] = useState('system');
  const [language, setLanguage] = useState('zh-CN');
  const [timezone, _setTimezone] = useState('Asia/Shanghai');
  const [klinePeriod, setKlinePeriod] = useState('1D');
  
  const handleSave = async () => {
    // Save preferences
    console.log('Saving preferences:', { theme, language, timezone, klinePeriod });
  };
  
  return (
    <div className="preferences p-6">
      <h2 className="text-2xl font-bold mb-6">偏好设置</h2>
      <section className="mb-8">
        <h3 className="text-lg font-medium text-slate-300 mb-4">界面</h3>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm text-slate-400 mb-1">主题</label>
            <select 
              value={theme} 
              onChange={(e) => setTheme(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200"
            >
              <option value="light">浅色</option>
              <option value="dark">深色</option>
              <option value="system">跟随系统</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">语言</label>
            <select 
              value={language} 
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200"
            >
              <option value="zh-CN">简体中文</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </section>
      <section className="mb-8">
        <h3 className="text-lg font-medium text-slate-300 mb-4">交易</h3>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm text-slate-400 mb-1">默认K线周期</label>
            <select 
              value={klinePeriod} 
              onChange={(e) => setKlinePeriod(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200"
            >
              <option value="1m">1分钟</option>
              <option value="1D">日线</option>
              <option value="1W">周线</option>
            </select>
          </div>
        </div>
      </section>
      <button 
        onClick={handleSave}
        className="px-6 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-400 transition-colors"
      >
        保存设置
      </button>
    </div>
  );
};

export default Preferences;

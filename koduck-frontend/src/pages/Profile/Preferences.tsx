import React, { useState } from 'react';

export const Preferences: React.FC = () => {
  const [theme, setTheme] = useState('system');
  const [language, setLanguage] = useState('zh-CN');
  const [timezone, setTimezone] = useState('Asia/Shanghai');
  const [klinePeriod, setKlinePeriod] = useState('1D');
  
  const handleSave = async () => {
    // Save preferences
  };
  
  return (
    <div className="preferences">
      <h2>偏好设置</h2>
      <section>
        <h3>界面</h3>
        <select value={theme} onChange={(e) => setTheme(e.target.value)}>
          <option value="light">浅色</option>
          <option value="dark">深色</option>
          <option value="system">跟随系统</option>
        </select>
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="zh-CN">简体中文</option>
          <option value="en">English</option>
        </select>
      </section>
      <section>
        <h3>交易</h3>
        <select value={klinePeriod} onChange={(e) => setKlinePeriod(e.target.value)}>
          <option value="1m">1分钟</option>
          <option value="1D">日线</option>
          <option value="1W">周线</option>
        </select>
      </section>
      <button onClick={handleSave}>保存设置</button>
    </div>
  );
};

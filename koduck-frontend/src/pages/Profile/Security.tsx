import { useState } from 'react';

// Stub components for Security page
const PasswordChangeForm: React.FC<{ onSubmit: (oldPwd: string, newPwd: string) => Promise<void> }> = ({ onSubmit }) => {
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      alert('两次输入的密码不一致');
      return;
    }
    onSubmit(oldPwd, newPwd);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm text-slate-400 mb-1">当前密码</label>
        <input
          type="password"
          value={oldPwd}
          onChange={(e) => setOldPwd(e.target.value)}
          className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200"
        />
      </div>
      <div>
        <label className="block text-sm text-slate-400 mb-1">新密码</label>
        <input
          type="password"
          value={newPwd}
          onChange={(e) => setNewPwd(e.target.value)}
          className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200"
        />
      </div>
      <div>
        <label className="block text-sm text-slate-400 mb-1">确认新密码</label>
        <input
          type="password"
          value={confirmPwd}
          onChange={(e) => setConfirmPwd(e.target.value)}
          className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200"
        />
      </div>
      <button type="submit" className="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-400">
        修改密码
      </button>
    </form>
  );
};

const DeviceList: React.FC = () => {
  const devices = [
    { id: '1', name: 'Chrome on Windows', location: 'Beijing, China', lastActive: 'Now', current: true },
    { id: '2', name: 'Safari on iPhone', location: 'Shanghai, China', lastActive: '2 hours ago', current: false },
  ];

  return (
    <div className="space-y-3">
      {devices.map(device => (
        <div key={device.id} className="flex items-center justify-between p-3 bg-slate-800 rounded">
          <div>
            <div className="text-slate-200">{device.name}</div>
            <div className="text-xs text-slate-500">{device.location} • {device.lastActive}</div>
          </div>
          {device.current ? (
            <span className="text-xs text-emerald-400">当前设备</span>
          ) : (
            <button className="text-xs text-slate-400 hover:text-rose-400">登出</button>
          )}
        </div>
      ))}
    </div>
  );
};

const LoginHistory: React.FC = () => {
  const history = [
    { id: '1', time: '2024-01-15 14:30:00', ip: '192.168.1.1', location: 'Beijing, China', status: 'success' },
    { id: '2', time: '2024-01-14 09:15:00', ip: '192.168.1.2', location: 'Shanghai, China', status: 'success' },
  ];

  return (
    <div className="space-y-2">
      {history.map(item => (
        <div key={item.id} className="flex items-center justify-between p-3 bg-slate-800 rounded text-sm">
          <div>
            <span className="text-slate-400">{item.time}</span>
            <span className="mx-2 text-slate-600">|</span>
            <span className="text-slate-300">{item.ip}</span>
            <span className="mx-2 text-slate-600">|</span>
            <span className="text-slate-500">{item.location}</span>
          </div>
          <span className="text-emerald-400">成功</span>
        </div>
      ))}
    </div>
  );
};

// QRCodeSVG stub component
const QRCodeSVG: React.FC<{ value: string; size?: number }> = ({ value: _value, size = 128 }) => (
  <div 
    className="bg-white p-2 rounded inline-block"
    style={{ width: size, height: size }}
  >
    {/* Placeholder for QR code - in production, use qrcode.react library */}
    <div className="w-full h-full bg-slate-200 flex items-center justify-center text-xs text-slate-500 text-center">
      QR Code
      <br />
      (install qrcode.react)
    </div>
  </div>
);

export const Security: React.FC = () => {
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  
  const handlePasswordChange = async (_oldPwd: string, _newPwd: string) => {
    // Change password
    console.log('Changing password...');
  };
  
  const handleEnable2FA = async () => {
    setShowQRCode(true);
  };
  
  const handleVerify2FA = async (code: string) => {
    setIs2FAEnabled(true);
    console.log('2FA verified with code:', code);
  };
  
  return (
    <div className="security p-6 space-y-8">
      <h2 className="text-2xl font-bold text-slate-200">账户安全</h2>
      
      <section className="border-b border-slate-800 pb-6">
        <h3 className="text-lg font-medium text-slate-300 mb-4">修改密码</h3>
        <PasswordChangeForm onSubmit={handlePasswordChange} />
      </section>
      
      <section className="border-b border-slate-800 pb-6">
        <h3 className="text-lg font-medium text-slate-300 mb-4">双重验证 (2FA)</h3>
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            {is2FAEnabled 
              ? '双重验证已启用，您的账户更加安全。' 
              : '启用双重验证可以为您的账户增加额外的安全保护。'}
          </p>
          <button 
            onClick={handleEnable2FA}
            className={`px-4 py-2 rounded transition-colors ${
              is2FAEnabled 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'bg-cyan-500 hover:bg-cyan-400 text-white'
            }`}
          >
            {is2FAEnabled ? '已启用' : '启用 2FA'}
          </button>
          {showQRCode && !is2FAEnabled && (
            <div className="mt-4 p-4 bg-slate-800 rounded">
              <p className="text-sm text-slate-400 mb-2">请使用身份验证器扫描以下二维码：</p>
              <QRCodeSVG value="otpauth://totp/Koduck:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Koduck" />
              <div className="mt-4">
                <input
                  type="text"
                  placeholder="输入6位验证码"
                  maxLength={6}
                  className="px-4 py-2 bg-slate-700 border border-slate-600 rounded text-slate-200 mr-2"
                  onChange={(e) => {
                    if (e.target.value.length === 6) {
                      handleVerify2FA(e.target.value);
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </section>
      
      <section className="border-b border-slate-800 pb-6">
        <h3 className="text-lg font-medium text-slate-300 mb-4">登录设备</h3>
        <DeviceList />
      </section>
      
      <section>
        <h3 className="text-lg font-medium text-slate-300 mb-4">登录历史</h3>
        <LoginHistory />
      </section>
    </div>
  );
};

export default Security;

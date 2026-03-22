import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export const Security: React.FC = () => {
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  
  const handlePasswordChange = async (oldPwd: string, newPwd: string) => {
    // Change password
  };
  
  const handleEnable2FA = async () => {
    setShowQRCode(true);
  };
  
  const handleVerify2FA = async (code: string) => {
    setIs2FAEnabled(true);
  };
  
  return (
    <div className="security">
      <h2>账户安全</h2>
      <section>
        <h3>修改密码</h3>
        <PasswordChangeForm onSubmit={handlePasswordChange} />
      </section>
      <section>
        <h3>双重验证 (2FA)</h3>
        <button onClick={handleEnable2FA}>
          {is2FAEnabled ? '已启用' : '启用 2FA'}
        </button>
        {showQRCode && <QRCodeSVG value="otpauth://..." />}
      </section>
      <section>
        <h3>登录设备</h3>
        <DeviceList />
      </section>
      <section>
        <h3>登录历史</h3>
        <LoginHistory />
      </section>
    </div>
  );
};

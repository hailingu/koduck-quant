import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Settings,
  User,
  Activity,
  LogOut,
  HelpCircle,
  X,
  Bell,
  Shield,
  Globe,
} from "lucide-react";

type SettingsTab = "account" | "general" | "trading" | "notifications" | "security";
type TradingMode = "simulation" | "live";

interface StaticUserInfo {
  username: string;
  nickname: string;
  email: string;
  avatarUrl?: string;
}

const STATIC_USER: StaticUserInfo = {
  username: "koduck-user",
  nickname: "User",
  email: "user@koduckquant.com",
};

export function Layout({ children }: { children: React.ReactNode }) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedSettingTab, setSelectedSettingTab] = useState<SettingsTab>("account");
  const [tradingMode, setTradingMode] = useState<TradingMode>("simulation");
  const navigate = useNavigate();

  const displayName = useMemo(
    () => STATIC_USER.nickname || STATIC_USER.username || "User",
    [],
  );
  const displayEmail = useMemo(
    () => STATIC_USER.email || "user@koduckquant.com",
    [],
  );
  const avatarUrl = useMemo(() => STATIC_USER.avatarUrl || "", []);

  const handleLogout = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setShowUserMenu(false);
    navigate("/login", { replace: true });
  };

  const openSettings = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setShowUserMenu(false);
    setShowSettingsModal(true);
  };

  const settingTitle: Record<SettingsTab, string> = {
    account: "账户",
    general: "通用",
    trading: "交易",
    notifications: "通知",
    security: "安全",
  };

  const avatarNode = avatarUrl ? (
    <img src={avatarUrl} alt={displayName} className="h-full w-full rounded-full object-cover" />
  ) : (
    <User className="h-4 w-4 text-white" />
  );

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex h-14 flex-shrink-0 items-center justify-end bg-white px-4">
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#10a37f] transition-colors hover:bg-[#0d8b6d]"
            type="button"
          >
            {avatarNode}
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <div className="border-b border-gray-100 px-3 py-2">
                  <div className="text-sm font-medium text-gray-900">{displayName}</div>
                  <div className="text-xs text-gray-500">{displayEmail}</div>
                </div>
                <a
                  href="#"
                  className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={openSettings}
                >
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </a>
                <a
                  href="#"
                  className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowUserMenu(false);
                  }}
                >
                  <Activity className="h-4 w-4" />
                  <span>Activity</span>
                </a>
                <a
                  href="#"
                  className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowUserMenu(false);
                  }}
                >
                  <HelpCircle className="h-4 w-4" />
                  <span>Help</span>
                </a>
                <div className="mt-1 border-t border-gray-100 pt-1">
                  <a
                    href="#"
                    className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Log out</span>
                  </a>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>

      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/35 backdrop-blur-[10px]"
            onClick={() => setShowSettingsModal(false)}
          />
          <div className="relative flex h-[500px] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <button
              onClick={() => setShowSettingsModal(false)}
              className="absolute left-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="w-36 flex-shrink-0 border-r border-gray-200 bg-gray-50 pt-14">
              <div className="px-2">
                <nav className="space-y-0.5">
                  {[
                    { key: "account", label: "账户", icon: User },
                    { key: "general", label: "通用", icon: Globe },
                    { key: "trading", label: "交易", icon: Activity },
                    { key: "notifications", label: "通知", icon: Bell },
                    { key: "security", label: "安全", icon: Shield },
                  ].map(({ key, label, icon: Icon }) => {
                    const active = selectedSettingTab === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedSettingTab(key as SettingsTab)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-all ${
                          active
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-600 hover:bg-white hover:text-gray-900"
                        }`}
                        type="button"
                      >
                        <Icon className="h-4 w-4" />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-white">
              <div className="p-6">
                <h2 className="mb-6 text-xl font-semibold text-gray-900">
                  {settingTitle[selectedSettingTab]}
                </h2>

                {selectedSettingTab === "account" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#10A37F]">
                          <div className="flex h-full w-full items-center justify-center">
                            {avatarNode}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{displayName}</div>
                          <div className="text-xs text-gray-500">{displayEmail}</div>
                        </div>
                      </div>
                      <button className="text-sm font-medium text-[#10A37F] transition-colors hover:text-[#0D8B6D]" type="button">
                        编辑
                      </button>
                    </div>

                    <div className="flex items-center justify-between py-4">
                      <div className="text-sm font-medium text-gray-900">用户名</div>
                      <div className="text-sm text-gray-500">{displayName}</div>
                    </div>

                    <div className="flex items-center justify-between py-4">
                      <div className="text-sm font-medium text-gray-900">邮箱地址</div>
                      <div className="text-sm text-gray-500">{displayEmail}</div>
                    </div>
                  </div>
                )}

                {selectedSettingTab === "general" && (
                  <div className="space-y-0">
                    <SettingsRow label="语言" value="简体中文" />
                    <SettingsRow label="主题" value="浅色" />
                    <SettingsRow label="时区" value="UTC+8" />
                  </div>
                )}

                {selectedSettingTab === "trading" && (
                  <div className="space-y-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">默认交易模式</div>
                        <div className="mt-1 text-xs text-gray-500">选择默认的交易执行模式</div>
                      </div>
                      <div className="relative inline-flex rounded-full bg-gray-200 p-0.5">
                        <div
                          className={`absolute bottom-0.5 top-0.5 rounded-full bg-[#10A37F] shadow-sm transition-all duration-300 ease-in-out ${
                            tradingMode === "simulation"
                              ? "left-0.5 w-[calc(50%-0.25rem)]"
                              : "left-[calc(50%)] w-[calc(50%-0.25rem)]"
                          }`}
                        />
                        <button
                          onClick={() => setTradingMode("simulation")}
                          className={`relative z-10 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                            tradingMode === "simulation"
                              ? "text-white"
                              : "text-gray-600 hover:text-gray-900"
                          }`}
                          type="button"
                        >
                          模拟交易
                        </button>
                        <button
                          onClick={() => setTradingMode("live")}
                          className={`relative z-10 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                            tradingMode === "live"
                              ? "text-white"
                              : "text-gray-600 hover:text-gray-900"
                          }`}
                          type="button"
                        >
                          实盘交易
                        </button>
                      </div>
                    </div>

                    <ToggleRow label="风险提醒" description="高风险交易时显示提醒" defaultChecked />
                    <ToggleRow label="自动止损" description="启用自动止损保护" />
                  </div>
                )}

                {selectedSettingTab === "notifications" && (
                  <div className="space-y-0">
                    <ToggleRow
                      label="邮件通知"
                      description="接收重要事件的邮件提醒"
                      defaultChecked
                    />
                    <ToggleRow label="价格提醒" description="达到设定价格时通知" />
                    <ToggleRow
                      label="交易确认"
                      description="重要交易前需要确认"
                      defaultChecked
                    />
                  </div>
                )}

                {selectedSettingTab === "security" && (
                  <div className="space-y-0">
                    {[
                      ["更改密码", "定期更新您的账户密码"],
                      ["两步验证", "为您的账户添加额外安全保护"],
                      ["登录历史", "查看最近的登录记录"],
                      ["活跃会话", "管理您的所有活跃登录会话"],
                    ].map(([label, description]) => (
                      <button
                        key={label}
                        className="-mx-8 w-[calc(100%+4rem)] rounded-lg px-8 py-4 text-left transition-colors hover:bg-gray-50"
                        type="button"
                      >
                        <div className="text-sm font-medium text-gray-900">{label}</div>
                        <div className="mt-1 text-xs text-gray-500">{description}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="text-sm font-medium text-gray-900">{label}</div>
      <div className="text-sm text-gray-500">{value}</div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  defaultChecked = false,
}: {
  label: string;
  description: string;
  defaultChecked?: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <div className="flex items-center justify-between py-4">
      <div>
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="mt-1 text-xs text-gray-500">{description}</div>
      </div>
      <label className="relative inline-flex flex-shrink-0 cursor-pointer items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={() => setChecked((prev) => !prev)}
        />
        <div className="h-6 w-11 rounded-full bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#10a37f] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#10a37f] peer-checked:after:translate-x-full peer-checked:after:border-white" />
      </label>
    </div>
  );
}

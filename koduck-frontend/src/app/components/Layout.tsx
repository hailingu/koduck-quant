import { useState } from "react";
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
  Cpu,
} from "lucide-react";

type SettingsTab = "account" | "general" | "model" | "trading" | "notifications" | "security";
type TradingMode = "simulation" | "live";

const settingTitle: Record<SettingsTab, string> = {
  account: "账户",
  general: "通用",
  model: "模型",
  trading: "交易",
  notifications: "通知",
  security: "安全",
};

const settingTabs: { key: SettingsTab; label: string; icon: typeof User }[] = [
  { key: "account", label: "账户", icon: User },
  { key: "general", label: "通用", icon: Globe },
  { key: "model", label: "模型", icon: Cpu },
  { key: "trading", label: "交易", icon: Activity },
  { key: "notifications", label: "通知", icon: Bell },
  { key: "security", label: "安全", icon: Shield },
];

export function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [selectedSettingTab, setSelectedSettingTab] = useState<SettingsTab>("account");
  const [tradingMode, setTradingMode] = useState<TradingMode>("simulation");
  const [modelApiUrl, setModelApiUrl] = useState("");
  const [modelApiKey, setModelApiKey] = useState("");
  const [contextWindow, setContextWindow] = useState("");
  const [visionSupport, setVisionSupport] = useState<"vision" | "text-only">("vision");
  const navigate = useNavigate();

  const handleLogout = () => {
    setShowUserMenu(false);
    navigate("/login");
  };

  const openSettings = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setShowUserMenu(false);
    setShowSettingsModal(true);
  };

  const openHelp = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setShowUserMenu(false);
    setShowHelpModal(true);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top Navigation Bar */}
      <header className="h-14 flex-shrink-0">
        <div className="fixed top-3 right-4 z-10">
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-8 h-8 bg-[#10a37f] rounded-full flex items-center justify-center hover:bg-[#0d8b6d] transition-colors"
              type="button"
            >
              <User className="w-4 h-4 text-white" />
            </button>

            {/* User Dropdown Menu */}
            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <div className="text-sm font-medium text-gray-900">User</div>
                    <div className="text-xs text-gray-500">user@koduckquant.com</div>
                  </div>
                  <a
                    href="#"
                    className="flex items-center gap-3 text-gray-700 hover:bg-gray-50 px-3 py-2 text-sm"
                    onClick={openSettings}
                  >
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </a>
                  <a
                    href="#"
                    className="flex items-center gap-3 text-gray-700 hover:bg-gray-50 px-3 py-2 text-sm"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowUserMenu(false);
                    }}
                  >
                    <Activity className="w-4 h-4" />
                    <span>Activity</span>
                  </a>
                  <a
                    href="#"
                    className="flex items-center gap-3 text-gray-700 hover:bg-gray-50 px-3 py-2 text-sm"
                    onClick={openHelp}
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span>Help</span>
                  </a>
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <a
                      href="#"
                      className="flex items-center gap-3 text-gray-700 hover:bg-gray-50 px-3 py-2 text-sm"
                      onClick={handleLogout}
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log out</span>
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0">{children}</div>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/5 backdrop-blur-md"
            onClick={() => setShowHelpModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">帮助中心</h2>
              <button
                onClick={() => setShowHelpModal(false)}
                className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Quick Actions */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">快速操作</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left">
                      <div className="w-10 h-10 bg-[#10a37f]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-[#10a37f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">用户指南</div>
                        <div className="text-xs text-gray-500">查看完整文档</div>
                      </div>
                    </button>
                    <button className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left">
                      <div className="w-10 h-10 bg-[#10a37f]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-[#10a37f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">视频教程</div>
                        <div className="text-xs text-gray-500">观看操作演示</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* FAQ */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">常见问题</h3>
                  <div className="space-y-2">
                    {[
                      { q: "如何开始量化交易？", a: "首先，您需要在交易设置中选择模拟交易或实盘交易模式。我们建议初学者从模拟交易开始，熟悉平台操作后再切换到实盘交易。" },
                      { q: "如何创建交易策略？", a: "在AI聊天界面中，您可以通过自然语言描述您的交易策略，AI助手会帮助您构建和优化策略代码。" },
                      { q: "模拟交易和实盘交易有什么区别？", a: "模拟交易使用虚拟资金进行交易练习，不涉及真实资金；实盘交易则使用真实资金进行交易操作，请谨慎使用。" },
                      { q: "如何保护账户安全？", a: "建议开启两步验证，定期更改密码，并在安全设置中查看登录历史和活跃会话，确保账户安全。" },
                    ].map(({ q, a }) => (
                      <details key={q} className="group">
                        <summary className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl cursor-pointer transition-colors">
                          <span className="text-sm font-medium text-gray-900">{q}</span>
                          <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="px-4 py-3 text-sm text-gray-600 bg-white">{a}</div>
                      </details>
                    ))}
                  </div>
                </div>

                {/* Contact Support */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">联系我们</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">电子邮件</div>
                        <div className="text-xs text-gray-500">support@koduckquant.com</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">在线客服</div>
                        <div className="text-xs text-gray-500">工作日 9:00 - 18:00</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Koduck Quant v1.0.0</span>
                <div className="flex items-center gap-4">
                  <a href="#" className="hover:text-gray-700 transition-colors">服务条款</a>
                  <a href="#" className="hover:text-gray-700 transition-colors">隐私政策</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/35 backdrop-blur-[10px]"
            onClick={() => setShowSettingsModal(false)}
          />
          <div className="relative flex h-[500px] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Close Button */}
            <button
              onClick={() => setShowSettingsModal(false)}
              className="absolute left-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Sidebar */}
            <div className="w-36 flex-shrink-0 border-r border-gray-200 bg-gray-50 pt-14">
              <div className="px-2">
                <nav className="space-y-0.5">
                  {settingTabs.map(({ key, label, icon: Icon }) => {
                    const active = selectedSettingTab === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedSettingTab(key)}
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

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto bg-white">
              <div className="p-6">
                <h2 className="mb-6 text-xl font-semibold text-gray-900">
                  {settingTitle[selectedSettingTab]}
                </h2>

                {/* Account Section */}
                {selectedSettingTab === "account" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#10A37F]">
                          <User className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">User</div>
                          <div className="text-xs text-gray-500">user@koduckquant.com</div>
                        </div>
                      </div>
                      <button
                        className="text-sm font-medium text-[#10A37F] transition-colors hover:text-[#0D8B6D]"
                        type="button"
                      >
                        编辑
                      </button>
                    </div>
                    <SettingsRow label="用户名" value="User" />
                    <SettingsRow label="邮箱地址" value="user@koduckquant.com" />
                  </div>
                )}

                {/* General Settings */}
                {selectedSettingTab === "general" && (
                  <div className="space-y-0">
                    <SettingsRow label="语言" value="简体中文" />
                    <SettingsRow label="主题" value="浅色" />
                    <SettingsRow label="时区" value="UTC+8" />
                  </div>
                )}

                {/* Model Settings */}
                {selectedSettingTab === "model" && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-900">Model Provider</label>
                      <input
                        type="text"
                        value={modelApiUrl}
                        onChange={(e) => setModelApiUrl(e.target.value)}
                        placeholder="Minimax"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:border-transparent"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-900">API URL</label>
                      <input
                        type="text"
                        value={modelApiUrl}
                        onChange={(e) => setModelApiUrl(e.target.value)}
                        placeholder="https://api.openai.com/v1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:border-transparent"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-900">API Key</label>
                      <input
                        type="password"
                        value={modelApiKey}
                        onChange={(e) => setModelApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:border-transparent"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-900">Context Window</label>
                      <input
                        type="number"
                        value={contextWindow}
                        onChange={(e) => setContextWindow(e.target.value)}
                        placeholder="128000"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:border-transparent"
                      />
                    </div>
                    <div className="flex items-center justify-between py-4">
                      <label className="text-sm font-medium text-gray-900">多模态支持</label>
                      <div className="relative inline-flex rounded-full bg-gray-200 p-0.5">
                        <div
                          className={`absolute bottom-0.5 top-0.5 rounded-full bg-[#10A37F] shadow-sm transition-all duration-300 ease-in-out ${
                            visionSupport === "vision"
                              ? "left-0.5 w-[calc(50%-0.25rem)]"
                              : "left-[calc(50%)] w-[calc(50%-0.25rem)]"
                          }`}
                        />
                        <button
                          onClick={() => setVisionSupport("vision")}
                          className={`relative z-10 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                            visionSupport === "vision"
                              ? "text-white"
                              : "text-gray-600 hover:text-gray-900"
                          }`}
                          type="button"
                        >
                          Vision
                        </button>
                        <button
                          onClick={() => setVisionSupport("text-only")}
                          className={`relative z-10 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                            visionSupport === "text-only"
                              ? "text-white"
                              : "text-gray-600 hover:text-gray-900"
                          }`}
                          type="button"
                        >
                          仅文本
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Trading Settings */}
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

                {/* Notifications */}
                {selectedSettingTab === "notifications" && (
                  <div className="space-y-0">
                    <ToggleRow label="邮件通知" description="接收重要事件的邮件提醒" defaultChecked />
                    <ToggleRow label="价格提醒" description="达到设定价格时通知" />
                    <ToggleRow label="交易确认" description="重要交易前需要确认" defaultChecked />
                  </div>
                )}

                {/* Security */}
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

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Settings, User, Activity, LogOut, HelpCircle } from "lucide-react";
import { clearAuth, fetchCurrentUserProfile, getCurrentUser, type UserInfo } from "../auth";

export function Layout({ children }: { children: React.ReactNode }) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(getCurrentUser());
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    void fetchCurrentUserProfile().then((user) => {
      if (mounted && user) {
        setCurrentUser(user);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const displayName = useMemo(
    () => currentUser?.nickname || currentUser?.username || "User",
    [currentUser],
  );
  const displayEmail = useMemo(
    () => currentUser?.email || "user@koduckquant.com",
    [currentUser],
  );
  const avatarUrl = useMemo(
    () => currentUser?.avatarUrl || currentUser?.avatar_url || "",
    [currentUser],
  );

  const handleLogout = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    clearAuth();
    setShowUserMenu(false);
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="h-14 bg-white flex items-center justify-end px-4 flex-shrink-0">
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-8 h-8 bg-[#10a37f] rounded-full flex items-center justify-center hover:bg-[#0d8b6d] transition-colors"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-white" />
            )}
          </button>

          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20">
                <div className="px-3 py-2 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-900">{displayName}</div>
                  <div className="text-xs text-gray-500">{displayEmail}</div>
                </div>
                <a
                  href="#"
                  className="flex items-center gap-3 text-gray-700 hover:bg-gray-50 px-3 py-2 text-sm"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowUserMenu(false);
                  }}
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
                  onClick={(e) => {
                    e.preventDefault();
                    setShowUserMenu(false);
                  }}
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
      </header>

      <div className="flex-1 flex flex-col min-h-0">
        {children}
      </div>
    </div>
  );
}

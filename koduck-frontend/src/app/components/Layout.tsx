import { useState } from "react";
import { Link, useLocation } from "react-router";
import { 
  Settings, 
  Terminal, 
  Activity,
  Edit,
  Menu,
  User,
  MoreHorizontal
} from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-white flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-3 flex items-center justify-between border-b border-gray-200">
          <button className="flex items-center gap-2 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors flex-1 text-gray-900">
            <Menu className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-900">
            <Edit className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto p-3">
          <nav className="space-y-1">
            <Link
              to="/koduck-ai"
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                isActive("/koduck-ai")
                  ? "text-gray-900 bg-white"
                  : "text-gray-600 hover:bg-white hover:text-gray-900"
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>Koduck AI</span>
            </Link>
          </nav>


        </div>

        {/* Sidebar Footer */}
        <div className="p-3">
          {/* User Profile */}
          <div className="relative">
            <div 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 hover:bg-white rounded-lg cursor-pointer"
            >
              <div className="w-7 h-7 bg-[#10a37f] rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate text-gray-900">User</div>
              </div>
              <MoreHorizontal className="w-4 h-4 text-gray-400" />
            </div>
            
            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                <a
                  href="#"
                  className="flex items-center gap-3 text-gray-600 hover:bg-gray-50 px-3 py-2 text-sm"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowUserMenu(false);
                  }}
                >
                  <Activity className="w-4 h-4" />
                  <span>Status</span>
                </a>
                <a
                  href="#"
                  className="flex items-center gap-3 text-gray-600 hover:bg-gray-50 px-3 py-2 text-sm"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowUserMenu(false);
                  }}
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      {children}
    </div>
  );
}

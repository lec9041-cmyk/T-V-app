import { Outlet, Link, useLocation } from "react-router";
import { Home, BookOpen, BarChart3, Settings } from "lucide-react";

export function Root() {
  const location = useLocation();

  const navItems = [
    { path: "/", icon: Home, label: "홈" },
    { path: "/study", icon: BookOpen, label: "학습" },
    { path: "/stats", icon: BarChart3, label: "통계" },
    { path: "/settings", icon: Settings, label: "설정" },
  ];

  return (
    <div className="size-full flex flex-col bg-gray-50">
      {/* Main Content */}
      <div className="flex-1 overflow-auto pb-20">
        <Outlet />
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-1 px-4 py-2 transition-colors ${
                  isActive ? "text-blue-600" : "text-gray-500"
                }`}
              >
                <Icon className="size-5" />
                <span className="text-xs">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

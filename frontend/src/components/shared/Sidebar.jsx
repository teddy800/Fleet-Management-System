import { useState } from "react";
import {
  LayoutDashboard, Car, ClipboardList, CheckSquare, User, Fuel,
  Gauge, LogOut, ShieldCheck, Navigation, CalendarDays, Moon, Sun,
  Bell, BarChart3, Users,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/useUserStore";

const menuItems = [
  { name: "Dashboard",       path: "/dashboard",          icon: LayoutDashboard, roles: ["Staff", "Dispatcher", "Admin", "Driver"] },
  { name: "Request Vehicle", path: "/requests/new",       icon: ClipboardList,   roles: ["Staff", "Admin"] },
  { name: "My Requests",     path: "/my-requests",        icon: ClipboardList,   roles: ["Staff", "Admin", "Driver"] },
  { name: "Approval Queue",  path: "/dispatch/approvals", icon: CheckSquare,     roles: ["Dispatcher", "Admin"] },
  { name: "Fleet Calendar",  path: "/dispatch/calendar",  icon: CalendarDays,    roles: ["Dispatcher", "Admin"] },
  { name: "Manage Fleet",    path: "/fleet",              icon: Car,             roles: ["Dispatcher", "Admin"] },
  { name: "GPS Tracking",    path: "/tracking",           icon: Navigation,      roles: ["Dispatcher", "Admin"] },
  { name: "Drivers",         path: "/drivers",            icon: Users,           roles: ["Dispatcher", "Admin"] },
  { name: "Fuel Logs",       path: "/fuel-log",           icon: Fuel,            roles: ["Admin", "Dispatcher"] },
  { name: "Maintenance",     path: "/maintenance",        icon: Gauge,           roles: ["Admin", "Dispatcher"] },
  { name: "Alerts",          path: "/alerts",             icon: Bell,            roles: ["Admin", "Dispatcher"] },
  { name: "Analytics",       path: "/analytics",          icon: BarChart3,       roles: ["Admin"] },
];

const ROLE_COLORS = {
  Admin:      "text-brand-gold bg-brand-gold/20 border-brand-gold/30",
  Dispatcher: "text-blue-300 bg-blue-400/20 border-blue-400/30",
  Staff:      "text-green-300 bg-green-400/20 border-green-400/30",
  Driver:     "text-purple-300 bg-purple-400/20 border-purple-400/30",
};

export default function Sidebar({ setOpen }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark"));

  const user = useUserStore((state) => state.user);
  const logout = useUserStore((state) => state.logout);

  const toggleDark = () => {
    const isDark = document.documentElement.classList.toggle("dark");
    setDarkMode(isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  };

  const filteredMenu = menuItems.filter(item => {
    if (!user?.role) return false;
    if (user.role === "Admin") return true;
    return item.roles.includes(user.role);
  });

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const roleColorClass = ROLE_COLORS[user?.role] || ROLE_COLORS.Staff;

  return (
    <div className="flex flex-col h-full bg-brand-blue text-white w-64 border-r border-white/10 shadow-2xl overflow-hidden">
      {/* Gradient overlay at top */}
      <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-blue-900/40 to-transparent pointer-events-none" />

      {/* --- Logo & Identity Section --- */}
      <div className="relative flex flex-col items-center pt-8 pb-6 px-6">
        {/* Animated glow behind logo */}
        <div className="absolute top-6 w-20 h-20 rounded-full bg-brand-gold/20 blur-2xl" />

        <div className="relative mb-3 group cursor-pointer">
          <div className="absolute inset-0 rounded-full bg-brand-gold/30 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative bg-white p-2.5 rounded-full shadow-xl border-2 border-white/20 transition-transform duration-300 group-hover:scale-105">
            <img src={logo} className="w-14 h-14 object-contain rounded-full" alt="MESSOB Logo" />
          </div>
        </div>

        <h1 className="text-lg font-black tracking-wider text-white">MESSOB-FMS</h1>

        {/* Role Badge */}
        <div className={cn(
          "flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest",
          roleColorClass
        )}>
          <ShieldCheck className="h-3 w-3" />
          {user?.role || "Guest"}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-white/10 mb-3" />

      {/* --- Navigation Menu --- */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto no-scrollbar pb-2">
        {filteredMenu.map((item, idx) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setOpen?.(false)}
              style={{ animationDelay: `${idx * 40}ms` }}
              className={cn(
                "flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 group relative overflow-hidden animate-slide-in-left",
                isActive
                  ? "bg-brand-gold text-brand-blue font-black shadow-lg"
                  : "hover:bg-white/10 text-white/70 hover:text-white"
              )}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-blue rounded-r-full" />
              )}

              <item.icon className={cn(
                "mr-3 h-4 w-4 transition-all duration-200 shrink-0",
                isActive
                  ? "text-brand-blue"
                  : "text-brand-gold/70 group-hover:text-brand-gold group-hover:scale-110"
              )} />
              <span className="text-sm tracking-wide">{item.name}</span>

              {/* Hover shimmer */}
              {!isActive && (
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity -translate-x-full group-hover:translate-x-full duration-500" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-4 h-px bg-white/10 mt-1" />

      {/* --- Footer / User Account Section --- */}
      <div className="px-3 py-4 space-y-0.5">
        {/* Current user card */}
        <div className="px-3 py-2.5 mb-2 bg-white/5 rounded-xl border border-white/8">
          <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest">Current User</p>
          <p className="text-sm font-black truncate text-brand-gold mt-0.5">{user?.name || "Unauthorized"}</p>
        </div>

        <Link
          to="/profile"
          onClick={() => setOpen?.(false)}
          className="flex items-center px-3 py-2.5 hover:bg-white/10 rounded-xl transition-all group"
        >
          <User className="mr-3 h-4 w-4 text-gray-400 group-hover:text-white transition-colors" />
          <span className="text-sm text-white/70 group-hover:text-white transition-colors">Account Profile</span>
        </Link>

        <button
          onClick={toggleDark}
          className="w-full flex items-center px-3 py-2.5 hover:bg-white/10 text-white/70 rounded-xl transition-all group"
        >
          {darkMode
            ? <Sun className="mr-3 h-4 w-4 text-brand-gold group-hover:rotate-12 transition-transform" />
            : <Moon className="mr-3 h-4 w-4 text-gray-400 group-hover:text-white transition-colors" />}
          <span className="text-sm group-hover:text-white transition-colors">{darkMode ? "Light Mode" : "Dark Mode"}</span>
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center px-3 py-2.5 hover:bg-red-500/20 text-red-400 rounded-xl transition-all group mt-1"
        >
          <LogOut className="mr-3 h-4 w-4 group-hover:-translate-x-1 transition-transform duration-200" />
          <span className="text-sm font-black">Sign Out</span>
        </button>
      </div>
    </div>
  );
}

import { useState } from "react";
import {
  LayoutDashboard, Car, ClipboardList, CheckSquare, User, Fuel,
  Gauge, LogOut, ShieldCheck, Navigation, CalendarDays, Moon, Sun,
  Bell, BarChart3, Users, Package, RefreshCw, Wrench,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/useUserStore";

// ── Exact access table from SRS ───────────────────────────────────────────────
// Admin      = Fleet Manager   (full access)
// Dispatcher = Fleet Dispatcher (approve, assign, fleet ops)
// Staff      = Standard User   (request + view own)
// Driver     = Driver          (request + view own + trip management)
// Mechanic   = Mechanic        (request + view own + maintenance/fuel)
const menuItems = [
  // ── Available to ALL roles ──────────────────────────────────────────────────
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    roles: ["Admin", "Dispatcher", "Staff", "Driver", "Mechanic"],
  },
  {
    name: "New Request",
    path: "/requests/new",
    icon: ClipboardList,
    roles: ["Admin", "Dispatcher", "Staff", "Driver", "Mechanic"],
  },
  {
    name: "My Requests",
    path: "/my-requests",
    icon: ClipboardList,
    roles: ["Admin", "Dispatcher", "Staff", "Driver", "Mechanic"],
  },

  // ── Dispatcher + Admin only ─────────────────────────────────────────────────
  {
    name: "Approval Queue",
    path: "/dispatch/approvals",
    icon: CheckSquare,
    roles: ["Admin", "Dispatcher"],
    badge: "Dispatch",
  },
  {
    name: "Fleet Calendar",
    path: "/dispatch/calendar",
    icon: CalendarDays,
    roles: ["Admin", "Dispatcher"],
  },
  {
    name: "Manage Fleet",
    path: "/fleet",
    icon: Car,
    roles: ["Admin", "Dispatcher"],
  },
  {
    name: "GPS Tracking",
    path: "/tracking",
    icon: Navigation,
    roles: ["Admin", "Dispatcher"],
  },
  {
    name: "Drivers",
    path: "/drivers",
    icon: Users,
    roles: ["Admin", "Dispatcher"],
  },
  {
    name: "Fuel Logs",
    path: "/fuel-log",
    icon: Fuel,
    roles: ["Admin", "Dispatcher"],
  },
  {
    name: "Maintenance",
    path: "/maintenance",
    icon: Gauge,
    roles: ["Admin", "Dispatcher"],
  },
  {
    name: "Alerts",
    path: "/alerts",
    icon: Bell,
    roles: ["Admin", "Dispatcher"],
  },

  // ── Admin only ──────────────────────────────────────────────────────────────
  {
    name: "Analytics",
    path: "/analytics",
    icon: BarChart3,
    roles: ["Admin"],
    badge: "Admin",
  },
  {
    name: "Parts & Inventory",
    path: "/inventory",
    icon: Package,
    roles: ["Admin"],
  },
  {
    name: "HR Sync",
    path: "/hr-sync",
    icon: RefreshCw,
    roles: ["Admin"],
  },
  {
    name: "User Management",
    path: "/users",
    icon: ShieldCheck,
    roles: ["Admin"],
  },
];

// ── Role badge colors ─────────────────────────────────────────────────────────
const ROLE_META = {
  Admin:      { color: "text-amber-300 bg-amber-400/20 border-amber-400/30",   dot: "bg-amber-400" },
  Dispatcher: { color: "text-blue-300 bg-blue-400/20 border-blue-400/30",      dot: "bg-blue-400" },
  Staff:      { color: "text-green-300 bg-green-400/20 border-green-400/30",   dot: "bg-green-400" },
  Driver:     { color: "text-purple-300 bg-purple-400/20 border-purple-400/30", dot: "bg-purple-400" },
  Mechanic:   { color: "text-rose-300 bg-rose-400/20 border-rose-400/30",      dot: "bg-rose-400" },
};

// ── Section separators ────────────────────────────────────────────────────────
const SECTION_LABELS = {
  "/dispatch/approvals": "Fleet Operations",
  "/analytics":          "Administration",
};

export default function Sidebar({ setOpen }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark"));

  const user   = useUserStore(s => s.user);
  const logout = useUserStore(s => s.logout);

  const toggleDark = () => {
    const isDark = document.documentElement.classList.toggle("dark");
    setDarkMode(isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Filter menu to only items the current role can access
  const role = user?.role || "Staff";
  const visibleItems = menuItems.filter(item => item.roles.includes(role));

  const roleMeta = ROLE_META[role] || ROLE_META.Staff;

  return (
    <div className="flex flex-col h-full bg-brand-blue text-white w-64 border-r border-white/10 shadow-2xl overflow-hidden relative">
      {/* Top gradient */}
      <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-blue-900/50 to-transparent pointer-events-none z-0" />

      {/* ── Logo & identity ── */}
      <div className="relative z-10 flex flex-col items-center pt-7 pb-5 px-5">
        <div className="absolute top-5 w-16 h-16 rounded-full bg-brand-gold/15 blur-2xl" />
        <div className="relative mb-3 group">
          <div className="absolute inset-0 rounded-full bg-brand-gold/25 blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative bg-white p-2.5 rounded-full shadow-xl border-2 border-white/20 group-hover:scale-105 transition-transform">
            <img src={logo} className="w-12 h-12 object-contain rounded-full" alt="MESSOB" />
          </div>
        </div>
        <h1 className="text-base font-black tracking-wider text-white">MESSOB-FMS</h1>

        {/* Role badge with live dot */}
        <div className={cn(
          "flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest",
          roleMeta.color
        )}>
          <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", roleMeta.dot)} />
          <ShieldCheck className="h-2.5 w-2.5" />
          {role}
        </div>

        {/* User name */}
        <p className="text-xs text-white/50 mt-1.5 font-medium truncate max-w-[180px] text-center">
          {user?.name || "—"}
        </p>
      </div>

      <div className="mx-4 h-px bg-white/10 mb-2" />

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto no-scrollbar pb-2">
        {visibleItems.map((item, idx) => {
          const isActive = location.pathname === item.path;
          // Show section label before first item of a new section
          const sectionLabel = SECTION_LABELS[item.path];

          return (
            <div key={item.path}>
              {sectionLabel && (
                <p className="text-[9px] font-black text-white/25 uppercase tracking-widest px-3 pt-3 pb-1">
                  {sectionLabel}
                </p>
              )}
              <Link
                to={item.path}
                onClick={() => setOpen?.(false)}
                style={{ animationDelay: `${idx * 35}ms` }}
                className={cn(
                  "flex items-center px-3 py-2.5 rounded-xl transition-all duration-150 group relative overflow-hidden animate-slide-in-left",
                  isActive
                    ? "bg-brand-gold text-brand-blue font-black shadow-lg"
                    : "hover:bg-white/10 text-white/65 hover:text-white"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-blue/60 rounded-r-full" />
                )}
                <item.icon className={cn(
                  "mr-3 h-4 w-4 shrink-0 transition-all duration-150",
                  isActive
                    ? "text-brand-blue"
                    : "text-brand-gold/60 group-hover:text-brand-gold group-hover:scale-110"
                )} />
                <span className="text-sm">{item.name}</span>
                {!isActive && (
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="mx-4 h-px bg-white/10 mt-1" />

      {/* ── Footer ── */}
      <div className="px-3 py-3 space-y-0.5">
        <Link
          to="/profile"
          onClick={() => setOpen?.(false)}
          className="flex items-center px-3 py-2 hover:bg-white/10 rounded-xl transition-all group"
        >
          <User className="mr-3 h-4 w-4 text-gray-400 group-hover:text-white transition-colors" />
          <span className="text-sm text-white/60 group-hover:text-white transition-colors">Profile</span>
        </Link>

        <button
          onClick={toggleDark}
          className="w-full flex items-center px-3 py-2 hover:bg-white/10 text-white/60 rounded-xl transition-all group"
        >
          {darkMode
            ? <Sun className="mr-3 h-4 w-4 text-brand-gold group-hover:rotate-12 transition-transform" />
            : <Moon className="mr-3 h-4 w-4 text-gray-400 group-hover:text-white transition-colors" />}
          <span className="text-sm group-hover:text-white transition-colors">
            {darkMode ? "Light Mode" : "Dark Mode"}
          </span>
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center px-3 py-2 hover:bg-red-500/20 text-red-400 rounded-xl transition-all group"
        >
          <LogOut className="mr-3 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-black">Sign Out</span>
        </button>
      </div>
    </div>
  );
}

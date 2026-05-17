import { useState } from "react";
import {
  LayoutDashboard, Car, ClipboardList, CheckSquare, User, Fuel,
  LogOut, ShieldCheck, Navigation, CalendarDays, Moon, Sun,
  Bell, BarChart3, Users, Package, RefreshCw, Wrench, Truck,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { ROLE_META, SECTION_LABELS } from "@/config/rbac";
import { useUserStore } from "@/store/useUserStore";

const ICON_MAP = {
  LayoutDashboard,
  ClipboardList,
  CheckSquare,
  CalendarDays,
  Car,
  Users,
  Navigation,
  Bell,
  Wrench,
  Fuel,
  BarChart3,
  Package,
  RefreshCw,
  ShieldCheck,
  Truck,
};

export default function Sidebar({ setOpen }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() =>
    document.documentElement.classList.contains("dark")
  );

  const { role, user, menuItems, meta } = usePermissions();
  const logout = useUserStore((s) => s.logout);

  const toggleDark = () => {
    const isDark = document.documentElement.classList.toggle("dark");
    setDarkMode(isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const roleMeta = ROLE_META[role] || ROLE_META.Staff;
  let lastSection = null;

  return (
    <div className="flex flex-col h-full bg-brand-blue text-white w-64 border-r border-white/10 shadow-2xl overflow-hidden relative">
      <SidebarHeader role={role} roleMeta={roleMeta} meta={meta} user={user} />

      <div className="mx-4 h-px bg-white/10 mb-2" />

      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto no-scrollbar pb-2">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = ICON_MAP[item.icon] || LayoutDashboard;
          const showSection = item.section && item.section !== lastSection;
          if (showSection) lastSection = item.section;

          return (
            <div key={item.path}>
              {showSection && SECTION_LABELS[item.section] && (
                <div className="flex items-center gap-2 px-3 pt-4 pb-2">
                  <div className="h-px bg-white/10 flex-1" />
                  <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">
                    {SECTION_LABELS[item.section]}
                  </p>
                  <div className="h-px bg-white/10 flex-1" />
                </div>
              )}
              <Link
                to={item.path}
                onClick={() => setOpen?.(false)}
                className={cn(
                  "flex items-center px-3 py-2.5 rounded-xl transition-all duration-150",
                  isActive
                    ? "bg-brand-gold text-brand-blue font-black shadow-lg"
                    : "hover:bg-white/10 text-white/65 hover:text-white"
                )}
              >
                <Icon className={cn("mr-3 h-4 w-4 shrink-0", isActive ? "text-brand-blue" : "text-brand-gold/60")} />
                <span className="text-sm font-medium">{item.name}</span>
                {item.badge && !isActive && (
                  <span className="ml-auto text-[8px] font-black px-1.5 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold border border-brand-gold/30">
                    {item.badge}
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="mx-4 h-px bg-white/10 mt-1" />
      <SidebarFooter setOpen={setOpen} darkMode={darkMode} toggleDark={toggleDark} handleLogout={handleLogout} />
    </div>
  );
}

function SidebarHeader({ role, roleMeta, meta, user }) {
  return (
    <div className="relative z-10 flex flex-col items-center pt-7 pb-5 px-5">
      <div className="bg-white p-2.5 rounded-full shadow-xl border-2 border-white/20 mb-3">
        <img src={logo} className="w-12 h-12 object-contain rounded-full" alt="MESSOB" />
      </div>
      <h1 className="text-base font-black tracking-wider">MESSOB-FMS</h1>
      <div className={cn(
        "flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest",
        roleMeta.color
      )}>
        <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", roleMeta.dot)} />
        <ShieldCheck className="h-2.5 w-2.5" />
        {role}
      </div>
      <p className="text-xs text-white/50 mt-1.5 truncate max-w-[180px]">{user?.name || "—"}</p>
      <p className="text-[10px] text-white/35 mt-1 text-center px-2">{meta.description}</p>
    </div>
  );
}

function SidebarFooter({ setOpen, darkMode, toggleDark, handleLogout }) {
  return (
    <div className="px-3 py-3 space-y-0.5">
      <Link to="/profile" onClick={() => setOpen?.(false)} className="flex items-center px-3 py-2 hover:bg-white/10 rounded-xl">
        <User className="mr-3 h-4 w-4 text-gray-400" />
        <span className="text-sm text-white/60">Profile</span>
      </Link>
      <button type="button" onClick={toggleDark} className="w-full flex items-center px-3 py-2 hover:bg-white/10 text-white/60 rounded-xl">
        {darkMode ? <Sun className="mr-3 h-4 w-4 text-brand-gold" /> : <Moon className="mr-3 h-4 w-4" />}
        <span className="text-sm">{darkMode ? "Light Mode" : "Dark Mode"}</span>
      </button>
      <button type="button" onClick={handleLogout} className="w-full flex items-center px-3 py-2 hover:bg-red-500/20 text-red-400 rounded-xl">
        <LogOut className="mr-3 h-4 w-4" />
        <span className="text-sm font-black">Sign Out</span>
      </button>
    </div>
  );
}

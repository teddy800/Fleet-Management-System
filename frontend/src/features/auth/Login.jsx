import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate, useLocation } from "react-router-dom";
import { useUserStore } from "@/store/useUserStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Eye, EyeOff, Lock, Mail, AlertCircle, Shield,
  ChevronRight, Truck, Users, Wrench, UserCheck,
  Star, Zap, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

// ─── Validation schema ────────────────────────────────────────────────────────
const loginSchema = z.object({
  email:    z.string().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
});

// ─── Role definitions ─────────────────────────────────────────────────────────
const ROLES = [
  {
    id: "admin",
    role: "Fleet Manager",
    badge: "ADMIN",
    badgeColor: "bg-amber-500",
    color: "from-amber-500 to-orange-500",
    border: "border-amber-400/30",
    bg: "bg-amber-500/8",
    ringColor: "ring-amber-400/20",
    icon: Star,
    description: "Full system access",
    credentials: [
      { username: "admin", password: "admin", label: "System Admin", note: "Default Odoo admin" },
    ],
    access: ["Full CRUD", "User Management", "Analytics", "HR Sync", "All Modules"],
  },
  {
    id: "dispatcher",
    role: "Fleet Dispatcher",
    badge: "DISPATCHER",
    badgeColor: "bg-blue-500",
    color: "from-blue-500 to-cyan-500",
    border: "border-blue-400/30",
    bg: "bg-blue-500/8",
    ringColor: "ring-blue-400/20",
    icon: Zap,
    description: "Approve & assign trips",
    credentials: [
      { username: "tigist.haile@mesob.com",  password: "Dispatcher@123", label: "Tigist Haile" },
      { username: "rahel.mekonnen@mesob.com", password: "Dispatcher@123", label: "Rahel Mekonnen" },
    ],
    access: ["Approve Requests", "Assign Vehicles", "Fleet Calendar", "GPS Tracking", "Fuel & Maintenance"],
  },
  {
    id: "staff",
    role: "Staff User",
    badge: "STAFF",
    badgeColor: "bg-green-500",
    color: "from-green-500 to-emerald-500",
    border: "border-green-400/30",
    bg: "bg-green-500/8",
    ringColor: "ring-green-400/20",
    icon: UserCheck,
    description: "Request vehicles",
    credentials: [
      { username: "dawit.bekele@mesob.com", password: "Staff@123", label: "Dawit Bekele" },
      { username: "kebede.worku@mesob.com", password: "Staff@123", label: "Kebede Worku" },
    ],
    access: ["Create Requests", "View Own Requests", "Track Assigned Vehicle", "Update Pickup Point"],
  },
  {
    id: "driver",
    role: "Driver",
    badge: "DRIVER",
    badgeColor: "bg-purple-500",
    color: "from-purple-500 to-violet-500",
    border: "border-purple-400/30",
    bg: "bg-purple-500/8",
    ringColor: "ring-purple-400/20",
    icon: Truck,
    description: "View & manage trips",
    credentials: [
      { username: "abebe.kebede@mesob.com",     password: "Driver@123", label: "Abebe Kebede" },
      { username: "sara.tesfaye@mesob.com",     password: "Driver@123", label: "Sara Tesfaye" },
      { username: "yonas.girma@mesob.com",      password: "Driver@123", label: "Yonas Girma" },
      { username: "mekdes.alemu@mesob.com",     password: "Driver@123", label: "Mekdes Alemu" },
      { username: "hana.worku@mesob.com",       password: "Driver@123", label: "Hana Worku" },
      { username: "tesfaye.mulugeta@mesob.com", password: "Driver@123", label: "Tesfaye Mulugeta" },
      { username: "liya.solomon@mesob.com",     password: "Driver@123", label: "Liya Solomon" },
    ],
    access: ["View Assigned Trips", "Start / Complete Trip", "Update Location", "Log Fuel Usage"],
  },
  {
    id: "mechanic",
    role: "Mechanic",
    badge: "MECHANIC",
    badgeColor: "bg-rose-500",
    color: "from-rose-500 to-pink-500",
    border: "border-rose-400/30",
    bg: "bg-rose-500/8",
    ringColor: "ring-rose-400/20",
    icon: Wrench,
    description: "Maintenance & fuel",
    credentials: [
      { username: "biruk.tadesse@mesob.com", password: "Mechanic@123", label: "Biruk Tadesse" },
    ],
    access: ["Log Maintenance", "Record Fuel", "View Schedules", "Service Records"],
  },
];

// ─── Single role card ─────────────────────────────────────────────────────────
function RoleCard({ role, onFill, activeUser }) {
  const [open, setOpen] = useState(false);
  const Icon = role.icon;
  const isActive = role.credentials.some(c => c.username === activeUser);

  return (
    <div className={cn(
      "rounded-2xl border transition-all duration-200 overflow-hidden",
      role.border, role.bg,
      isActive && `ring-2 ${role.ringColor}`,
      "hover:brightness-110"
    )}>
      {/* Header row — always visible */}
      <button
        type="button"
        className="w-full flex items-center gap-3 p-3.5 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className={cn("p-2 rounded-xl bg-gradient-to-br shrink-0 shadow-md", role.color)}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black text-white leading-none">{role.role}</span>
            <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-md text-white", role.badgeColor)}>
              {role.badge}
            </span>
          </div>
          <p className="text-[11px] text-white/50 mt-0.5 leading-none">{role.description}</p>
        </div>
        <ChevronRight className={cn(
          "h-4 w-4 text-white/30 transition-transform duration-200 shrink-0",
          open && "rotate-90"
        )} />
      </button>

      {/* Expanded body */}
      {open && (
        <div className="border-t border-white/10 px-3.5 pb-3.5 pt-3 space-y-3">
          {/* Access tags */}
          <div className="flex flex-wrap gap-1">
            {role.access.map(a => (
              <span key={a} className="flex items-center gap-1 text-[10px] text-white/60 bg-white/8 px-2 py-0.5 rounded-full border border-white/10">
                <CheckCircle2 className="h-2.5 w-2.5 text-green-400 shrink-0" />
                {a}
              </span>
            ))}
          </div>

          {/* Credential buttons */}
          <div className="space-y-1.5">
            {role.credentials.map(cred => (
              <button
                key={cred.username}
                type="button"
                onClick={e => { e.stopPropagation(); onFill(cred.username, cred.password); }}
                className={cn(
                  "w-full text-left p-2.5 rounded-xl border transition-all duration-150 group",
                  "border-white/10 bg-white/5 hover:bg-white/12 hover:border-white/25",
                  activeUser === cred.username && "border-white/30 bg-white/12"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate">{cred.label}</p>
                    <p className="text-[10px] text-white/45 font-mono truncate">{cred.username}</p>
                    <p className="text-[10px] text-white/35 font-mono">pw: {cred.password}</p>
                    {cred.note && <p className="text-[9px] text-white/25 mt-0.5">{cred.note}</p>}
                  </div>
                  <div className={cn(
                    "shrink-0 text-[9px] font-black px-2 py-1 rounded-lg bg-gradient-to-r text-white",
                    "opacity-0 group-hover:opacity-100 transition-opacity",
                    role.color
                  )}>
                    USE →
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Top progress bar shown during login (replaces black overlay) ────────────
function LoginProgress({ role, visible }) {
  const roleColors = {
    Admin:      "from-amber-400 to-orange-400",
    Dispatcher: "from-blue-400 to-cyan-400",
    Staff:      "from-green-400 to-emerald-400",
    Driver:     "from-purple-400 to-violet-400",
    Mechanic:   "from-rose-400 to-pink-400",
  };
  const barColor = roleColors[role] || "from-blue-400 to-cyan-400";

  if (!visible) return null;

  return (
    <div className="absolute top-0 left-0 right-0 z-10 rounded-t-3xl overflow-hidden">
      {/* Animated progress bar */}
      <div className="h-1 bg-white/10">
        <div
          className={cn("h-full bg-gradient-to-r animate-pulse", barColor)}
          style={{ width: "100%", animation: "shimmer 1.5s ease-in-out infinite" }}
        />
      </div>
    </div>
  );
}

// ─── Main Login page ──────────────────────────────────────────────────────────
export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError]         = useState(null);
  const [loginRole, setLoginRole]       = useState(null);   // role detected during login
  const [mobileOpen, setMobileOpen]     = useState(false);
  const navigate  = useNavigate();
  const location  = useLocation();
  const loginUser = useUserStore(s => s.login);
  const isAuthenticated = useUserStore(s => s.isAuthenticated);

  // If already logged in, redirect immediately
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || "/dashboard";
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const activeUser = watch("email");

  const onSubmit = async (data) => {
    setApiError(null);
    setLoginRole(null);
    const result = await loginUser(data.email, data.password);
    if (result.success) {
      setLoginRole(result.role);
      // Small delay so user sees the role-specific loading message
      setTimeout(() => {
        const from = location.state?.from?.pathname || "/dashboard";
        navigate(from, { replace: true });
      }, 400);
    } else {
      setApiError(result.error || "Invalid credentials. Please try again.");
    }
  };

  const fillCredentials = (username, password) => {
    setValue("email", username, { shouldValidate: true });
    setValue("password", password, { shouldValidate: true });
    setApiError(null);
    setMobileOpen(false);
  };

  return (
    <div
      className="fixed inset-0 flex overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 40%, #1e40af 70%, #0f172a 100%)" }}
    >
      {/* ── Animated background ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Blobs */}
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full opacity-20 blur-[100px] animate-pulse"
          style={{ background: "radial-gradient(circle, #3b82f6, transparent)" }} />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-15 blur-[100px]"
          style={{ background: "radial-gradient(circle, #f59e0b, transparent)", animation: "pulse 4s ease-in-out infinite reverse" }} />
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "50px 50px" }} />
        {/* Particles */}
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} className="absolute rounded-full bg-white/15 animate-pulse"
            style={{
              left: `${(i * 37 + 11) % 100}%`,
              top: `${(i * 53 + 7) % 100}%`,
              width: (i % 3) + 1,
              height: (i % 3) + 1,
              animationDelay: `${(i * 0.3) % 4}s`,
              animationDuration: `${4 + (i % 4)}s`,
            }}
          />
        ))}
      </div>

      {/* ── Main layout ── */}
      <div className="relative z-10 flex w-full h-full">

        {/* ══ LEFT PANEL — Role Credentials (desktop) ══ */}
        <aside className="hidden xl:flex flex-col w-[400px] shrink-0 h-full border-r border-white/10 bg-white/[0.02] backdrop-blur-sm">
          {/* Panel header */}
          <div className="px-5 pt-7 pb-4 border-b border-white/8">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Access Control</span>
            </div>
            <h2 className="text-lg font-black text-white">Role Credentials</h2>
            <p className="text-[11px] text-white/35 mt-0.5">Click any credential to auto-fill the login form</p>
          </div>

          {/* Role cards — scrollable */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5 scrollbar-thin">
            {ROLES.map(r => (
              <RoleCard key={r.id} role={r} onFill={fillCredentials} activeUser={activeUser} />
            ))}
          </div>

          {/* Panel footer */}
          <div className="px-5 py-3 border-t border-white/8">
            <p className="text-[10px] text-white/20 text-center">
              MESSOB Fleet Management System v1.1 · Secure RBAC
            </p>
          </div>
        </aside>

        {/* ══ RIGHT PANEL — Login Form ══ */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 overflow-y-auto">
          <div className="w-full max-w-[400px]">

            {/* Logo & title */}
            <div className="flex flex-col items-center mb-7">
              <div className="relative mb-4">
                <div className="absolute inset-0 rounded-3xl bg-amber-400/30 blur-2xl animate-pulse" />
                <div className="relative bg-white/10 backdrop-blur-xl p-4 rounded-3xl shadow-2xl border border-white/20">
                  <img src={logo} alt="MESSOB" className="h-14 w-14 object-contain rounded-2xl" />
                </div>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">MESSOB-FMS</h1>
              <p className="text-white/35 text-xs mt-1 tracking-widest uppercase font-semibold">Fleet Management System</p>
              <div className="flex items-center gap-2 mt-3">
                <span className="flex items-center gap-1.5 text-[10px] font-black text-green-400 bg-green-400/10 border border-green-400/20 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  System Online
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-black text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2.5 py-1 rounded-full">
                  <Shield className="h-2.5 w-2.5" />
                  Secure RBAC
                </span>
              </div>
            </div>

            {/* Login card */}
            <div className="relative rounded-3xl overflow-hidden shadow-2xl">
              {/* Top progress bar — replaces black overlay */}
              <LoginProgress role={loginRole} visible={isSubmitting} />

              <div className="bg-white/10 backdrop-blur-2xl rounded-3xl p-7 border border-white/20">
                {/* Card header */}
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-blue-500/20 border border-blue-400/30">
                      <Shield className="h-3.5 w-3.5 text-blue-400" />
                    </div>
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Secure Login</span>
                  </div>
                  <h2 className="text-xl font-black text-white">Welcome back</h2>
                  <p className="text-white/45 text-sm mt-0.5">Sign in to your MESSOB account</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                  {/* Username field */}
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-[10px] font-black text-white/55 uppercase tracking-widest">
                      Username or Email
                    </Label>
                    <div className="relative group">
                      <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-white/30 group-focus-within:text-blue-400 transition-colors pointer-events-none" />
                      <Input
                        id="email"
                        type="text"
                        placeholder="admin"
                        autoComplete="username"
                        {...register("email")}
                        className={cn(
                          "pl-10 h-12 rounded-xl text-sm text-white placeholder:text-white/20",
                          "bg-white/10 border-white/20 focus:bg-white/15",
                          "focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20",
                          errors.email && "border-red-400/60"
                        )}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-xs text-red-400 font-semibold flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {errors.email.message}
                      </p>
                    )}
                  </div>

                  {/* Password field */}
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-[10px] font-black text-white/55 uppercase tracking-widest">
                      Password
                    </Label>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-white/30 group-focus-within:text-blue-400 transition-colors pointer-events-none" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        {...register("password")}
                        className={cn(
                          "pl-10 pr-10 h-12 rounded-xl text-sm text-white placeholder:text-white/20",
                          "bg-white/10 border-white/20 focus:bg-white/15",
                          "focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20",
                          errors.password && "border-red-400/60"
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(s => !s)}
                        className="absolute right-3.5 top-3.5 text-white/30 hover:text-white/70 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-xs text-red-400 font-semibold flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {errors.password.message}
                      </p>
                    )}
                  </div>

                  {/* API error */}
                  {apiError && (
                    <div className="bg-red-500/10 border border-red-400/30 rounded-xl p-3 text-sm text-red-300 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                      <span className="font-medium">{apiError}</span>
                    </div>
                  )}

                  {/* Submit button */}
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className={cn(
                      "w-full h-12 rounded-xl text-sm font-black shadow-xl border-0 relative overflow-hidden group transition-all active:scale-[0.98]",
                      isSubmitting && "opacity-90 cursor-not-allowed"
                    )}
                    style={{ background: "linear-gradient(135deg, #1d4ed8, #2563eb, #1e40af)" }}
                  >
                    <span className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2.5">
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin shrink-0" />
                        <span>Signing in...</span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Sign In
                        <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    )}
                  </Button>

                  {/* Inline status message — shown instead of black overlay */}
                  {isSubmitting && (
                    <div className="flex items-center justify-center gap-2 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                      <p className="text-[11px] text-white/50 text-center">
                        {loginRole
                          ? `Loading ${loginRole} dashboard...`
                          : "Verifying credentials..."}
                      </p>
                    </div>
                  )}
                </form>

                {/* Mobile credentials toggle */}
                <div className="mt-4 xl:hidden">
                  <button
                    type="button"
                    onClick={() => setMobileOpen(o => !o)}
                    className="w-full text-center text-xs text-white/35 hover:text-white/60 transition-colors py-2 border border-white/10 rounded-xl hover:border-white/20 hover:bg-white/5"
                  >
                    {mobileOpen ? "▲ Hide" : "▼ Show"} test credentials
                  </button>
                  {mobileOpen && (
                    <div className="mt-3 space-y-2 max-h-[45vh] overflow-y-auto scrollbar-thin">
                      {ROLES.map(r => (
                        <RoleCard key={r.id} role={r} onFill={fillCredentials} activeUser={activeUser} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick admin hint */}
                <p className="text-center text-[11px] text-white/20 mt-4">
                  Default admin:{" "}
                  <button
                    type="button"
                    onClick={() => fillCredentials("admin", "admin")}
                    className="text-white/45 hover:text-white font-black underline underline-offset-2 transition-colors"
                  >
                    admin / admin
                  </button>
                </p>
              </div>
            </div>

            {/* Role legend grid (mobile only, below form) */}
            <div className="mt-5 grid grid-cols-3 gap-2 xl:hidden">
              {ROLES.map(r => {
                const Icon = r.icon;
                return (
                  <div key={r.id} className={cn("flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center", r.border, r.bg)}>
                    <div className={cn("p-1.5 rounded-lg bg-gradient-to-br", r.color)}>
                      <Icon className="h-3 w-3 text-white" />
                    </div>
                    <p className="text-[10px] font-black text-white leading-none">{r.badge}</p>
                    <p className="text-[9px] text-white/35 leading-none">{r.description}</p>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-[10px] text-white/12 mt-5">
              © {new Date().getFullYear()} MESSOB Center Logistics · All rights reserved
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

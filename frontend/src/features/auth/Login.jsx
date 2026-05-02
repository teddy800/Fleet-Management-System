import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
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

const loginSchema = z.object({
  email: z.string().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
});

// ─── Role credential cards ────────────────────────────────────────────────────
const ROLE_CARDS = [
  {
    role: "Fleet Manager",
    badge: "Admin",
    color: "from-amber-500 to-orange-500",
    border: "border-amber-400/40",
    bg: "bg-amber-500/10",
    icon: Star,
    iconColor: "text-amber-400",
    description: "Full system access",
    credentials: [
      { username: "admin", password: "admin", label: "System Admin" },
    ],
    access: ["Full CRUD", "User Management", "Analytics", "HR Sync", "All Modules"],
  },
  {
    role: "Fleet Dispatcher",
    badge: "Dispatcher",
    color: "from-blue-500 to-cyan-500",
    border: "border-blue-400/40",
    bg: "bg-blue-500/10",
    icon: Zap,
    iconColor: "text-blue-400",
    description: "Approve & assign trips",
    credentials: [
      { username: "tigist.haile@mesob.com",  password: "Dispatcher@123", label: "Tigist Haile" },
      { username: "rahel.mekonnen@mesob.com", password: "Dispatcher@123", label: "Rahel Mekonnen" },
    ],
    access: ["Approve Requests", "Assign Vehicles", "Fleet Calendar", "GPS Tracking", "Fuel & Maintenance"],
  },
  {
    role: "Staff User",
    badge: "Staff",
    color: "from-green-500 to-emerald-500",
    border: "border-green-400/40",
    bg: "bg-green-500/10",
    icon: UserCheck,
    iconColor: "text-green-400",
    description: "Request vehicles",
    credentials: [
      { username: "dawit.bekele@mesob.com",  password: "Staff@123", label: "Dawit Bekele" },
      { username: "kebede.worku@mesob.com",  password: "Staff@123", label: "Kebede Worku" },
    ],
    access: ["Create Requests", "View Own Requests", "Track Assigned Vehicle", "Update Pickup Point"],
  },
  {
    role: "Driver",
    badge: "Driver",
    color: "from-purple-500 to-violet-500",
    border: "border-purple-400/40",
    bg: "bg-purple-500/10",
    icon: Truck,
    iconColor: "text-purple-400",
    description: "View & manage trips",
    credentials: [
      { username: "abebe.kebede@mesob.com",    password: "Driver@123", label: "Abebe Kebede" },
      { username: "sara.tesfaye@mesob.com",    password: "Driver@123", label: "Sara Tesfaye" },
      { username: "yonas.girma@mesob.com",     password: "Driver@123", label: "Yonas Girma" },
      { username: "mekdes.alemu@mesob.com",    password: "Driver@123", label: "Mekdes Alemu" },
      { username: "hana.worku@mesob.com",      password: "Driver@123", label: "Hana Worku" },
      { username: "tesfaye.mulugeta@mesob.com",password: "Driver@123", label: "Tesfaye Mulugeta" },
      { username: "liya.solomon@mesob.com",    password: "Driver@123", label: "Liya Solomon" },
    ],
    access: ["View Assigned Trips", "Start / Complete Trip", "Update Location", "Log Fuel Usage"],
  },
  {
    role: "Mechanic",
    badge: "Mechanic",
    color: "from-rose-500 to-pink-500",
    border: "border-rose-400/40",
    bg: "bg-rose-500/10",
    icon: Wrench,
    iconColor: "text-rose-400",
    description: "Maintenance & fuel",
    credentials: [
      { username: "biruk.tadesse@mesob.com", password: "Mechanic@123", label: "Biruk Tadesse" },
    ],
    access: ["Log Maintenance", "Record Fuel", "View Schedules", "Service Records"],
  },
];

// ─── Particle dots ────────────────────────────────────────────────────────────
function Particles() {
  const dots = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    delay: Math.random() * 4,
    duration: Math.random() * 6 + 4,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {dots.map(d => (
        <div
          key={d.id}
          className="absolute rounded-full bg-white/20 animate-pulse"
          style={{
            left: `${d.x}%`,
            top: `${d.y}%`,
            width: d.size,
            height: d.size,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Credential card ──────────────────────────────────────────────────────────
function CredentialCard({ card, onFill }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = card.icon;

  return (
    <div
      className={cn(
        "rounded-2xl border backdrop-blur-sm transition-all duration-300 overflow-hidden",
        card.border, card.bg,
        "hover:scale-[1.01] hover:shadow-lg cursor-pointer"
      )}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div className={cn("p-2 rounded-xl bg-gradient-to-br", card.color, "shadow-lg")}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-white">{card.role}</span>
            <span className={cn(
              "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
              `bg-gradient-to-r ${card.color} text-white`
            )}>
              {card.badge}
            </span>
          </div>
          <p className="text-[11px] text-white/50 mt-0.5">{card.description}</p>
        </div>
        <ChevronRight className={cn(
          "h-4 w-4 text-white/40 transition-transform duration-300 shrink-0",
          expanded && "rotate-90"
        )} />
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-white/10 px-4 pb-4 pt-3 space-y-3">
          {/* Access list */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {card.access.map(a => (
              <span key={a} className="flex items-center gap-1 text-[10px] text-white/70 bg-white/10 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="h-2.5 w-2.5 text-green-400" />
                {a}
              </span>
            ))}
          </div>

          {/* Credentials */}
          <div className="space-y-2">
            {card.credentials.map((cred) => (
              <button
                key={cred.username}
                onClick={(e) => { e.stopPropagation(); onFill(cred.username, cred.password); }}
                className={cn(
                  "w-full text-left p-3 rounded-xl border border-white/10 bg-white/5",
                  "hover:bg-white/15 hover:border-white/30 transition-all duration-200 group"
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-white group-hover:text-white">{cred.label}</p>
                    <p className="text-[10px] text-white/50 font-mono mt-0.5">{cred.username}</p>
                    <p className="text-[10px] text-white/40 font-mono">pw: {cred.password}</p>
                  </div>
                  <div className={cn(
                    "text-[9px] font-black px-2 py-1 rounded-lg bg-gradient-to-r text-white opacity-0 group-hover:opacity-100 transition-opacity",
                    card.color
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

// ─── Main Login component ─────────────────────────────────────────────────────
export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [showCredentials, setShowCredentials] = useState(false);
  const navigate = useNavigate();
  const loginUser = useUserStore((state) => state.login);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const emailVal = watch("email");

  const onSubmit = async (data) => {
    setApiError(null);
    const result = await loginUser(data.email, data.password);
    if (result.success) {
      navigate("/dashboard");
    } else {
      setApiError(result.error || "Invalid credentials. Please try again.");
    }
  };

  const fillCredentials = (username, password) => {
    setValue("email", username, { shouldValidate: true });
    setValue("password", password, { shouldValidate: true });
    setApiError(null);
    setShowCredentials(false);
  };

  return (
    <div className="fixed inset-0 flex overflow-hidden" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 40%, #1e40af 70%, #0f172a 100%)" }}>
      <Particles />

      {/* Animated blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-20 blur-[120px] animate-pulse"
        style={{ background: "radial-gradient(circle, #3b82f6, transparent)" }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15 blur-[100px]"
        style={{ background: "radial-gradient(circle, #f59e0b, transparent)", animation: "pulse 4s ease-in-out infinite reverse" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-5 blur-[150px]"
        style={{ background: "radial-gradient(circle, #60a5fa, transparent)" }} />

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "50px 50px" }} />

      {/* ── MAIN LAYOUT ── */}
      <div className="relative z-10 flex w-full h-full">

        {/* ── LEFT PANEL: Credentials Reference ── */}
        <div className={cn(
          "hidden xl:flex flex-col w-[420px] shrink-0 h-full border-r border-white/10 backdrop-blur-sm",
          "bg-white/[0.03] overflow-hidden"
        )}>
          {/* Header */}
          <div className="px-6 pt-8 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-amber-400" />
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Access Control</span>
            </div>
            <h2 className="text-xl font-black text-white">Role Credentials</h2>
            <p className="text-xs text-white/40 mt-1">Click any credential to auto-fill the login form</p>
          </div>

          {/* Cards */}
          <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3 scrollbar-thin">
            {ROLE_CARDS.map(card => (
              <CredentialCard key={card.role} card={card} onFill={fillCredentials} />
            ))}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/10">
            <p className="text-[10px] text-white/25 text-center">
              MESSOB Fleet Management System v1.1 · Secure RBAC
            </p>
          </div>
        </div>

        {/* ── RIGHT PANEL: Login Form ── */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 overflow-y-auto">
          <div className="w-full max-w-[420px]">

            {/* Logo */}
            <div className="flex flex-col items-center mb-8">
              <div className="relative mb-4">
                <div className="absolute inset-0 rounded-3xl bg-amber-400/40 blur-2xl animate-pulse" />
                <div className="absolute inset-0 rounded-3xl bg-blue-500/20 blur-xl" style={{ animation: "pulse 3s ease-in-out infinite 1s" }} />
                <div className="relative bg-white/10 backdrop-blur-xl p-4 rounded-3xl shadow-2xl border border-white/20">
                  <img src={logo} alt="MESSOB" className="h-16 w-16 object-contain rounded-2xl" />
                </div>
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight">MESSOB-FMS</h1>
              <p className="text-white/40 text-sm mt-1 tracking-widest uppercase font-semibold">Fleet Management System</p>

              {/* Status pills */}
              <div className="flex items-center gap-2 mt-3">
                <span className="flex items-center gap-1.5 text-[10px] font-black text-green-400 bg-green-400/10 border border-green-400/20 px-3 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  System Online
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-black text-blue-400 bg-blue-400/10 border border-blue-400/20 px-3 py-1 rounded-full">
                  <Shield className="h-2.5 w-2.5" />
                  Secure RBAC
                </span>
              </div>
            </div>

            {/* Login Card */}
            <div className="relative rounded-3xl overflow-hidden shadow-2xl">
              {/* Card gradient border */}
              <div className="absolute inset-0 rounded-3xl p-[1px] bg-gradient-to-br from-white/30 via-white/10 to-white/5 pointer-events-none" />

              <div className="relative bg-white/10 backdrop-blur-2xl rounded-3xl p-8 border border-white/20">
                {/* Card header */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-blue-500/20 border border-blue-400/30">
                      <Shield className="h-3.5 w-3.5 text-blue-400" />
                    </div>
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Secure Login</span>
                  </div>
                  <h2 className="text-2xl font-black text-white">Welcome back</h2>
                  <p className="text-white/50 text-sm mt-1">Sign in to your MESSOB account</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {/* Username */}
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                      Username or Email
                    </Label>
                    <div className="relative group">
                      <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-white/30 transition-colors group-focus-within:text-blue-400" />
                      <Input
                        id="email"
                        type="text"
                        placeholder="admin"
                        autoComplete="username"
                        {...register("email")}
                        className={cn(
                          "pl-10 h-12 rounded-xl text-sm transition-all text-white placeholder:text-white/25",
                          "bg-white/10 border-white/20 focus:bg-white/15",
                          "focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20",
                          errors.email && "border-red-400/60 focus:border-red-400"
                        )}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-xs text-red-400 font-semibold flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.email.message}
                      </p>
                    )}
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                      Password
                    </Label>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-white/30 transition-colors group-focus-within:text-blue-400" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        {...register("password")}
                        className={cn(
                          "pl-10 pr-10 h-12 rounded-xl text-sm transition-all text-white placeholder:text-white/25",
                          "bg-white/10 border-white/20 focus:bg-white/15",
                          "focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20",
                          errors.password && "border-red-400/60 focus:border-red-400"
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(s => !s)}
                        className="absolute right-3.5 top-3.5 text-white/30 hover:text-white/70 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-xs text-red-400 font-semibold flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.password.message}
                      </p>
                    )}
                  </div>

                  {/* API Error */}
                  {apiError && (
                    <div className="bg-red-500/10 border border-red-400/30 rounded-xl p-3 text-sm text-red-300 font-medium flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                      <span>{apiError}</span>
                    </div>
                  )}

                  {/* Submit */}
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 rounded-xl text-sm font-black shadow-xl transition-all active:scale-[0.98] border-0 relative overflow-hidden group"
                    style={{ background: "linear-gradient(135deg, #1d4ed8, #2563eb, #1e40af)" }}
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Authenticating...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        Sign In
                        <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </span>
                    )}
                  </Button>
                </form>

                {/* Quick credentials toggle (mobile) */}
                <div className="mt-5 xl:hidden">
                  <button
                    type="button"
                    onClick={() => setShowCredentials(s => !s)}
                    className="w-full text-center text-xs text-white/40 hover:text-white/70 transition-colors py-2 border border-white/10 rounded-xl hover:border-white/20 hover:bg-white/5"
                  >
                    {showCredentials ? "Hide" : "Show"} test credentials
                  </button>

                  {showCredentials && (
                    <div className="mt-3 space-y-2 max-h-[50vh] overflow-y-auto">
                      {ROLE_CARDS.map(card => (
                        <CredentialCard key={card.role} card={card} onFill={fillCredentials} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Hint */}
                <p className="text-center text-[11px] text-white/25 mt-5">
                  Use your Odoo credentials · Default admin:{" "}
                  <button
                    type="button"
                    onClick={() => fillCredentials("admin", "admin")}
                    className="text-white/50 hover:text-white font-black underline underline-offset-2 transition-colors"
                  >
                    admin / admin
                  </button>
                </p>
              </div>
            </div>

            {/* Role legend (compact, below form) */}
            <div className="mt-6 grid grid-cols-2 gap-2 xl:hidden">
              {ROLE_CARDS.map(card => {
                const Icon = card.icon;
                return (
                  <div key={card.role} className={cn("flex items-center gap-2 p-2.5 rounded-xl border", card.border, card.bg)}>
                    <div className={cn("p-1.5 rounded-lg bg-gradient-to-br shrink-0", card.color)}>
                      <Icon className="h-3 w-3 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-white">{card.badge}</p>
                      <p className="text-[9px] text-white/40">{card.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-[10px] text-white/15 mt-6">
              © {new Date().getFullYear()} MESSOB Center Logistics · All rights reserved
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/useUserStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock, Mail, AlertCircle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

const loginSchema = z.object({
  email: z.string().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
});

// Floating orb component for animated background
function Orb({ className }) {
  return <div className={cn("absolute rounded-full pointer-events-none", className)} />;
}

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState(null);
  const navigate = useNavigate();
  const loginUser = useUserStore((state) => state.login);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" }
  });

  const onSubmit = async (data) => {
    setApiError(null);
    const result = await loginUser(data.email, data.password);
    if (result.success) {
      navigate("/dashboard");
    } else {
      setApiError(result.error || "Invalid credentials. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden gradient-brand">
      {/* Animated background orbs */}
      <Orb className="w-[500px] h-[500px] -top-32 -left-32 bg-blue-600/20 blur-[80px] animate-float" />
      <Orb className="w-[400px] h-[400px] -bottom-24 -right-24 bg-brand-gold/15 blur-[80px]"
        style={{ animation: "float 4s ease-in-out infinite reverse" }} />
      <Orb className="w-[300px] h-[300px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-400/10 blur-[60px]"
        style={{ animation: "float 5s ease-in-out infinite 1s" }} />

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md mx-4 animate-fade-in-up">
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-3xl bg-brand-gold/30 blur-xl animate-pulse" />
            <div className="relative bg-white p-3 rounded-3xl shadow-2xl border-2 border-white/30">
              <img src={logo} alt="MESSOB" className="h-16 w-16 object-contain rounded-2xl" />
            </div>
          </div>
          <h1 className="text-white font-black text-2xl tracking-tight">MESSOB-FMS</h1>
          <p className="text-white/50 text-sm mt-1 tracking-wide">Fleet Management System</p>
        </div>

        {/* Card */}
        <div className="glass rounded-3xl shadow-2xl p-8 border border-white/40">
          {/* Card Header */}
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-brand-blue" />
              <span className="text-xs font-black text-brand-blue uppercase tracking-widest">Secure Login</span>
            </div>
            <h2 className="text-2xl font-black text-gray-900">Welcome back</h2>
            <p className="text-gray-500 mt-1 text-sm">Sign in to your MESSOB account</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Username */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-black text-gray-600 uppercase tracking-widest">
                Username or Email
              </Label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400 transition-colors group-focus-within:text-brand-blue" />
                <Input
                  id="email"
                  type="text"
                  placeholder="admin"
                  autoComplete="username"
                  {...register("email")}
                  className={cn(
                    "pl-10 h-12 border-2 rounded-xl text-sm transition-all bg-white/80 focus:bg-white",
                    errors.email
                      ? "border-red-400 focus:border-red-400"
                      : "border-gray-200 focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(30,58,138,0.1)]"
                  )}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-500 font-semibold flex items-center gap-1 animate-fade-in-down">
                  <AlertCircle className="h-3 w-3" /> {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-black text-gray-600 uppercase tracking-widest">
                Password
              </Label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400 transition-colors group-focus-within:text-brand-blue" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register("password")}
                  className={cn(
                    "pl-10 pr-10 h-12 border-2 rounded-xl text-sm transition-all bg-white/80 focus:bg-white",
                    errors.password
                      ? "border-red-400 focus:border-red-400"
                      : "border-gray-200 focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(30,58,138,0.1)]"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500 font-semibold flex items-center gap-1 animate-fade-in-down">
                  <AlertCircle className="h-3 w-3" /> {errors.password.message}
                </p>
              )}
            </div>

            {/* API Error */}
            {apiError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 font-medium flex items-start gap-2 animate-scale-in">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {apiError}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 gradient-brand hover:opacity-90 text-white font-black rounded-xl text-sm shadow-lg transition-all active:scale-[0.98] border-0 relative overflow-hidden group"
            >
              <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : "Sign In"}
            </Button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Use your Odoo credentials (e.g. username: <strong className="text-gray-600">admin</strong>)
          </p>
        </div>

        <p className="text-center text-xs text-white/25 mt-6">
          &copy; {new Date().getFullYear()} MESSOB Center Logistics
        </p>
      </div>
    </div>
  );
}

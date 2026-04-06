import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/useUserStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock, Mail, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

const loginSchema = z.object({
  email: z.string().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
});

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
    <div
      className="fixed inset-0 flex items-center justify-center bg-brand-blue"
      style={{
        backgroundImage: `radial-gradient(ellipse at 20% 50%, rgba(255,255,255,0.08) 0%, transparent 60%),
                          radial-gradient(ellipse at 80% 20%, rgba(251,191,36,0.12) 0%, transparent 50%)`,
      }}
    >
      {/* Decorative circles */}
      <div className="absolute top-[-80px] left-[-80px] w-80 h-80 rounded-full bg-white/5 pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[-60px] w-96 h-96 rounded-full bg-brand-gold/10 pointer-events-none" />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white p-3 rounded-3xl shadow-2xl mb-4 border-4 border-white/20">
            <img src={logo} alt="MESSOB" className="h-16 w-16 object-contain rounded-2xl" />
          </div>
          <h1 className="text-white font-black text-2xl tracking-tight">MESSOB-FMS</h1>
          <p className="text-white/60 text-sm mt-1">Fleet Management System</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-black text-gray-900">Welcome back</h2>
            <p className="text-gray-500 mt-1 text-sm">Sign in to your MESSOB account</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Username */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-bold text-gray-700">
                Username or Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="text"
                  placeholder="admin"
                  autoComplete="username"
                  {...register("email")}
                  className={cn(
                    "pl-10 h-12 border-2 rounded-xl text-sm transition-all bg-gray-50 focus:bg-white",
                    errors.email ? "border-red-400" : "border-gray-200 focus:border-brand-blue"
                  )}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-bold text-gray-700">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register("password")}
                  className={cn(
                    "pl-10 pr-10 h-12 border-2 rounded-xl text-sm transition-all bg-gray-50 focus:bg-white",
                    errors.password ? "border-red-400" : "border-gray-200 focus:border-brand-blue"
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
                <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.password.message}
                </p>
              )}
            </div>

            {/* API Error */}
            {apiError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 font-medium flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {apiError}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-brand-blue hover:bg-blue-800 text-white font-black rounded-xl text-sm shadow-lg transition-all active:scale-[0.98]"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : "Sign In"}
            </Button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Use your Odoo credentials (e.g. username: <strong>admin</strong>)
          </p>
        </div>

        <p className="text-center text-xs text-white/30 mt-6">
          &copy; {new Date().getFullYear()} MESSOB Center Logistics
        </p>
      </div>
    </div>
  );
}

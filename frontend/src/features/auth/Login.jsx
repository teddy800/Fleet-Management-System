import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/useUserStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock, Mail, Car, MapPin, Gauge, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

const loginSchema = z.object({
  email: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
});

const FEATURES = [
  { icon: Car, label: "Fleet Management", desc: "Track and manage your entire vehicle fleet" },
  { icon: MapPin, label: "Real-Time GPS", desc: "Live vehicle tracking and route monitoring" },
  { icon: Gauge, label: "Analytics", desc: "KPIs, fuel efficiency, and cost analysis" },
  { icon: Users, label: "Driver Management", desc: "Assignments, performance, and scheduling" },
];

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
    <div className="min-h-screen flex bg-white">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-brand-blue flex-col justify-between p-10 relative overflow-hidden min-h-screen">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-white" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-brand-gold" />
          <div className="absolute top-1/2 left-1/3 w-32 h-32 rounded-full bg-white" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="bg-white p-2 rounded-2xl shadow-lg">
              <img src={logo} alt="MESSOB" className="h-10 w-10 object-contain rounded-xl" />
            </div>
            <div>
              <h1 className="text-white font-black text-xl tracking-tight">MESSOB-FMS</h1>
              <p className="text-white/60 text-xs">Fleet Management System</p>
            </div>
          </div>

          <h2 className="text-white font-black text-4xl leading-tight mb-4">
            Manage your fleet<br />
            <span className="text-brand-gold">smarter, faster.</span>
          </h2>
          <p className="text-white/70 text-base leading-relaxed max-w-sm">
            A complete fleet management solution for MESSOB — from trip requests to real-time GPS tracking.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-4">
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
              <div className="w-8 h-8 rounded-xl bg-brand-gold/20 flex items-center justify-center mb-2">
                <Icon className="h-4 w-4 text-brand-gold" />
              </div>
              <p className="text-white font-bold text-sm">{label}</p>
              <p className="text-white/50 text-xs mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white min-h-screen">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="bg-brand-blue p-2 rounded-2xl">
              <img src={logo} alt="MESSOB" className="h-8 w-8 object-contain rounded-xl" />
            </div>
            <div>
              <h1 className="text-brand-blue font-black text-lg">MESSOB-FMS</h1>
              <p className="text-gray-400 text-xs">Fleet Management System</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-black text-gray-900">Welcome back</h2>
            <p className="text-gray-500 mt-1.5 text-sm">Sign in to your MESSOB account to continue</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email/Username */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-bold text-gray-700">
                Email or Username
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="text"
                  placeholder="admin or name@messob.et"
                  {...register("email")}
                  className={cn(
                    "pl-10 h-12 border-2 rounded-xl text-sm transition-all bg-gray-50 focus:bg-white",
                    errors.email ? "border-red-400" : "border-gray-200 focus:border-brand-blue"
                  )}
                />
              </div>
              {errors.email && <p className="text-xs text-red-500 font-medium">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-bold text-gray-700">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  {...register("password")}
                  className={cn(
                    "pl-10 pr-10 h-12 border-2 rounded-xl text-sm transition-all bg-gray-50 focus:bg-white",
                    errors.password ? "border-red-400" : "border-gray-200 focus:border-brand-blue"
                  )}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500 font-medium">{errors.password.message}</p>}
            </div>

            {/* API Error */}
            {apiError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 font-medium">
                {apiError}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-brand-blue hover:bg-blue-800 text-white font-bold rounded-xl text-sm shadow-lg transition-all active:scale-[0.98] mt-2"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : "Sign In →"}
            </Button>
          </form>

          {/* Divider with hint */}
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              Use your Odoo admin credentials to sign in
            </p>
          </div>

          <p className="text-center text-xs text-gray-300 mt-4">
            &copy; {new Date().getFullYear()} MESSOB Center Logistics
          </p>
        </div>
      </div>
    </div>
  );
}

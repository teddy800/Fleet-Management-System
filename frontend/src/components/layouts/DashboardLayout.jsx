import { useState, useEffect } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { Menu, Bell, ChevronRight, Home } from "lucide-react";
import Sidebar from "../shared/Sidebar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { useUserStore } from "@/store/useUserStore";
import { cn } from "@/lib/utils";

const BREADCRUMBS = {
  "/dashboard":          ["Dashboard"],
  "/requests/new":       ["Requests", "New Request"],
  "/my-requests":        ["Requests", "My Requests"],
  "/dispatch/approvals": ["Dispatch", "Approval Queue"],
  "/dispatch/calendar":  ["Dispatch", "Fleet Calendar"],
  "/fleet":              ["Fleet", "Manage Fleet"],
  "/tracking":           ["Fleet", "GPS Tracking"],
  "/drivers":            ["Fleet", "Drivers"],
  "/fuel-log":           ["Fleet", "Fuel Logs"],
  "/maintenance":        ["Fleet", "Maintenance"],
  "/alerts":             ["Fleet", "Alerts"],
  "/analytics":          ["Reports", "Analytics"],
  "/inventory":          ["Admin", "Parts & Inventory"],
  "/hr-sync":            ["Admin", "HR Sync"],
  "/users":              ["Admin", "User Management"],
  "/profile":            ["Account", "Profile"],
};

export default function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const [pageKey, setPageKey] = useState(0);
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const user = useUserStore((s) => s.user);
  const location = useLocation();

  // Trigger page transition animation on route change
  useEffect(() => {
    setPageKey(k => k + 1);
  }, [location.pathname]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const crumbs = BREADCRUMBS[location.pathname] || ["Dashboard"];

  return (
    <div className="flex h-screen bg-gray-50/80 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex h-full shrink-0">
        <Sidebar />
      </aside>

      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* Glassmorphism Header */}
        <header className="glass border-b border-white/60 px-4 md:px-6 py-3 flex items-center justify-between z-20 shadow-sm sticky top-0">
          <div className="flex items-center gap-3">
            {/* Mobile menu trigger */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden hover:bg-gray-100 rounded-xl">
                  <Menu className="h-5 w-5 text-gray-600" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 bg-brand-blue border-none">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <Sidebar setOpen={setOpen} />
              </SheetContent>
            </Sheet>

            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-sm">
              <Home className="h-3.5 w-3.5 text-gray-400" />
              {crumbs.map((crumb, i) => (
                <span key={crumb} className="flex items-center gap-1.5">
                  <ChevronRight className="h-3 w-3 text-gray-300" />
                  <span className={i === crumbs.length - 1
                    ? "font-black text-brand-blue"
                    : "text-gray-400 text-xs"}>
                    {crumb}
                  </span>
                </span>
              ))}
            </nav>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Notification bell */}
            <button className="relative p-2 rounded-xl hover:bg-gray-100/80 transition-colors group">
              <Bell className="h-5 w-5 text-gray-500 group-hover:text-brand-blue transition-colors" />
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-gray-200" />

            {/* User avatar */}
            <div className="flex items-center gap-2.5 pl-1">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shadow-md ring-2 ring-white",
                user?.role === "Admin"      && "bg-amber-500",
                user?.role === "Dispatcher" && "bg-blue-600",
                user?.role === "Staff"      && "bg-green-600",
                user?.role === "Driver"     && "bg-purple-600",
                user?.role === "Mechanic"   && "bg-rose-600",
                !user?.role                 && "gradient-brand"
              )}>
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div className="hidden md:block">
                <p className="text-xs font-black text-gray-800 leading-none">{user?.name || "User"}</p>
                <p className="text-[10px] text-gray-400 capitalize mt-0.5">{user?.role || "Staff"}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content with page transition */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin">
          <div key={pageKey} className="max-w-7xl mx-auto page-enter">
            <Outlet />
          </div>
        </main>
      </div>

      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}

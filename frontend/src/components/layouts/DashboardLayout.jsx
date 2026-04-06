import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import Sidebar from "../shared/Sidebar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner"; // For the "Check" notifications

export default function DashboardLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* --- DESKTOP SIDEBAR --- */}
      {/* 'hidden lg:flex' ensures the sidebar is permanent on desktop (1024px+) */}
      <aside className="hidden lg:flex h-full shrink-0">
        <Sidebar />
      </aside>

      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* --- MOBILE HEADER --- */}
        {/* Only visible on screens smaller than 1024px (lg) */}
        <header className="lg:hidden bg-brand-blue p-4 flex items-center justify-between text-white shadow-md z-10">
          <span className="font-bold text-lg tracking-tight">MESSOB-FMS</span>
          
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:bg-white/10">
                <Menu className="h-6 w-6 text-white" />
              </Button>
            </SheetTrigger>
            
            <SheetContent side="left" className="p-0 w-64 bg-brand-blue border-none">
              {/* Accessibility Requirement: Title for Screen Readers */}
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              
              {/* We pass setOpen so the Sidebar can close the drawer when a link is clicked */}
              <Sidebar setOpen={setOpen} />
            </SheetContent>
          </Sheet>
        </header>

        {/* --- MAIN CONTENT AREA --- */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          <div className="max-w-7xl mx-auto">
            {/* This is where your Dashboard, Request Wizard, etc. will render */}
            <Outlet />
          </div>
        </main>
      </div>

      {/* --- GLOBAL NOTIFICATIONS --- */}
      {/* This allows toast.success() to work throughout the app */}
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}
import { useUserStore } from "@/store/useUserStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail, Shield, Building, MapPin, Edit3, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const BG_URL = "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070&auto=format&fit=crop";

export default function Profile() {
  const user = useUserStore((state) => state.user);

  if (!user) return <div className="p-8 text-center font-bold">Loading User...</div>;

  const roleLabels = {
    Admin: "Fleet Manager",
    Dispatcher: "Fleet Dispatcher",
    Staff: "Fleet Staff",
    Driver: "Driver",
  };

  return (
    <div className="relative -m-4 md:-m-8 min-h-screen">
      <div 
        className="absolute inset-0 z-0 opacity-20 grayscale-50"
        style={{ 
          backgroundImage: `url(${BG_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      
      <div className="relative z-10 p-4 md:p-8 max-w-4xl mx-auto space-y-6 pt-12">
        
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-4xl font-black text-brand-blue drop-shadow-sm">My Profile</h1>
            <p className="text-gray-600 font-medium">Manage your MESSOB-FMS identity</p>
          </div>
          <Button
            className="bg-brand-blue hover:bg-blue-900 gap-2 rounded-xl"
            onClick={() => toast.info("Profile editing is managed through Odoo. Go to Settings → Users to update your details.")}
          >
            <Edit3 className="h-4 w-4" /> Edit Profile
          </Button>
        </div>

        <Card className="border-none shadow-2xl bg-white/90 backdrop-blur-md overflow-hidden rounded-3xl">
          <CardHeader className="bg-brand-blue text-white p-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6">
               <span className="bg-brand-gold text-brand-blue px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                {user.role} Verified
              </span>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="h-32 w-32 rounded-3xl bg-brand-gold flex items-center justify-center border-4 border-white/30 shadow-2xl rotate-3">
                <User className="h-16 w-16 text-brand-blue -rotate-3" />
              </div>
              <div className="text-center md:text-left">
                <CardTitle className="text-3xl font-black">{user.name}</CardTitle>
                <div className="flex items-center gap-2 text-blue-100 mt-2 font-medium">
                  <Mail className="h-4 w-4" /> {user.email || "—"}
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-10 grid gap-10 md:grid-cols-2">
            <div className="space-y-6">
              <h3 className="font-black text-brand-blue uppercase text-xs tracking-widest border-b pb-2">Professional Identity</h3>
              <div className="flex items-center gap-4 group">
                <div className="p-3 bg-gray-100 rounded-2xl group-hover:bg-brand-gold/20 transition-colors">
                  <Shield className="h-6 w-6 text-brand-blue" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase">System Access</p>
                  <p className="font-bold text-gray-800">{user.role} Permissions</p>
                </div>
              </div>

              <div className="flex items-center gap-4 group">
                <div className="p-3 bg-gray-100 rounded-2xl group-hover:bg-brand-gold/20 transition-colors">
                  <Building className="h-6 w-6 text-brand-blue" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase">Role</p>
                  <p className="font-bold text-gray-800">{roleLabels[user.role] || user.role}</p>
                </div>
              </div>

              {user.employee_id && (
                <div className="flex items-center gap-4 group">
                  <div className="p-3 bg-gray-100 rounded-2xl group-hover:bg-brand-gold/20 transition-colors">
                    <Hash className="h-6 w-6 text-brand-blue" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase">Employee ID</p>
                    <p className="font-bold text-gray-800">#{user.employee_id}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <h3 className="font-black text-brand-blue uppercase text-xs tracking-widest border-b pb-2">Account Info</h3>
              <div className="flex items-center gap-4 group">
                <div className="p-3 bg-gray-100 rounded-2xl group-hover:bg-brand-gold/20 transition-colors">
                  <MapPin className="h-6 w-6 text-brand-blue" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase">Organization</p>
                  <p className="font-bold text-gray-800">MESSOB Fleet Management</p>
                </div>
              </div>

              <div className="flex items-center gap-4 group">
                <div className="p-3 bg-gray-100 rounded-2xl group-hover:bg-brand-gold/20 transition-colors">
                  <User className="h-6 w-6 text-brand-blue" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase">Driver Status</p>
                  <p className="font-bold text-gray-800">{user.is_driver ? "Registered Driver" : "Non-Driver"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
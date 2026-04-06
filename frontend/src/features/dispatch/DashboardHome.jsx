import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, Clock, CheckCircle, AlertCircle } from "lucide-react";

export default function DashboardHome() {
  // In a real app, these numbers come from your API
  const stats = [
    { title: "Pending Requests", value: "12", icon: Clock, color: "text-brand-gold" },
    { title: "Active Trips", value: "5", icon: Car, color: "text-brand-blue" },
    { title: "Completed Today", value: "8", icon: CheckCircle, color: "text-green-600" },
    { title: "Maintenance Due", value: "2", icon: AlertCircle, color: "text-red-600" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-brand-blue">System Overview</h1>
      
      {/* Stat Cards Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-b-4 border-b-brand-blue shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Workflow Visualization Area */}
      <div className="grid gap-4 md:grid-cols-7">
         <Card className="md:col-span-4 p-6">
            <h3 className="font-bold mb-4">Recent Activity Log</h3>
            {/* List of recent status changes goes here */}
         </Card>
         <Card className="md:col-span-3 p-6 bg-brand-blue text-white">
            <h3 className="font-bold mb-2 text-brand-gold">Quick Actions</h3>
            <p className="text-sm opacity-80 mb-4">Commonly used tools for your role.</p>
            <button className="w-full bg-white text-brand-blue py-2 rounded-lg font-bold">
               Generate Weekly Report
            </button>
         </Card>
      </div>
    </div>
  );
}
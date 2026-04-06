import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, Clock, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { analyticsApi } from "@/lib/api";
import { useUserStore } from "@/store/useUserStore";

export default function DashboardHome() {
  const user = useUserStore((s) => s.user);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [staleAt, setStaleAt] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await analyticsApi.dashboard();
      setData(res.data);
      setStaleAt(null);
      setError(null);
    } catch (err) {
      setError(err.message);
      if (data) setStaleAt(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 60000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  // Build stat cards from real API data or fallback to zeros
  const stats = [
    {
      title: "Pending Requests",
      value: data?.trip_statistics?.pending_requests ?? data?.pending_requests ?? "—",
      icon: Clock,
      color: "text-brand-gold",
    },
    {
      title: "Active Trips",
      value: data?.trip_statistics?.active_trips ?? data?.active_trips ?? "—",
      icon: Car,
      color: "text-brand-blue",
    },
    {
      title: "Completed Today",
      value: data?.trip_statistics?.completed_today ?? data?.completed_today ?? "—",
      icon: CheckCircle,
      color: "text-green-600",
    },
    {
      title: "Maintenance Due",
      value: data?.fleet_overview?.maintenance_due ?? data?.maintenance_due ?? "—",
      icon: AlertCircle,
      color: "text-red-600",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-brand-blue">
          {user?.role === "Admin" || user?.role === "Dispatcher"
            ? "System Overview"
            : `Welcome, ${user?.name}`}
        </h1>
        <button
          onClick={fetchDashboard}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-brand-blue transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stale data warning */}
      {staleAt && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-2 rounded-lg">
          Could not refresh data. Showing last loaded at {staleAt}.
        </div>
      )}

      {/* Error banner (only when no data at all) */}
      {error && !data && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-b-4 border-b-brand-blue shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading && !data ? (
                  <span className="inline-block w-8 h-6 bg-gray-200 animate-pulse rounded" />
                ) : (
                  stat.value
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fleet Overview + Quick Actions */}
      <div className="grid gap-4 md:grid-cols-7">
        <Card className="md:col-span-4 p-6">
          <h3 className="font-bold mb-4 text-brand-blue">Fleet Status</h3>
          {loading && !data ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-5 bg-gray-100 animate-pulse rounded" />
              ))}
            </div>
          ) : data ? (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">Total Vehicles</span>
                <span className="font-bold">{data.fleet_overview?.total_vehicles ?? "—"}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">Available</span>
                <span className="font-bold text-green-600">{data.fleet_overview?.available_vehicles ?? "—"}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">In Use</span>
                <span className="font-bold text-brand-blue">{data.fleet_overview?.in_use_vehicles ?? "—"}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">Utilization</span>
                <span className="font-bold">{data.fleet_overview?.utilization_rate?.toFixed(1) ?? "—"}%</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">Fuel Cost (Month)</span>
                <span className="font-bold">{data.fuel_analytics?.monthly_cost?.toFixed(2) ?? "—"} ETB</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">Avg Efficiency</span>
                <span className="font-bold">{data.fuel_analytics?.average_efficiency?.toFixed(2) ?? "—"} KM/L</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No data available</p>
          )}
        </Card>

        <Card className="md:col-span-3 p-6 bg-brand-blue text-white">
          <h3 className="font-bold mb-2 text-brand-gold">Quick Actions</h3>
          <p className="text-sm opacity-80 mb-4">Commonly used tools for your role.</p>
          <div className="space-y-2">
            {(user?.role === "Admin" || user?.role === "Dispatcher") && (
              <a
                href="/dispatch/approvals"
                className="block w-full bg-white text-brand-blue py-2 rounded-lg font-bold text-center text-sm hover:bg-brand-gold transition-colors"
              >
                View Approval Queue
              </a>
            )}
            {(user?.role === "Staff" || user?.role === "Admin") && (
              <a
                href="/requests/new"
                className="block w-full bg-brand-gold text-brand-blue py-2 rounded-lg font-bold text-center text-sm hover:bg-yellow-400 transition-colors"
              >
                New Trip Request
              </a>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

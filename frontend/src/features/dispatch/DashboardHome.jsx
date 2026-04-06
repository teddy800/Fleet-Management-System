import { useEffect, useState, useCallback } from "react";
import { analyticsApi } from "@/lib/api";
import { useUserStore } from "@/store/useUserStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Car, Clock, CheckCircle2, AlertCircle, TrendingUp, TrendingDown,
  Fuel, Wrench, Users, Activity, RefreshCw, Bell, Target, Zap,
} from "lucide-react";
import { Link } from "react-router-dom";

function StatCard({ title, value, subtitle, icon: Icon, color, trend, trendLabel, loading }) {
  return (
    <Card className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow">
      <div className={`absolute inset-0 opacity-5 ${color}`} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">{title}</p>
            <p className="text-3xl font-black text-gray-800 leading-none">
              {loading ? <span className="inline-block w-12 h-8 bg-gray-100 animate-pulse rounded" /> : value ?? "—"}
            </p>
            {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-2xl ${color} bg-opacity-10`}>
            <Icon className={`h-6 w-6 ${color.replace("bg-", "text-")}`} />
          </div>
        </div>
        {trend !== undefined && !loading && (
          <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100">
            {trend >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
            )}
            <span className={`text-xs font-bold ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
              {Math.abs(trend).toFixed(1)}%
            </span>
            <span className="text-xs text-gray-400">{trendLabel}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KpiBar({ label, value, max = 100, color = "bg-brand-blue" }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-bold">
        <span className="text-gray-600">{label}</span>
        <span className="text-gray-800">{value?.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function AlertItem({ type, message, severity }) {
  const colors = { critical: "bg-red-50 border-red-200 text-red-700", warning: "bg-yellow-50 border-yellow-200 text-yellow-700", info: "bg-blue-50 border-blue-200 text-blue-700" };
  return (
    <div className={`flex items-start gap-2 p-3 rounded-lg border text-xs font-medium ${colors[severity] || colors.info}`}>
      <Bell className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export default function DashboardHome() {
  const user = useUserStore((s) => s.user);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await analyticsApi.dashboard();
      setData(res.data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 60000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const fleet = data?.fleet_overview;
  const trips = data?.trip_statistics;
  const fuel = data?.fuel_analytics;
  const costs = data?.cost_analysis;
  const kpis = data?.kpis;
  const drivers = data?.driver_performance;
  const alerts = data?.alerts_summary;
  const predictive = data?.predictive_insights;

  const isAdmin = user?.role === "Admin" || user?.role === "Dispatcher";

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-brand-blue">
            {isAdmin ? "Fleet Command Center" : `Welcome back, ${user?.name?.split(" ")[0]}`}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : "Loading live data..."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {alerts?.critical_alerts > 0 && (
            <Badge className="bg-red-600 text-white gap-1 px-3 py-1">
              <Bell className="h-3 w-3" /> {alerts.critical_alerts} Critical
            </Badge>
          )}
          <button
            onClick={fetchDashboard}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-brand-blue bg-white border rounded-xl px-3 py-2 shadow-sm transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && !data && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          {error} — Showing cached data if available.
        </div>
      )}

      {/* Primary KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Fleet" value={fleet?.total_vehicles} subtitle={`${fleet?.available_vehicles ?? "—"} available`} icon={Car} color="bg-brand-blue" loading={loading} />
        <StatCard title="Active Trips" value={fleet?.in_use_vehicles} subtitle="vehicles in use" icon={Activity} color="bg-green-500" loading={loading} />
        <StatCard title="Pending Requests" value={trips?.total_requests} subtitle={`${trips?.approval_rate?.toFixed(0) ?? "—"}% approval rate`} icon={Clock} color="bg-brand-gold" loading={loading} />
        <StatCard title="Maintenance Due" value={fleet?.maintenance_vehicles} subtitle="vehicles need service" icon={Wrench} color="bg-red-500" loading={loading} />
      </div>

      {/* Secondary KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Fuel Cost (Month)"
          value={fuel?.monthly_consumption ? `${costs?.fuel_costs?.current_month?.toFixed(0)} ETB` : "—"}
          subtitle={`vs ${costs?.fuel_costs?.last_month?.toFixed(0) ?? "—"} ETB last month`}
          icon={Fuel}
          color="bg-orange-500"
          trend={costs?.fuel_costs?.month_over_month_change}
          trendLabel="vs last month"
          loading={loading}
        />
        <StatCard
          title="Avg Efficiency"
          value={fuel?.average_efficiency ? `${fuel.average_efficiency.toFixed(2)} KM/L` : "—"}
          subtitle="fleet average"
          icon={Zap}
          color="bg-teal-500"
          loading={loading}
        />
        <StatCard
          title="Completed Trips"
          value={trips?.completed_trips}
          subtitle="this month"
          icon={CheckCircle2}
          color="bg-purple-500"
          loading={loading}
        />
        <StatCard
          title="Active Drivers"
          value={drivers?.active_drivers}
          subtitle={`of ${drivers?.total_drivers ?? "—"} total`}
          icon={Users}
          color="bg-indigo-500"
          loading={loading}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Fleet Utilization */}
        <Card className="lg:col-span-2 border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black text-brand-blue uppercase tracking-widest flex items-center gap-2">
              <Target className="h-4 w-4" /> Fleet Performance KPIs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-6 bg-gray-100 animate-pulse rounded" />)}</div>
            ) : kpis ? (
              <>
                <KpiBar label="Fleet Availability" value={kpis.fleet_availability} color="bg-green-500" />
                <KpiBar label="Request Fulfillment Rate" value={kpis.request_fulfillment_rate} color="bg-brand-blue" />
                <KpiBar label="Average Utilization" value={kpis.average_utilization} color="bg-purple-500" />
                <KpiBar label="Maintenance Compliance" value={kpis.maintenance_compliance} color="bg-teal-500" />
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 uppercase font-bold">Cost / KM</p>
                    <p className="text-xl font-black text-brand-blue">{kpis.cost_per_kilometer?.toFixed(2)} ETB</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 uppercase font-bold">Fleet Value</p>
                    <p className="text-xl font-black text-brand-blue">{kpis.total_fleet_value?.toLocaleString()} ETB</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No KPI data available</p>
            )}
          </CardContent>
        </Card>

        {/* Alerts & Quick Actions */}
        <div className="space-y-4">
          {/* Alerts */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-black text-brand-blue uppercase tracking-widest flex items-center gap-2">
                <Bell className="h-4 w-4" /> Active Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? (
                <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />)}</div>
              ) : alerts ? (
                <>
                  {alerts.critical_alerts > 0 && (
                    <AlertItem severity="critical" message={`${alerts.critical_alerts} critical alert${alerts.critical_alerts > 1 ? "s" : ""} require immediate attention`} />
                  )}
                  {alerts.unacknowledged_alerts > 0 && (
                    <AlertItem severity="warning" message={`${alerts.unacknowledged_alerts} unacknowledged alert${alerts.unacknowledged_alerts > 1 ? "s" : ""}`} />
                  )}
                  {fleet?.maintenance_vehicles > 0 && (
                    <AlertItem severity="warning" message={`${fleet.maintenance_vehicles} vehicle${fleet.maintenance_vehicles > 1 ? "s" : ""} under maintenance`} />
                  )}
                  {alerts.total_alerts === 0 && (
                    <div className="text-center py-3 text-sm text-green-600 font-bold">
                      <CheckCircle2 className="h-5 w-5 mx-auto mb-1" /> All clear
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-400 text-center py-2">No alert data</p>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-0 shadow-md bg-brand-blue text-white">
            <CardContent className="p-5 space-y-2">
              <p className="text-xs font-black text-brand-gold uppercase tracking-widest mb-3">Quick Actions</p>
              {isAdmin && (
                <Link to="/dispatch/approvals" className="flex items-center gap-2 w-full bg-white/10 hover:bg-white/20 text-white py-2.5 px-4 rounded-xl text-sm font-bold transition-colors">
                  <CheckCircle2 className="h-4 w-4 text-brand-gold" />
                  Review Pending Requests
                  {trips?.total_requests > 0 && (
                    <Badge className="ml-auto bg-brand-gold text-brand-blue text-xs px-2">{trips.total_requests}</Badge>
                  )}
                </Link>
              )}
              {isAdmin && (
                <Link to="/fleet" className="flex items-center gap-2 w-full bg-white/10 hover:bg-white/20 text-white py-2.5 px-4 rounded-xl text-sm font-bold transition-colors">
                  <Car className="h-4 w-4 text-brand-gold" /> Manage Fleet
                </Link>
              )}
              <Link to="/requests/new" className="flex items-center gap-2 w-full bg-brand-gold hover:bg-yellow-400 text-brand-blue py-2.5 px-4 rounded-xl text-sm font-bold transition-colors">
                <Clock className="h-4 w-4" /> New Trip Request
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cost Analysis + Driver Performance */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Cost Breakdown */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black text-brand-blue uppercase tracking-widest">Cost Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 animate-pulse rounded" />)}</div>
            ) : costs ? (
              <div className="space-y-3">
                {[
                  { label: "Fuel — This Month", value: costs.fuel_costs?.current_month, change: costs.fuel_costs?.month_over_month_change },
                  { label: "Maintenance — This Month", value: costs.maintenance_costs?.current_month, change: costs.maintenance_costs?.month_over_month_change },
                  { label: "Total Fleet Cost (YTD)", value: costs.total_fleet_cost, change: null },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-sm text-gray-600 font-medium">{item.label}</span>
                    <div className="text-right">
                      <span className="text-sm font-black text-brand-blue">{item.value?.toFixed(2)} ETB</span>
                      {item.change !== null && item.change !== undefined && (
                        <div className={`text-xs font-bold ${item.change >= 0 ? "text-red-500" : "text-green-500"}`}>
                          {item.change >= 0 ? "▲" : "▼"} {Math.abs(item.change).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No cost data available</p>
            )}
          </CardContent>
        </Card>

        {/* Top Drivers */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black text-brand-blue uppercase tracking-widest flex items-center gap-2">
              <Users className="h-4 w-4" /> Top Performing Drivers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 animate-pulse rounded" />)}</div>
            ) : drivers?.top_performers?.length > 0 ? (
              <div className="space-y-2">
                {drivers.top_performers.slice(0, 5).map((driver, i) => (
                  <div key={driver.driver_id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${i === 0 ? "bg-brand-gold text-brand-blue" : "bg-gray-100 text-gray-600"}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{driver.driver_name}</p>
                      <p className="text-xs text-gray-400">{driver.total_trips} trips · {driver.total_distance?.toFixed(0)} km</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-brand-blue">{driver.on_time_percentage?.toFixed(0)}%</p>
                      <p className="text-xs text-gray-400">on-time</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No driver data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Predictive Insights */}
      {predictive?.maintenance_predictions?.length > 0 && (
        <Card className="border-0 shadow-md border-l-4 border-l-red-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black text-red-600 uppercase tracking-widest flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Predictive Maintenance Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {predictive.maintenance_predictions.slice(0, 6).map((p) => (
                <div key={p.vehicle_id} className={`p-3 rounded-xl border text-sm ${p.urgency === "high" ? "bg-red-50 border-red-200" : p.urgency === "medium" ? "bg-yellow-50 border-yellow-200" : "bg-blue-50 border-blue-200"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold text-gray-800 truncate">{p.vehicle_name}</p>
                    <Badge className={`text-xs ${p.urgency === "high" ? "bg-red-600" : p.urgency === "medium" ? "bg-yellow-500 text-black" : "bg-blue-600"}`}>
                      {p.urgency}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500">Due: {p.predicted_maintenance_date}</p>
                  <p className="text-xs text-gray-500">Risk score: {p.risk_score?.toFixed(0)}</p>
                  {p.recommended_actions?.length > 0 && (
                    <p className="text-xs text-gray-600 mt-1 font-medium">{p.recommended_actions[0]}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

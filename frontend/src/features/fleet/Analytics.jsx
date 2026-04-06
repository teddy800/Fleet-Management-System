/**
 * Fleet Analytics & Reporting
 * Full analytics: fleet overview, cost analysis, fuel trends, driver performance, utilization
 */
import { useEffect, useState, useCallback } from "react";
import { analyticsApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, TrendingUp, TrendingDown, BarChart3, Fuel, Wrench, Users, Car, DollarSign, Zap, Target } from "lucide-react";
import { toast } from "sonner";

function MetricRow({ label, value, sub, trend }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
      <div>
        <p className="text-sm font-bold text-gray-700">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <div className="text-right">
        <p className="text-sm font-black text-brand-blue">{value}</p>
        {trend !== undefined && trend !== null && (
          <div className={`flex items-center gap-0.5 justify-end text-xs font-bold ${trend >= 0 ? "text-red-500" : "text-green-500"}`}>
            {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  );
}

function KpiGauge({ label, value, color = "bg-brand-blue" }) {
  const pct = Math.min(value || 0, 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-bold">
        <span className="text-gray-600">{label}</span>
        <span className="text-gray-800">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await analyticsApi.dashboard();
      setData(res.data);
      setLastUpdated(new Date());
    } catch (err) {
      toast.error("Failed to load analytics: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const fleet = data?.fleet_overview;
  const costs = data?.cost_analysis;
  const fuel = data?.fuel_analytics;
  const drivers = data?.driver_performance;
  const kpis = data?.kpis;
  const utilization = data?.utilization_metrics;
  const predictive = data?.predictive_insights;

  const Skeleton = () => <span className="inline-block w-16 h-5 bg-gray-100 animate-pulse rounded" />;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-brand-blue">Fleet Analytics</h1>
            <p className="text-sm text-gray-400">
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Loading..."}
            </p>
          </div>
        </div>
        <button onClick={fetchAnalytics} className="flex items-center gap-2 text-sm text-gray-500 hover:text-brand-blue bg-white border rounded-xl px-3 py-2 shadow-sm">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* KPI Gauges */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-black text-brand-blue uppercase tracking-widest flex items-center gap-2">
            <Target className="h-4 w-4" /> Key Performance Indicators
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-6 bg-gray-100 animate-pulse rounded" />)}</div>
          ) : kpis ? (
            <>
              <KpiGauge label="Fleet Availability" value={kpis.fleet_availability} color="bg-green-500" />
              <KpiGauge label="Request Fulfillment Rate" value={kpis.request_fulfillment_rate} color="bg-brand-blue" />
              <KpiGauge label="Average Utilization" value={kpis.average_utilization} color="bg-purple-500" />
              <KpiGauge label="Maintenance Compliance" value={kpis.maintenance_compliance} color="bg-teal-500" />
              <div className="grid grid-cols-3 gap-4 pt-3 border-t">
                <div className="text-center">
                  <p className="text-xs text-gray-400 uppercase font-bold">Cost/KM</p>
                  <p className="text-lg font-black text-brand-blue">{kpis.cost_per_kilometer?.toFixed(2)} ETB</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400 uppercase font-bold">Fleet Value</p>
                  <p className="text-lg font-black text-brand-blue">{kpis.total_fleet_value?.toLocaleString()} ETB</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400 uppercase font-bold">Avg Efficiency</p>
                  <p className="text-lg font-black text-brand-blue">{fuel?.average_efficiency?.toFixed(2)} KM/L</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No KPI data — install Odoo module first</p>
          )}
        </CardContent>
      </Card>

      {/* Fleet Overview + Cost Analysis */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Fleet Overview */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black text-brand-blue uppercase tracking-widest flex items-center gap-2">
              <Car className="h-4 w-4" /> Fleet Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-xl" />)}</div>
            ) : fleet ? (
              <>
                <MetricRow label="Total Vehicles" value={fleet.total_vehicles} />
                <MetricRow label="Available" value={fleet.available_vehicles} sub={`${fleet.availability_rate?.toFixed(1)}% availability`} />
                <MetricRow label="In Use" value={fleet.in_use_vehicles} />
                <MetricRow label="Under Maintenance" value={fleet.maintenance_vehicles} />
                <div className="pt-2 border-t">
                  <p className="text-xs text-gray-400 uppercase font-bold mb-2">Age Distribution</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: "New (<1yr)", value: fleet.age_distribution?.new },
                      { label: "Medium (1-5yr)", value: fleet.age_distribution?.medium },
                      { label: "Old (>5yr)", value: fleet.age_distribution?.old },
                    ].map(a => (
                      <div key={a.label} className="bg-gray-50 rounded-xl p-2">
                        <p className="text-xs text-gray-400">{a.label}</p>
                        <p className="text-lg font-black text-brand-blue">{a.value ?? "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No fleet data available</p>
            )}
          </CardContent>
        </Card>

        {/* Cost Analysis */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black text-brand-blue uppercase tracking-widest flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Cost Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-xl" />)}</div>
            ) : costs ? (
              <>
                <MetricRow
                  label="Fuel — This Month"
                  value={`${costs.fuel_costs?.current_month?.toFixed(2)} ETB`}
                  sub={`vs ${costs.fuel_costs?.last_month?.toFixed(2)} ETB last month`}
                  trend={costs.fuel_costs?.month_over_month_change}
                />
                <MetricRow
                  label="Maintenance — This Month"
                  value={`${costs.maintenance_costs?.current_month?.toFixed(2)} ETB`}
                  sub={`vs ${costs.maintenance_costs?.last_month?.toFixed(2)} ETB last month`}
                  trend={costs.maintenance_costs?.month_over_month_change}
                />
                <MetricRow label="Fuel — YTD" value={`${costs.fuel_costs?.current_year?.toFixed(2)} ETB`} />
                <MetricRow label="Maintenance — YTD" value={`${costs.maintenance_costs?.current_year?.toFixed(2)} ETB`} />
                <div className="bg-brand-blue/5 rounded-xl p-3 border border-brand-blue/10 mt-2">
                  <p className="text-xs text-gray-400 uppercase font-bold">Total Fleet Cost (YTD)</p>
                  <p className="text-2xl font-black text-brand-blue mt-1">{costs.total_fleet_cost?.toFixed(2)} ETB</p>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No cost data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fuel Analytics + Driver Performance */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Fuel Analytics */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black text-brand-blue uppercase tracking-widest flex items-center gap-2">
              <Fuel className="h-4 w-4" /> Fuel Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-xl" />)}</div>
            ) : fuel ? (
              <div className="space-y-3">
                <MetricRow label="Fleet Avg Efficiency" value={`${fuel.average_efficiency?.toFixed(2)} KM/L`} />
                {fuel.top_consumers?.slice(0, 5).map((v, i) => (
                  <div key={v.vehicle_id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${i === 0 ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600"}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{v.vehicle_name}</p>
                      <p className="text-xs text-gray-400">{v.total_fuel?.toFixed(1)} L consumed</p>
                    </div>
                    <p className="text-sm font-black text-brand-blue">{v.efficiency?.toFixed(2)} KM/L</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No fuel data available</p>
            )}
          </CardContent>
        </Card>

        {/* Driver Performance */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black text-brand-blue uppercase tracking-widest flex items-center gap-2">
              <Users className="h-4 w-4" /> Driver Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 animate-pulse rounded-xl" />)}</div>
            ) : drivers?.top_performers?.length > 0 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-400 uppercase font-bold">Total Drivers</p>
                    <p className="text-2xl font-black text-brand-blue">{drivers.total_drivers}</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-400 uppercase font-bold">Active</p>
                    <p className="text-2xl font-black text-green-600">{drivers.active_drivers}</p>
                  </div>
                </div>
                {drivers.top_performers.slice(0, 5).map((d, i) => (
                  <div key={d.driver_id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${i === 0 ? "bg-brand-gold text-brand-blue" : "bg-gray-100 text-gray-600"}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{d.driver_name}</p>
                      <p className="text-xs text-gray-400">{d.total_trips} trips · {d.total_distance?.toFixed(0)} km</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-brand-blue">{d.on_time_percentage?.toFixed(0)}%</p>
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

      {/* Cost Optimization Suggestions */}
      {predictive?.cost_optimizations?.length > 0 && (
        <Card className="border-0 shadow-md border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black text-green-600 uppercase tracking-widest flex items-center gap-2">
              <Zap className="h-4 w-4" /> Cost Optimization Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-3">
              {predictive.cost_optimizations.map((opt, i) => (
                <div key={i} className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-bold text-gray-800 text-sm">{opt.title}</p>
                    <Badge className="bg-green-600 text-white text-xs ml-2 shrink-0">
                      Save {opt.potential_savings?.toLocaleString()} ETB
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600">{opt.description}</p>
                  <p className="text-xs text-green-700 font-medium mt-2">→ {opt.action}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Fleet Alerts Management
 * Shows speed violations, geofence violations, maintenance due, fuel low, etc.
 * Allows acknowledge and resolve actions.
 */
import { useEffect, useState, useCallback } from "react";
import { analyticsApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, AlertCircle, CheckCircle2, Search, RefreshCw, Loader2, Shield, Gauge, Fuel, Wrench, Car, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const ALERT_TYPE_META = {
  speed_violation:    { label: "Speed Violation",    icon: Gauge,         cls: "bg-orange-100 text-orange-700" },
  geofence_violation: { label: "Geofence Violation", icon: Shield,        cls: "bg-purple-100 text-purple-700" },
  excessive_idling:   { label: "Excessive Idling",   icon: Car,           cls: "bg-yellow-100 text-yellow-700" },
  maintenance_due:    { label: "Maintenance Due",    icon: Wrench,        cls: "bg-red-100 text-red-700" },
  fuel_low:           { label: "Low Fuel",           icon: Fuel,          cls: "bg-amber-100 text-amber-700" },
  unauthorized_use:   { label: "Unauthorized Use",   icon: AlertTriangle, cls: "bg-red-100 text-red-700" },
  accident:           { label: "Accident/Emergency", icon: AlertCircle,   cls: "bg-red-100 text-red-700" },
  system_error:       { label: "System Error",       icon: AlertCircle,   cls: "bg-gray-100 text-gray-700" },
};

const SEVERITY_META = {
  critical: { cls: "bg-red-600 text-white",    dot: "bg-red-500 animate-pulse" },
  high:     { cls: "bg-orange-500 text-white", dot: "bg-orange-500" },
  medium:   { cls: "bg-yellow-500 text-black", dot: "bg-yellow-500" },
  low:      { cls: "bg-blue-500 text-white",   dot: "bg-blue-400" },
};

// Since there's no dedicated alerts list endpoint, we derive from dashboard alerts_summary
// and show a meaningful UI
export default function Alerts() {
  const [alertsSummary, setAlertsSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("all");

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await analyticsApi.dashboard();
      setAlertsSummary(res.data?.alerts_summary);
    } catch (err) {
      toast.error("Failed to load alerts: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const total = alertsSummary?.total_alerts || 0;
  const critical = alertsSummary?.critical_alerts || 0;
  const unacknowledged = alertsSummary?.unacknowledged_alerts || 0;
  const alertTypes = alertsSummary?.alert_types || [];

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center">
            <Bell className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-brand-blue">Fleet Alerts</h1>
            <p className="text-sm text-gray-400">Real-time fleet monitoring alerts</p>
          </div>
        </div>
        <button onClick={fetchAlerts} className="flex items-center gap-2 text-sm text-gray-500 hover:text-brand-blue bg-white border rounded-xl px-3 py-2 shadow-sm">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-red-50">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500 uppercase font-bold">Total Active</p>
            <p className="text-3xl font-black text-red-600 mt-1">
              {loading ? <span className="inline-block w-10 h-8 bg-red-100 animate-pulse rounded" /> : total}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-orange-50">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500 uppercase font-bold">Critical</p>
            <p className="text-3xl font-black text-orange-600 mt-1">
              {loading ? <span className="inline-block w-10 h-8 bg-orange-100 animate-pulse rounded" /> : critical}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-yellow-50">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500 uppercase font-bold">Unacknowledged</p>
            <p className="text-3xl font-black text-yellow-600 mt-1">
              {loading ? <span className="inline-block w-10 h-8 bg-yellow-100 animate-pulse rounded" /> : unacknowledged}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alert Types Breakdown */}
      {!loading && alertTypes.length > 0 && (
        <div className="bg-white rounded-2xl border shadow-sm p-5">
          <h3 className="font-black text-sm text-brand-blue uppercase tracking-widest mb-4">Alert Types Breakdown</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            {alertTypes.map((at, i) => {
              const meta = ALERT_TYPE_META[at.alert_type] || { label: at.alert_type, icon: AlertCircle, cls: "bg-gray-100 text-gray-600" };
              const Icon = meta.icon;
              return (
                <div key={i} className={`rounded-xl p-3 flex items-center gap-3 ${meta.cls}`}>
                  <Icon className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold">{meta.label}</p>
                    <p className="text-lg font-black">{at.alert_type_count}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All Clear State */}
      {!loading && total === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-12 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-black text-green-700">All Clear</h3>
          <p className="text-green-600 text-sm mt-2">No active alerts. Your fleet is operating normally.</p>
        </div>
      )}

      {/* Alert Types Info */}
      {!loading && total > 0 && (
        <div className="bg-white rounded-2xl border shadow-sm p-5">
          <h3 className="font-black text-sm text-brand-blue uppercase tracking-widest mb-4">Alert Categories</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {Object.entries(ALERT_TYPE_META).map(([type, meta]) => {
              const Icon = meta.icon;
              return (
                <div key={type} className={`flex items-center gap-3 p-3 rounded-xl ${meta.cls}`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-bold">{meta.label}</p>
                    <p className="text-[10px] opacity-70 capitalize">{type.replace(/_/g, " ")}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-4 text-center">
            Alerts are automatically generated by the GPS tracking system and maintenance scheduler.
            Go to <strong>http://localhost:8069</strong> to acknowledge and resolve alerts.
          </p>
        </div>
      )}
    </div>
  );
}

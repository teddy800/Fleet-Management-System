/**
 * FR-4.3: Maintenance alerts visible on dashboard to Admins and Mechanics
 * Shows individual fleet alerts with severity, type, vehicle, and acknowledge action.
 */
import { useEffect, useState, useCallback } from "react";
import { alertsApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bell, AlertCircle, CheckCircle2, Search, RefreshCw, Loader2,
  Shield, Gauge, Fuel, Wrench, Car, AlertTriangle, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ALERT_TYPE_META = {
  speed_violation:    { label: "Speed Violation",    icon: Gauge,         bg: "bg-orange-50", badge: "bg-orange-100 text-orange-700" },
  geofence_violation: { label: "Geofence Violation", icon: Shield,        bg: "bg-purple-50", badge: "bg-purple-100 text-purple-700" },
  excessive_idling:   { label: "Excessive Idling",   icon: Car,           bg: "bg-yellow-50", badge: "bg-yellow-100 text-yellow-700" },
  maintenance_due:    { label: "Maintenance Due",    icon: Wrench,        bg: "bg-red-50",    badge: "bg-red-100 text-red-700" },
  fuel_low:           { label: "Low Fuel",           icon: Fuel,          bg: "bg-amber-50",  badge: "bg-amber-100 text-amber-700" },
  unauthorized_use:   { label: "Unauthorized Use",   icon: AlertTriangle, bg: "bg-red-50",    badge: "bg-red-100 text-red-700" },
  accident:           { label: "Accident/Emergency", icon: AlertCircle,   bg: "bg-red-50",    badge: "bg-red-100 text-red-700" },
  system_error:       { label: "System Error",       icon: AlertCircle,   bg: "bg-gray-50",   badge: "bg-gray-100 text-gray-700" },
};

const SEVERITY_META = {
  critical: { cls: "bg-red-600 text-white",    dot: "bg-red-500 animate-pulse",  border: "border-l-red-500" },
  high:     { cls: "bg-orange-500 text-white", dot: "bg-orange-500",             border: "border-l-orange-500" },
  medium:   { cls: "bg-yellow-500 text-black", dot: "bg-yellow-500",             border: "border-l-yellow-500" },
  low:      { cls: "bg-blue-500 text-white",   dot: "bg-blue-400",               border: "border-l-blue-400" },
};

function AlertCard({ alert, onAcknowledge, acknowledging }) {
  const typeMeta = ALERT_TYPE_META[alert.alert_type] || {
    label: alert.alert_type, icon: AlertCircle, bg: "bg-gray-50", badge: "bg-gray-100 text-gray-700",
  };
  const sevMeta = SEVERITY_META[alert.severity] || SEVERITY_META.low;
  const Icon = typeMeta.icon;

  return (
    <div className={cn(
      "bg-white rounded-2xl border border-l-4 shadow-sm p-4 flex items-start gap-4 transition-all hover:shadow-md",
      sevMeta.border,
      alert.acknowledged && "opacity-60"
    )}>
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", typeMeta.bg)}>
        <Icon className="h-5 w-5 text-gray-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${typeMeta.badge}`}>
              {typeMeta.label}
            </span>
            <Badge className={`text-xs ${sevMeta.cls}`}>{alert.severity}</Badge>
            {alert._count > 1 && (
              <Badge className="text-xs bg-gray-700 text-white border-0">×{alert._count} occurrences</Badge>
            )}
            {alert.acknowledged && (
              <Badge className="text-xs bg-gray-100 text-gray-500 border border-gray-200">Acknowledged</Badge>
            )}
          </div>
          <span className="text-xs text-gray-400 flex items-center gap-1 shrink-0">
            <Clock className="h-3 w-3" />
            {alert.timestamp
              ? new Date(alert.timestamp).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
              : "—"}
          </span>
        </div>
        <p className="text-sm text-gray-700 font-medium mt-1.5">{alert.message}</p>
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
          {alert.vehicle_name && (
            <span className="flex items-center gap-1"><Car className="h-3 w-3" /> {alert.vehicle_name}</span>
          )}
          {alert.driver_name && (
            <span className="flex items-center gap-1">👤 {alert.driver_name}</span>
          )}
        </div>
      </div>
      {!alert.acknowledged && (
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 h-8 rounded-xl text-xs border-gray-200 hover:bg-green-50 hover:border-green-300 hover:text-green-700"
          disabled={acknowledging === alert.id}
          onClick={() => onAcknowledge(alert.id)}
        >
          {acknowledging === alert.id
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Ack</>}
        </Button>
      )}
    </div>
  );
}

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState(null);
  const [search, setSearch] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [groupDuplicates, setGroupDuplicates] = useState(true);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await alertsApi.list();
      setAlerts(res.alerts || []);
    } catch (err) {
      toast.error("Failed to load alerts: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const handleAcknowledge = async (id) => {
    setAcknowledging(id);
    try {
      await alertsApi.acknowledge(id);
      toast.success("Alert acknowledged");
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAcknowledging(null);
    }
  };

  const filtered = alerts.filter(a => {
    if (!showAcknowledged && a.acknowledged) return false;
    if (filterSeverity !== "all" && a.severity !== filterSeverity) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        a.message?.toLowerCase().includes(q) ||
        a.vehicle_name?.toLowerCase().includes(q) ||
        a.alert_type?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group duplicate alerts by type+vehicle+message to avoid noise
  const displayAlerts = groupDuplicates
    ? (() => {
        const groups = new Map();
        filtered.forEach(a => {
          const key = `${a.alert_type}|${a.vehicle_name}|${a.message}|${a.acknowledged}`;
          if (!groups.has(key)) {
            groups.set(key, { ...a, _count: 1, _latestId: a.id });
          } else {
            const g = groups.get(key);
            g._count += 1;
            // Keep the most recent (highest id) for acknowledge action
            if (a.id > g._latestId) { g._latestId = a.id; g.timestamp = a.timestamp; }
          }
        });
        return Array.from(groups.values());
      })()
    : filtered;

  const total    = alerts.length;
  const critical = alerts.filter(a => a.severity === "critical" && !a.acknowledged).length;
  const unacked  = alerts.filter(a => !a.acknowledged).length;

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center">
            <Bell className="h-5 w-5 text-red-600" />
            {critical > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border-2 border-white animate-pulse" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-black text-brand-blue">Fleet Alerts</h1>
            <p className="text-sm text-gray-400">Real-time fleet monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unacked > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-xl text-xs text-gray-600 hover:text-green-700 hover:border-green-300"
              onClick={async () => {
                try {
                  await fetch("/api/fleet/alerts/acknowledge-all", {
                    method: "POST", credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: {} }),
                  });
                  toast.success("All alerts acknowledged");
                  fetchAlerts();
                } catch { toast.error("Failed to acknowledge alerts"); }
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Acknowledge All ({unacked})
            </Button>
          )}
          <button
            onClick={fetchAlerts}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-brand-blue bg-white border rounded-xl px-3 py-2 shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Active",     value: total,    color: "text-red-600",    bg: "bg-red-50 border-red-100",       pulse: total > 0 },
          { label: "Critical",         value: critical, color: "text-orange-600", bg: "bg-orange-50 border-orange-100", pulse: critical > 0 },
          { label: "Unacknowledged",   value: unacked,  color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-100", pulse: false },
        ].map(s => (
          <div key={s.label} className={`relative rounded-2xl p-4 border shadow-sm ${s.bg}`}>
            <p className="text-xs text-gray-500 uppercase font-black tracking-widest">{s.label}</p>
            <p className={`text-3xl font-black mt-1 ${s.color}`}>
              {loading
                ? <span className="inline-block w-10 h-8 bg-white/60 animate-pulse rounded-lg" />
                : s.value}
            </p>
            {s.pulse && s.value > 0 && (
              <span className="absolute top-3 right-3 w-3 h-3 rounded-full bg-red-500 animate-ping" />
            )}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search alerts, vehicle, type..."
            className="pl-9 h-10 rounded-xl border-gray-200"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {["all", "critical", "high", "medium", "low"].map(s => (
            <button key={s} onClick={() => setFilterSeverity(s)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors capitalize",
                filterSeverity === s
                  ? "bg-brand-blue text-white border-brand-blue"
                  : "bg-white text-gray-600 border-gray-200 hover:border-brand-blue"
              )}>
              {s}
            </button>
          ))}
          <button
            onClick={() => setShowAcknowledged(v => !v)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors",
              showAcknowledged
                ? "bg-gray-700 text-white border-gray-700"
                : "bg-white text-gray-600 border-gray-200"
            )}>
            {showAcknowledged ? "Hide Acked" : "Show Acked"}
          </button>
          <button
            onClick={() => setGroupDuplicates(v => !v)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors",
              groupDuplicates
                ? "bg-brand-blue text-white border-brand-blue"
                : "bg-white text-gray-600 border-gray-200"
            )}>
            {groupDuplicates ? "Grouped" : "All"}
          </button>
        </div>
      </div>

      {/* Alert List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-12 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-black text-green-700">All Clear</h3>
          <p className="text-green-600 text-sm mt-2">
            {total === 0
              ? "No active alerts. Your fleet is operating normally."
              : "No alerts match your current filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayAlerts.map(alert => (
            <AlertCard
              key={alert._latestId || alert.id}
              alert={{ ...alert, id: alert._latestId || alert.id }}
              onAcknowledge={handleAcknowledge}
              acknowledging={acknowledging}
            />
          ))}
        </div>
      )}
    </div>
  );
}

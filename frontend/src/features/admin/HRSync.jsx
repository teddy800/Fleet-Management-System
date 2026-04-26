/**
 * HR & Inventory Integration Status
 * Shows Messob HR sync config, employee stats, and manual sync trigger.
 * Backend: /api/fleet/hr/sync-status, /api/fleet/hr/sync
 */
import { useEffect, useState, useCallback } from "react";
import { adminApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Users, CheckCircle2, XCircle, Loader2, Database, Wifi, Key } from "lucide-react";
import { toast } from "sonner";

export default function HRSync() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.hrSyncStatus();
      setStatus(res);
    } catch (err) {
      toast.error("Failed to load sync status: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await adminApi.triggerHrSync();
      toast.success(res.message || "HR sync completed");
      fetchStatus();
    } catch (err) {
      toast.error("Sync failed: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const cfg   = status?.config || {};
  const stats = status?.stats  || {};

  const ConfigRow = ({ icon: Icon, label, configured }) => (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${configured ? "bg-green-100" : "bg-red-50"}`}>
          <Icon className={`h-4 w-4 ${configured ? "text-green-600" : "text-red-400"}`} />
        </div>
        <span className="text-sm font-semibold text-gray-700">{label}</span>
      </div>
      {configured
        ? <Badge className="bg-green-100 text-green-700 border-green-200 text-xs flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Configured</Badge>
        : <Badge className="bg-red-50 text-red-600 border-red-200 text-xs flex items-center gap-1"><XCircle className="h-3 w-3" />Not Set</Badge>
      }
    </div>
  );

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center">
            <Users className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-brand-blue">HR & Inventory Integration</h1>
            <p className="text-sm text-gray-400">Messob HR System sync status</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchStatus} className="p-2 rounded-xl border bg-white hover:bg-gray-50 shadow-sm">
            <RefreshCw className={`h-4 w-4 text-gray-500 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Button onClick={handleSync} disabled={syncing} className="rounded-xl gap-2 bg-brand-blue hover:bg-brand-blue/90">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync Now
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <Card className="border shadow-sm">
          <CardContent className="p-5">
            <h2 className="font-black text-sm uppercase text-gray-500 tracking-widest mb-3">System Parameters</h2>
            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />)}</div>
            ) : (
              <>
                <ConfigRow icon={Wifi}     label="HR Sync URL (mesob.hr_sync_url)"        configured={cfg.hr_sync_url_configured} />
                <ConfigRow icon={Key}      label="API Key (mesob.api_key)"                 configured={cfg.api_key_configured} />
                <ConfigRow icon={Database} label="GPS Gateway URL (mesob.gps_gateway_url)" configured={cfg.gps_gateway_url_configured} />
              </>
            )}
            <p className="text-xs text-gray-400 mt-4">
              Configure in Odoo → Settings → Technical → System Parameters
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-5">
            <h2 className="font-black text-sm uppercase text-gray-500 tracking-widest mb-3">Employee Stats</h2>
            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />)}</div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: "Total Employees in Odoo", value: stats.total_employees,  color: "text-brand-blue" },
                  { label: "Synced from Messob HR",   value: stats.synced_from_hr,   color: "text-purple-600" },
                  { label: "Registered Drivers",      value: stats.total_drivers,    color: "text-green-600" },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm text-gray-600">{s.label}</span>
                    <span className={`text-xl font-black ${s.color}`}>{s.value ?? "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border shadow-sm bg-amber-50 border-amber-200">
        <CardContent className="p-5">
          <h2 className="font-black text-sm uppercase text-amber-700 tracking-widest mb-3">Setup Checklist</h2>
          <ol className="space-y-2 text-sm text-amber-800 list-decimal list-inside">
            <li>In Odoo → Settings → Technical → System Parameters, set <code className="bg-amber-100 px-1 rounded">mesob.hr_sync_url</code> to your Messob HR API endpoint</li>
            <li>Set <code className="bg-amber-100 px-1 rounded">mesob.api_key</code> to your shared secret key</li>
            <li>Optionally set <code className="bg-amber-100 px-1 rounded">mesob.gps_gateway_url</code> for GPS polling</li>
            <li>Click <strong>Sync Now</strong> above to pull employees from Messob HR</li>
            <li>The cron job runs automatically every hour — no manual action needed after setup</li>
          </ol>
          <p className="text-xs text-amber-600 mt-3">
            HR webhook push endpoint: <code className="bg-amber-100 px-1 rounded">/webhook/hr/employee-sync</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

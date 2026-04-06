import { useEffect, useState } from "react";
import { fuelApi } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Loader2, Fuel, Search, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

function SummaryCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className={`rounded-2xl p-4 border shadow-sm ${color}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-black uppercase text-gray-500">{label}</p>
        <Icon className="h-4 w-4 text-gray-400" />
      </div>
      <p className="text-2xl font-black text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function FuelLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fuelApi.list()
      .then(res => setLogs(res.fuel_logs || []))
      .catch(err => toast.error("Failed to load fuel logs: " + err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter(l =>
    !search ||
    l.vehicle_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.driver_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.fuel_station?.toLowerCase().includes(search.toLowerCase())
  );

  const totalCost = logs.reduce((s, l) => s + (l.cost || 0), 0);
  const totalVolume = logs.reduce((s, l) => s + (l.volume || 0), 0);
  const avgEfficiency = logs.filter(l => l.fuel_efficiency > 0).reduce((s, l, _, a) => s + l.fuel_efficiency / a.length, 0);
  const anomalies = logs.filter(l => l.volume <= 0 || l.cost <= 0).length;

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center">
          <Fuel className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-brand-blue">Fuel Logs</h1>
          <p className="text-sm text-gray-400">{logs.length} records</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Total Records" value={loading ? "—" : logs.length} icon={Fuel} color="bg-white" />
        <SummaryCard label="Total Volume" value={loading ? "—" : `${totalVolume.toFixed(1)} L`} sub="all time" icon={TrendingUp} color="bg-orange-50" />
        <SummaryCard label="Total Cost" value={loading ? "—" : `${totalCost.toFixed(0)} ETB`} sub="all time" icon={TrendingDown} color="bg-red-50" />
        <SummaryCard label="Avg Efficiency" value={loading ? "—" : `${avgEfficiency.toFixed(2)} KM/L`} sub={anomalies > 0 ? `${anomalies} anomalies` : "fleet average"} icon={AlertTriangle} color={anomalies > 0 ? "bg-yellow-50" : "bg-green-50"} />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <Input placeholder="Search vehicle, driver, station..." className="pl-9 h-10 rounded-xl border-gray-200" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-md border overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              {["Vehicle", "Driver", "Date", "Station", "Volume (L)", "Cost (ETB)", "Odometer", "Efficiency"].map(h => (
                <TableHead key={h} className="font-black text-xs uppercase text-gray-500">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-16"><Loader2 className="h-7 w-7 animate-spin mx-auto text-brand-blue" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-16 text-gray-400 text-sm">No fuel logs found</TableCell></TableRow>
            ) : filtered.map(log => {
              const isAnomaly = log.volume <= 0 || log.cost <= 0;
              return (
                <TableRow key={log.id} className={`hover:bg-gray-50 transition-colors ${isAnomaly ? "bg-yellow-50/50" : ""}`}>
                  <TableCell className="font-bold text-sm text-gray-800">{log.vehicle_name}</TableCell>
                  <TableCell className="text-sm">{log.driver_name || <span className="text-gray-300">—</span>}</TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {log.date ? new Date(log.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{log.fuel_station || "—"}</TableCell>
                  <TableCell>
                    <span className={`text-sm font-bold ${log.volume <= 0 ? "text-red-500" : "text-gray-800"}`}>
                      {log.volume <= 0 && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                      {log.volume?.toFixed(1)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-sm font-bold ${log.cost <= 0 ? "text-red-500" : "text-gray-800"}`}>
                      {log.cost?.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{log.odometer?.toLocaleString()} km</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500 rounded-full" style={{ width: `${Math.min((log.fuel_efficiency / 20) * 100, 100)}%` }} />
                      </div>
                      <span className="text-xs font-bold text-gray-600">{log.fuel_efficiency?.toFixed(2)}</span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { fuelApi } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Fuel } from "lucide-react";
import { toast } from "sonner";

export default function FuelLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fuelApi.list()
      .then((res) => setLogs(res.fuel_logs || []))
      .catch((err) => toast.error("Failed to load fuel logs: " + err.message))
      .finally(() => setLoading(false));
  }, []);

  const totalCost = logs.reduce((sum, l) => sum + (l.cost || 0), 0);
  const totalVolume = logs.reduce((sum, l) => sum + (l.volume || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Fuel className="h-6 w-6 text-brand-blue" />
        <h1 className="text-2xl font-bold text-brand-blue">Fuel Logs</h1>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "Total Records", value: logs.length },
          { label: "Total Volume", value: `${totalVolume.toFixed(1)} L` },
          { label: "Total Cost", value: `${totalCost.toFixed(2)} ETB` },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border shadow-sm p-4 text-center">
            <p className="text-xs text-gray-500 uppercase font-bold">{s.label}</p>
            <p className="text-2xl font-black text-brand-blue mt-1">
              {loading ? <span className="inline-block w-16 h-6 bg-gray-100 animate-pulse rounded" /> : s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-md border overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="font-bold">Vehicle</TableHead>
              <TableHead className="font-bold">Driver</TableHead>
              <TableHead className="font-bold">Date</TableHead>
              <TableHead className="font-bold">Station</TableHead>
              <TableHead className="font-bold">Volume (L)</TableHead>
              <TableHead className="font-bold">Cost (ETB)</TableHead>
              <TableHead className="font-bold">Odometer</TableHead>
              <TableHead className="font-bold">Efficiency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-brand-blue" />
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-gray-400">
                  No fuel logs found
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id} className="hover:bg-gray-50 transition-colors">
                  <TableCell className="font-medium">{log.vehicle_name}</TableCell>
                  <TableCell>{log.driver_name || <span className="text-gray-400">—</span>}</TableCell>
                  <TableCell className="text-sm">
                    {log.date ? new Date(log.date).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{log.fuel_station || "—"}</TableCell>
                  <TableCell className={`text-sm font-bold ${log.volume <= 0 ? "text-red-500 bg-red-50" : ""}`}>
                    {log.volume?.toFixed(1)}
                  </TableCell>
                  <TableCell className={`text-sm font-bold ${log.cost <= 0 ? "text-red-500 bg-red-50" : ""}`}>
                    {log.cost?.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-sm">{log.odometer?.toLocaleString()} km</TableCell>
                  <TableCell className="text-sm">{log.fuel_efficiency?.toFixed(2)} KM/L</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

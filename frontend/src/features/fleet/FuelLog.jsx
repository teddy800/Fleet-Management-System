import { useEffect, useState } from "react";
import { fuelApi, fleetApi } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Fuel, Search, TrendingUp, TrendingDown, AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

function SummaryCard({ label, value, sub, icon: Icon, gradient, iconColor }) {
  return (
    <div className={cn("card-stat animate-fade-in-up", gradient)}>
      <div className="absolute -right-3 -top-3 w-16 h-16 rounded-full bg-white/10 pointer-events-none" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-black uppercase text-gray-500 tracking-widest mb-1">{label}</p>
          <p className="text-2xl font-black text-gray-800">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={cn("p-2.5 rounded-xl", iconColor, "bg-opacity-15")}>
          <Icon className={cn("h-5 w-5", iconColor.replace("bg-", "text-"))} />
        </div>
      </div>
    </div>
  );
}

export default function FuelLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vehicle_id: "", date: format(new Date(), "yyyy-MM-dd"),
    volume: "", cost: "", odometer: "", fuel_station: "",
  });

  const fetchLogs = () => {
    fuelApi.list()
      .then(res => setLogs(res.fuel_logs || []))
      .catch(err => toast.error("Failed to load fuel logs: " + err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
    fleetApi.list().then(res => setVehicles(res.vehicles || [])).catch(() => {});
  }, []);

  const handleAdd = async () => {
    if (!form.vehicle_id || !form.volume || !form.cost) {
      toast.error("Vehicle, volume, and cost are required");
      return;
    }
    setSaving(true);
    try {
      await fuelApi.create({
        vehicle_id: parseInt(form.vehicle_id),
        date: form.date,
        volume: parseFloat(form.volume),
        cost: parseFloat(form.cost),
        odometer: parseFloat(form.odometer) || 0,
        fuel_station: form.fuel_station,
      });
      toast.success("Fuel log added");
      setShowAdd(false);
      setForm({ vehicle_id: "", date: format(new Date(), "yyyy-MM-dd"), volume: "", cost: "", odometer: "", fuel_station: "" });
      setLoading(true);
      fetchLogs();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

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
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center">
          <Fuel className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-brand-blue">Fuel Logs</h1>
          <p className="text-sm text-gray-400">{logs.length} records</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="ml-auto bg-brand-blue hover:bg-blue-800 rounded-xl gap-2">
          <Plus className="h-4 w-4" /> Add Fuel Log
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-children">
        <SummaryCard label="Total Records" value={loading ? "—" : logs.length} icon={Fuel} gradient="bg-white border" iconColor="bg-orange-500" />
        <SummaryCard label="Total Volume" value={loading ? "—" : `${totalVolume.toFixed(1)} L`} sub="all time" icon={TrendingUp} gradient="gradient-card-amber" iconColor="bg-orange-500" />
        <SummaryCard label="Total Cost" value={loading ? "—" : `${totalCost.toFixed(0)} ETB`} sub="all time" icon={TrendingDown} gradient="gradient-card-red" iconColor="bg-red-500" />
        <SummaryCard label="Avg Efficiency" value={loading ? "—" : `${avgEfficiency.toFixed(2)} KM/L`} sub={anomalies > 0 ? `${anomalies} anomalies` : "fleet average"} icon={AlertTriangle} gradient={anomalies > 0 ? "gradient-card-amber" : "gradient-card-green"} iconColor={anomalies > 0 ? "bg-yellow-500" : "bg-green-500"} />
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

      {/* Add Fuel Log Dialog */}
      <Dialog open={showAdd} onOpenChange={v => !v && setShowAdd(false)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-brand-blue font-black flex items-center gap-2">
              <Fuel className="h-5 w-5" /> Add Fuel Log
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-black text-gray-600 uppercase">Vehicle *</label>
              <Select value={form.vehicle_id} onValueChange={v => setForm(f => ({ ...f, vehicle_id: v }))}>
                <SelectTrigger className="mt-1 rounded-xl h-11"><SelectValue placeholder="Select vehicle..." /></SelectTrigger>
                <SelectContent>
                  {vehicles.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.name} — {v.license_plate}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-black text-gray-600 uppercase">Date *</label>
                <Input type="date" className="mt-1 rounded-xl h-11" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-black text-gray-600 uppercase">Station</label>
                <Input className="mt-1 rounded-xl h-11" placeholder="e.g. Total Addis" value={form.fuel_station} onChange={e => setForm(f => ({ ...f, fuel_station: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-black text-gray-600 uppercase">Volume (L) *</label>
                <Input type="number" min="0" step="0.1" className="mt-1 rounded-xl h-11" value={form.volume} onChange={e => setForm(f => ({ ...f, volume: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-black text-gray-600 uppercase">Cost (ETB) *</label>
                <Input type="number" min="0" step="0.01" className="mt-1 rounded-xl h-11" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-black text-gray-600 uppercase">Odometer</label>
                <Input type="number" min="0" className="mt-1 rounded-xl h-11" value={form.odometer} onChange={e => setForm(f => ({ ...f, odometer: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="bg-brand-blue hover:bg-blue-800" disabled={saving} onClick={handleAdd}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Fuel Log"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

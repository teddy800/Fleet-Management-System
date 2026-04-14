import { useEffect, useState, useCallback, useMemo } from "react";
import { fleetApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AlertCircle, Car, Loader2, Search, RefreshCw, MapPin, Gauge, Fuel, Activity, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_META = {
  available:   { label: "Available",   cls: "bg-green-100 text-green-700 border-green-200",  dot: "bg-green-500",  pulse: true },
  in_use:      { label: "In Use",      cls: "bg-blue-100 text-blue-700 border-blue-200",     dot: "bg-blue-500",   pulse: true },
  maintenance: { label: "Maintenance", cls: "bg-red-100 text-red-700 border-red-200",        dot: "bg-red-500",    pulse: false },
  unavailable: { label: "Unavailable", cls: "bg-gray-100 text-gray-600 border-gray-200",    dot: "bg-gray-400",   pulse: false },
};

function VehicleDetailPanel({ vehicle }) {
  if (!vehicle) return null;
  const sm = STATUS_META[vehicle.mesob_status] || STATUS_META.unavailable;
  return (
    <DialogContent className="max-w-lg rounded-2xl">
      <DialogHeader>
        <DialogTitle className="text-brand-blue font-black flex items-center gap-2">
          <Car className="h-5 w-5" /> {vehicle.name}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        {/* Status Banner */}
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${sm.cls}`}>
          <span className={`w-3 h-3 rounded-full ${sm.dot} animate-pulse`} />
          <div>
            <p className="font-black text-sm">{sm.label}</p>
            <p className="text-xs opacity-70">{vehicle.license_plate}</p>
          </div>
          {vehicle.maintenance_due && (
            <Badge className="ml-auto bg-red-600 text-white text-xs">Maintenance Due</Badge>
          )}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Gauge, label: "Odometer", value: `${vehicle.current_odometer?.toLocaleString()} km` },
            { icon: Fuel, label: "Efficiency", value: `${vehicle.fuel_efficiency?.toFixed(2)} KM/L` },
            { icon: Activity, label: "Utilization", value: `${vehicle.utilization_rate?.toFixed(1)}%` },
            { icon: Car, label: "Category", value: vehicle.vehicle_category?.replace("_", " ") },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
              <Icon className="h-4 w-4 text-brand-blue shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase">{label}</p>
                <p className="text-sm font-black text-gray-800 capitalize">{value || "—"}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Driver */}
        <div className="bg-brand-blue/5 rounded-xl p-3 border border-brand-blue/10">
          <p className="text-xs text-gray-400 font-bold uppercase mb-1">Assigned Driver</p>
          <p className="font-bold text-gray-800">{vehicle.assigned_driver || "Unassigned"}</p>
        </div>

        {/* GPS */}
        {vehicle.current_location?.latitude && vehicle.current_location?.longitude ? (
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 font-bold uppercase mb-2 flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Last Known Location
            </p>
            <p className="text-xs font-mono text-gray-600">
              {vehicle.current_location.latitude.toFixed(6)}, {vehicle.current_location.longitude.toFixed(6)}
            </p>
            {vehicle.current_location.last_update && (
              <p className="text-xs text-gray-400 mt-1">
                Updated: {new Date(vehicle.current_location.last_update).toLocaleString()}
              </p>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-3 text-center text-xs text-gray-400">
            <MapPin className="h-4 w-4 mx-auto mb-1 opacity-40" /> No GPS data available
          </div>
        )}
      </div>
    </DialogContent>
  );
}

export default function ManageFleet() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selected, setSelected] = useState(null);

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fleetApi.list();
      setVehicles(res.vehicles || []);
    } catch (err) {
      toast.error("Failed to load fleet: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  const filtered = useMemo(() => vehicles.filter(v => {
    const matchStatus = filterStatus === "all" || v.mesob_status === filterStatus;
    const matchSearch = !search || v.name?.toLowerCase().includes(search.toLowerCase()) ||
      v.license_plate?.toLowerCase().includes(search.toLowerCase()) ||
      v.assigned_driver?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  }), [vehicles, filterStatus, search]);

  const counts = useMemo(() => ({
    total: vehicles.length,
    available: vehicles.filter(v => v.mesob_status === "available").length,
    in_use: vehicles.filter(v => v.mesob_status === "in_use").length,
    maintenance: vehicles.filter(v => v.mesob_status === "maintenance").length,
    due: vehicles.filter(v => v.maintenance_due).length,
  }), [vehicles]);

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-brand-blue">Fleet Management</h1>
          <p className="text-sm text-gray-400">{vehicles.length} vehicles registered</p>
        </div>
        <button onClick={fetchVehicles} className="p-2 rounded-xl border bg-white hover:bg-gray-50 shadow-sm">
          <RefreshCw className={`h-4 w-4 text-gray-500 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: counts.total, color: "text-brand-blue", bg: "bg-blue-50" },
          { label: "Available", value: counts.available, color: "text-green-600", bg: "bg-green-50" },
          { label: "In Use", value: counts.in_use, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Maintenance", value: counts.maintenance, color: "text-red-600", bg: "bg-red-50" },
          { label: "Service Due", value: counts.due, color: "text-orange-600", bg: "bg-orange-50" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center border border-white shadow-sm`}>
            <p className="text-xs text-gray-500 uppercase font-bold">{s.label}</p>
            <p className={`text-3xl font-black mt-1 ${s.color}`}>
              {loading ? <span className="inline-block w-8 h-7 bg-white/60 animate-pulse rounded" /> : s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input placeholder="Search vehicle, plate, driver..." className="pl-9 h-10 rounded-xl border-gray-200" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {["all", "available", "in_use", "maintenance"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${filterStatus === s ? "bg-brand-blue text-white border-brand-blue" : "bg-white text-gray-600 border-gray-200 hover:border-brand-blue"}`}>
              {s === "all" ? "All" : STATUS_META[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-md border overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="font-black text-xs uppercase text-gray-500">Vehicle</TableHead>
              <TableHead className="font-black text-xs uppercase text-gray-500">Plate</TableHead>
              <TableHead className="font-black text-xs uppercase text-gray-500">Category</TableHead>
              <TableHead className="font-black text-xs uppercase text-gray-500">Status</TableHead>
              <TableHead className="font-black text-xs uppercase text-gray-500">Driver</TableHead>
              <TableHead className="font-black text-xs uppercase text-gray-500">Odometer</TableHead>
              <TableHead className="font-black text-xs uppercase text-gray-500">Efficiency</TableHead>
              <TableHead className="font-black text-xs uppercase text-gray-500">Utilization</TableHead>
              <TableHead className="font-black text-xs uppercase text-gray-500">Service</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-16"><Loader2 className="h-7 w-7 animate-spin mx-auto text-brand-blue" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-16 text-gray-400 text-sm">No vehicles found</TableCell></TableRow>
            ) : filtered.map(v => {
              const sm = STATUS_META[v.mesob_status] || STATUS_META.unavailable;
              return (
                <TableRow key={v.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelected(v)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
                        <Car className="h-4 w-4 text-brand-blue" />
                      </div>
                      <span className="font-bold text-sm text-gray-800">{v.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-gray-600">{v.license_plate}</TableCell>
                  <TableCell className="text-xs capitalize text-gray-600">{v.vehicle_category?.replace("_", " ")}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "w-2.5 h-2.5 rounded-full shrink-0",
                        sm.dot,
                        sm.pulse && "pulse-dot"
                      )} />
                      <Badge className={`text-xs border ${sm.cls}`}>{sm.label}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{v.assigned_driver || <span className="text-gray-300 text-xs">Unassigned</span>}</TableCell>
                  <TableCell className="text-sm font-bold text-gray-700">{v.current_odometer?.toLocaleString()} km</TableCell>
                  <TableCell className="text-sm">{v.fuel_efficiency?.toFixed(2)} KM/L</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden w-16">
                        <div className="h-full bg-brand-blue rounded-full" style={{ width: `${Math.min(v.utilization_rate || 0, 100)}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{v.utilization_rate?.toFixed(0)}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {v.maintenance_due ? (
                      <span className="flex items-center gap-1 text-red-600 text-xs font-bold">
                        <AlertCircle className="h-3.5 w-3.5" /> Due
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-green-600 text-xs font-bold">
                        <CheckCircle2 className="h-3.5 w-3.5" /> OK
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <VehicleDetailPanel vehicle={selected} />
      </Dialog>
    </div>
  );
}

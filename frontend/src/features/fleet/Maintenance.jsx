/**
 * FR-4.3: Preventive Maintenance & Alerts
 * FR-4.4: Repair & Maintenance Logging
 * Tabs: History (logs) + Schedules (preventive)
 */
import { useEffect, useState, useCallback } from "react";
import { maintenanceApi, fleetApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wrench, RefreshCw, Loader2, Search, AlertCircle, CheckCircle2, Clock, Calendar, Car, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const STATE_META = {
  draft:       { label: "Draft",       cls: "bg-gray-100 text-gray-600 border-gray-200" },
  in_progress: { label: "In Progress", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  done:        { label: "Completed",   cls: "bg-green-100 text-green-700 border-green-200" },
  cancelled:   { label: "Cancelled",   cls: "bg-red-100 text-red-600 border-red-200" },
};

const TYPE_META = {
  preventive:  { label: "Preventive",  cls: "bg-teal-100 text-teal-700" },
  corrective:  { label: "Corrective",  cls: "bg-orange-100 text-orange-700" },
  emergency:   { label: "Emergency",   cls: "bg-red-100 text-red-700" },
  inspection:  { label: "Inspection",  cls: "bg-purple-100 text-purple-700" },
};

function SummaryCard({ label, value, icon: Icon, color, bg, loading }) {
  return (
    <Card className={`border shadow-sm ${bg}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}/10`}>
          <Icon className={`h-5 w-5 ${color.replace("bg-", "text-")}`} />
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase font-black tracking-widest">{label}</p>
          <p className={`text-2xl font-black mt-0.5 ${color.replace("bg-", "text-")}`}>
            {loading ? <span className="inline-block w-10 h-6 bg-gray-100 animate-pulse rounded" /> : value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Maintenance() {
  const [logs, setLogs] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("history");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vehicle_id: "", date: format(new Date(), "yyyy-MM-dd"),
    maintenance_type: "preventive", description: "", cost: "", odometer: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, schedulesRes] = await Promise.all([
        maintenanceApi.list(),
        maintenanceApi.schedules(),
      ]);
      setLogs(logsRes.maintenance_logs || []);
      setSchedules(schedulesRes.schedules || []);
    } catch (err) {
      toast.error("Failed to load maintenance data: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fleetApi.list().then(res => setVehicles(res.vehicles || [])).catch(() => {});
  }, [fetchData]);

  const handleAdd = async () => {
    if (!form.vehicle_id || !form.maintenance_type) {
      toast.error("Vehicle and maintenance type are required");
      return;
    }
    setSaving(true);
    try {
      await maintenanceApi.create({
        vehicle_id: parseInt(form.vehicle_id),
        date: form.date,
        maintenance_type: form.maintenance_type,
        description: form.description,
        cost: parseFloat(form.cost) || 0,
        odometer: parseFloat(form.odometer) || 0,
      });
      toast.success("Maintenance log created");
      setShowAdd(false);
      setForm({ vehicle_id: "", date: format(new Date(), "yyyy-MM-dd"), maintenance_type: "preventive", description: "", cost: "", odometer: "" });
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inProgress = logs.filter(l => l.state === "in_progress").length;
  const overdue = schedules.filter(s => s.is_overdue).length;

  const filteredLogs = logs.filter(l =>
    !search || l.vehicle_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.maintenance_type?.toLowerCase().includes(search.toLowerCase()) ||
    l.technician?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredSchedules = schedules.filter(s =>
    !search || s.vehicle_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.maintenance_type?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center">
            <Wrench className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-brand-blue">Maintenance</h1>
            <p className="text-sm text-gray-400">Service history and preventive schedules</p>
          </div>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 text-sm text-gray-500 hover:text-brand-blue bg-white border rounded-xl px-3 py-2 shadow-sm">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
        <Button onClick={() => setShowAdd(true)} className="bg-brand-blue hover:bg-blue-800 rounded-xl gap-2">
          <Plus className="h-4 w-4" /> Add Log
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Total Logs"   value={logs.length}      icon={Wrench}       color="bg-brand-blue"  bg="bg-white"       loading={loading} />
        <SummaryCard label="In Progress"  value={inProgress}       icon={Clock}        color="bg-blue-500"    bg="bg-blue-50"     loading={loading} />
        <SummaryCard label="Overdue"      value={overdue}          icon={AlertCircle}  color="bg-red-500"     bg="bg-red-50"      loading={loading} />
        <SummaryCard label="Schedules"    value={schedules.length} icon={Calendar}     color="bg-teal-500"    bg="bg-teal-50"     loading={loading} />
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {[
            { key: "history",   label: `History (${logs.length})` },
            { key: "schedules", label: `Schedules (${schedules.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all",
                tab === t.key ? "bg-white text-brand-blue shadow-sm" : "text-gray-500 hover:text-gray-700")}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input placeholder="Search vehicle, type, technician..." className="pl-9 h-10 rounded-xl border-gray-200"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* History Tab */}
      {tab === "history" && (
        <div className="bg-white rounded-2xl shadow-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="font-black text-xs uppercase text-gray-500">Vehicle</TableHead>
                <TableHead className="font-black text-xs uppercase text-gray-500">Type</TableHead>
                <TableHead className="font-black text-xs uppercase text-gray-500">Date</TableHead>
                <TableHead className="font-black text-xs uppercase text-gray-500">Technician</TableHead>
                <TableHead className="font-black text-xs uppercase text-gray-500">Cost (ETB)</TableHead>
                <TableHead className="font-black text-xs uppercase text-gray-500">Odometer</TableHead>
                <TableHead className="font-black text-xs uppercase text-gray-500">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-16"><Loader2 className="h-7 w-7 animate-spin mx-auto text-brand-blue" /></TableCell></TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-16 text-gray-400 text-sm">
                  <Wrench className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  No maintenance records found
                </TableCell></TableRow>
              ) : filteredLogs.map(log => (
                <TableRow key={log.id} className="hover:bg-gray-50/80">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-brand-blue shrink-0" />
                      <span className="font-bold text-sm text-gray-800">{log.vehicle_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TYPE_META[log.maintenance_type]?.cls || "bg-gray-100 text-gray-600"}`}>
                      {TYPE_META[log.maintenance_type]?.label || log.maintenance_type}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {log.date ? new Date(log.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{log.technician || "—"}</TableCell>
                  <TableCell className="text-sm font-bold text-brand-blue">{log.cost?.toFixed(2) || "0.00"}</TableCell>
                  <TableCell className="text-sm text-gray-600">{log.odometer ? `${log.odometer.toLocaleString()} km` : "—"}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs border ${STATE_META[log.state]?.cls || "bg-gray-100"}`}>
                      {STATE_META[log.state]?.label || log.state}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Schedules Tab */}
      {tab === "schedules" && (
        <div className="bg-white rounded-2xl shadow-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="font-black text-xs uppercase text-gray-500">Vehicle</TableHead>
                <TableHead className="font-black text-xs uppercase text-gray-500">Type</TableHead>
                <TableHead className="font-black text-xs uppercase text-gray-500">Interval</TableHead>
                <TableHead className="font-black text-xs uppercase text-gray-500">Last Service</TableHead>
                <TableHead className="font-black text-xs uppercase text-gray-500">Next Due</TableHead>
                <TableHead className="font-black text-xs uppercase text-gray-500">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-16"><Loader2 className="h-7 w-7 animate-spin mx-auto text-brand-blue" /></TableCell></TableRow>
              ) : filteredSchedules.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-16 text-gray-400 text-sm">
                  <Calendar className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  No maintenance schedules found
                </TableCell></TableRow>
              ) : filteredSchedules.map(s => (
                <TableRow key={s.id} className={cn("hover:bg-gray-50/80", s.is_overdue && "bg-red-50/40")}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-brand-blue shrink-0" />
                      <span className="font-bold text-sm text-gray-800">{s.vehicle_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 capitalize">{s.maintenance_type?.replace("_", " ")}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {s.interval_km ? `${s.interval_km.toLocaleString()} km` : ""}
                    {s.interval_km && s.interval_days ? " / " : ""}
                    {s.interval_days ? `${s.interval_days} days` : ""}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {s.last_service_date ? new Date(s.last_service_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>
                      {s.next_due_date && (
                        <p className={s.is_overdue ? "text-red-600 font-bold" : "text-gray-600"}>
                          {new Date(s.next_due_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      )}
                      {s.next_due_odometer > 0 && (
                        <p className="text-xs text-gray-400">{s.next_due_odometer.toLocaleString()} km</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {s.is_overdue ? (
                      <Badge className="bg-red-100 text-red-700 border-red-200 text-xs flex items-center gap-1 w-fit">
                        <AlertCircle className="h-3 w-3" /> Overdue
                      </Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-700 border-green-200 text-xs flex items-center gap-1 w-fit">
                        <CheckCircle2 className="h-3 w-3" /> OK
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Maintenance Log Dialog */}
      <Dialog open={showAdd} onOpenChange={v => !v && setShowAdd(false)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-brand-blue font-black flex items-center gap-2">
              <Wrench className="h-5 w-5" /> Add Maintenance Log
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
                <label className="text-xs font-black text-gray-600 uppercase">Type *</label>
                <Select value={form.maintenance_type} onValueChange={v => setForm(f => ({ ...f, maintenance_type: v }))}>
                  <SelectTrigger className="mt-1 rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventive">Preventive</SelectItem>
                    <SelectItem value="corrective">Corrective</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-black text-gray-600 uppercase">Cost (ETB)</label>
                <Input type="number" min="0" className="mt-1 rounded-xl h-11" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-black text-gray-600 uppercase">Odometer (km)</label>
                <Input type="number" min="0" className="mt-1 rounded-xl h-11" value={form.odometer} onChange={e => setForm(f => ({ ...f, odometer: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-black text-gray-600 uppercase">Description</label>
              <Textarea className="mt-1 rounded-xl" rows={3} placeholder="Describe the maintenance work..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="bg-brand-blue hover:bg-blue-800" disabled={saving} onClick={handleAdd}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Log"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
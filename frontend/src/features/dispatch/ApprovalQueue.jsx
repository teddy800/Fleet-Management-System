import { useState, useEffect, useCallback } from "react";
import { tripApi, fleetApi, driverApi } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Eye, CheckCircle, XCircle, Loader2, Car, Search, Filter, RefreshCw, UserCheck } from "lucide-react";
import { toast } from "sonner";

const STATE_META = {
  pending:     { label: "Pending",     cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  approved:    { label: "Approved",    cls: "bg-green-100 text-green-800 border-green-200" },
  rejected:    { label: "Rejected",    cls: "bg-red-100 text-red-800 border-red-200" },
  assigned:    { label: "Assigned",    cls: "bg-blue-100 text-blue-800 border-blue-200" },
  in_progress: { label: "In Progress", cls: "bg-purple-100 text-purple-800 border-purple-200" },
  completed:   { label: "Completed",   cls: "bg-gray-100 text-gray-700 border-gray-200" },
  cancelled:   { label: "Cancelled",   cls: "bg-gray-100 text-gray-500 border-gray-200" },
};

const PRIORITY_META = {
  urgent: { cls: "text-red-700 bg-red-50 border border-red-200",    row: "priority-urgent", dot: "bg-red-500" },
  high:   { cls: "text-orange-700 bg-orange-50 border border-orange-200", row: "priority-high", dot: "bg-orange-500" },
  normal: { cls: "text-gray-600 bg-gray-50 border border-gray-200", row: "priority-normal", dot: "bg-blue-400" },
  low:    { cls: "text-blue-600 bg-blue-50 border border-blue-200", row: "priority-low",    dot: "bg-gray-400" },
};

export default function ApprovalQueue() {
  const [requests, setRequests] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const [mode, setMode] = useState(null); // "view" | "reject" | "assign"
  const [rejectReason, setRejectReason] = useState("");
  const [assignVehicle, setAssignVehicle] = useState("");
  const [assignDriver, setAssignDriver] = useState("");
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState("all");

  const fetchAll = useCallback(async () => {
    try {
      const [reqRes, vehRes, drvRes] = await Promise.all([tripApi.list(), fleetApi.list(), driverApi.list()]);
      // FR-2.1: display oldest first (backend already returns asc, but sort client-side as safety)
      const sorted = (reqRes.trip_requests || []).sort(
        (a, b) => new Date(a.create_date) - new Date(b.create_date)
      );
      setRequests(sorted);
      setVehicles((vehRes.vehicles || []).filter(v => v.mesob_status === "available"));
      setDrivers((drvRes.drivers || []).filter(d => d.active_trips === 0));
    } catch (err) {
      toast.error("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const closeDialog = () => {
    setSelectedReq(null); setMode(null); setRejectReason("");
    setAssignVehicle(""); setAssignDriver("");
    setAvailableVehicles([]); setAvailableDrivers([]);
  };

  // FR-2.2: fetch time-window filtered resources when assign dialog opens
  const openAssignDialog = async (req) => {
    setSelectedReq(req);
    setMode("assign");
    setAssignVehicle(""); setAssignDriver("");
    // Use already-loaded available vehicles/drivers directly
    // (avoids the end_datetime field issue on mesob.trip.assignment)
    setAvailableVehicles(vehicles.length > 0 ? vehicles : []);
    setAvailableDrivers(drivers.length > 0 ? drivers : []);
    setLoadingResources(false);
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await tripApi.approve(selectedReq.id);
      toast.success(`Request ${selectedReq.name} approved`);
      closeDialog();
      fetchAll();
    } catch (err) { toast.error(err.message); }
    finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error("Please provide a rejection reason"); return; }
    setActionLoading(true);
    try {
      await tripApi.reject(selectedReq.id, rejectReason);
      toast.success("Request rejected");
      closeDialog();
      fetchAll();
    } catch (err) { toast.error(err.message); }
    finally { setActionLoading(false); }
  };

  const handleAssign = async () => {
    if (!assignVehicle || !assignDriver) { toast.error("Select both vehicle and driver"); return; }
    setActionLoading(true);
    try {
      await tripApi.assign(selectedReq.id, parseInt(assignVehicle), parseInt(assignDriver));
      toast.success("Vehicle assigned successfully");
      closeDialog();
      fetchAll();
    } catch (err) { toast.error(err.message); }
    finally { setActionLoading(false); }
  };

  async function handleApproveImmediate(req) {
    setActionLoading(true);
    try {
      await tripApi.approve(req.id);
      toast.success(`Request ${req.name} approved`);
      setMode(null);
      setSelectedReq(null);
      fetchAll();
    } catch (err) { toast.error(err.message); }
    finally { setActionLoading(false); }
  }

  const filtered = requests.filter(r => {
    const matchState = filterState === "all" || r.state === filterState;
    const matchSearch = !search || r.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.destination_location?.toLowerCase().includes(search.toLowerCase()) ||
      r.name?.toLowerCase().includes(search.toLowerCase());
    return matchState && matchSearch;
  });

  const pendingCount = requests.filter(r => r.state === "pending").length;
  const approvedCount = requests.filter(r => r.state === "approved").length;

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-brand-blue">Trip Request Queue</h2>
          <p className="text-sm text-gray-400">{requests.length} total requests</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && <Badge className="bg-yellow-500 text-white px-3">{pendingCount} Pending</Badge>}
          {approvedCount > 0 && <Badge className="bg-green-600 text-white px-3">{approvedCount} Approved</Badge>}
          <button onClick={fetchAll} className="p-2 rounded-xl border bg-white hover:bg-gray-50 shadow-sm">
            <RefreshCw className={`h-4 w-4 text-gray-500 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input placeholder="Search by name, requester, destination..." className="pl-9 h-10 rounded-xl border-gray-200" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          {["all", "pending", "approved", "assigned", "in_progress", "completed"].map(s => (
            <button key={s} onClick={() => setFilterState(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${filterState === s ? "bg-brand-blue text-white border-brand-blue" : "bg-white text-gray-600 border-gray-200 hover:border-brand-blue"}`}>
              {s === "all" ? "All" : STATE_META[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-md border overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="font-black text-xs uppercase text-gray-500">Request</TableHead>
              <TableHead className="font-black text-xs uppercase text-gray-500">Requester</TableHead>
              <TableHead className="font-black text-xs uppercase text-gray-500">Route</TableHead>
              <TableHead className="font-black text-xs uppercase text-gray-500">Date</TableHead>
              <TableHead className="font-black text-xs uppercase text-gray-500">Priority</TableHead>
              <TableHead className="font-black text-xs uppercase text-gray-500">Status</TableHead>
              <TableHead className="font-black text-xs uppercase text-gray-500 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-16"><Loader2 className="h-7 w-7 animate-spin mx-auto text-brand-blue" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-16 text-gray-400 text-sm">No requests found</TableCell></TableRow>
            ) : filtered.map(req => (
              <TableRow key={req.id} className={`hover:bg-gray-50/80 transition-colors ${PRIORITY_META[req.priority]?.row || ""}`}>
                <TableCell>
                  <p className="font-bold text-sm text-brand-blue">{req.name || `#${req.id}`}</p>
                  <p className="text-xs text-gray-400 capitalize">{req.trip_type?.replace("_", " ")}</p>
                </TableCell>
                <TableCell className="text-sm font-medium">{req.employee_name}</TableCell>
                <TableCell>
                  <p className="text-xs text-gray-500 truncate max-w-[140px]">{req.pickup_location}</p>
                  <p className="text-xs font-bold text-gray-700 truncate max-w-[140px]">→ {req.destination_location}</p>
                </TableCell>
                <TableCell className="text-xs text-gray-500">
                  {req.start_datetime ? new Date(req.start_datetime).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${PRIORITY_META[req.priority]?.dot || "bg-gray-400"}`} />
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${PRIORITY_META[req.priority]?.cls || ""}`}>
                      {req.priority}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={`text-xs border ${STATE_META[req.state]?.cls || "bg-gray-100"}`}>
                    {STATE_META[req.state]?.label || req.state}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={() => { setSelectedReq(req); setMode("view"); }}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> View
                    </Button>
                    {req.state === "pending" && (
                      <>
                        <Button size="sm" className="h-8 rounded-lg text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => handleApproveImmediate(req)}>
                          <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" className="h-8 rounded-lg text-xs bg-red-600 hover:bg-red-700 text-white" onClick={() => { setSelectedReq(req); setMode("reject"); }}>
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {req.state === "approved" && (
                      <Button size="sm" className="h-8 rounded-lg text-xs bg-brand-blue hover:bg-blue-800 text-white" onClick={() => openAssignDialog(req)}>
                        <Car className="h-3.5 w-3.5 mr-1" /> Assign
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* View Dialog */}
      <Dialog open={mode === "view" && !!selectedReq} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-brand-blue font-black">
              {selectedReq?.name} — {selectedReq?.purpose?.slice(0, 40)}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 text-sm py-2">
            {[
              ["Requester", selectedReq?.employee_name],
              ["Status", STATE_META[selectedReq?.state]?.label],
              ["Priority", selectedReq?.priority],
              ["Trip Type", selectedReq?.trip_type?.replace("_", " ")],
              ["Passengers", selectedReq?.passenger_count],
              ["Vehicle Category", selectedReq?.vehicle_category],
              ["From", selectedReq?.pickup_location],
              ["To", selectedReq?.destination_location],
              ["Start", selectedReq?.start_datetime ? new Date(selectedReq.start_datetime).toLocaleString() : "—"],
              ["End", selectedReq?.end_datetime ? new Date(selectedReq.end_datetime).toLocaleString() : "—"],
              ["Assigned Vehicle", selectedReq?.assigned_vehicle || "—"],
              ["Assigned Driver", selectedReq?.assigned_driver || "—"],
            ].map(([label, value]) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 font-bold uppercase">{label}</p>
                <p className="font-bold text-gray-800 capitalize">{value || "—"}</p>
              </div>
            ))}
          </div>
          {selectedReq?.state === "pending" && (
            <DialogFooter className="gap-2">
              <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => setMode("reject")}>
                <XCircle className="mr-2 h-4 w-4" /> Reject
              </Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700" disabled={actionLoading} onClick={handleApprove}>
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="mr-2 h-4 w-4" /> Approve</>}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={mode === "reject" && !!selectedReq} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-red-600 font-black">Reject Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">Rejecting: <span className="font-bold">{selectedReq?.name}</span></p>
            <Textarea placeholder="Provide a clear reason for rejection..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="rounded-xl min-h-[100px]" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700" disabled={actionLoading || !rejectReason.trim()} onClick={handleReject}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={mode === "assign" && !!selectedReq} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-brand-blue font-black flex items-center gap-2">
              <Car className="h-5 w-5" /> Assign Vehicle & Driver
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-gray-50 rounded-xl p-3 text-sm">
              <p className="font-bold text-gray-800">{selectedReq?.name}</p>
              <p className="text-gray-500">{selectedReq?.pickup_location} → {selectedReq?.destination_location}</p>
              <p className="text-gray-500">{selectedReq?.start_datetime ? new Date(selectedReq.start_datetime).toLocaleString() : ""}</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-600 uppercase">Available Vehicle</label>
              <Select key={`vehicle-${selectedReq?.id}`} value={assignVehicle} onValueChange={setAssignVehicle}>
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue placeholder="Select a vehicle..." />
                </SelectTrigger>
                <SelectContent>
                  {loadingResources
                    ? <SelectItem value="loading" disabled>Loading available vehicles...</SelectItem>
                    : availableVehicles.length > 0
                      ? availableVehicles.map(v => (
                          <SelectItem key={v.id} value={String(v.id)}>
                            {v.name} — {v.license_plate} ({v.vehicle_category})
                          </SelectItem>
                        ))
                      : <SelectItem value="none" disabled>No available vehicles for this time window</SelectItem>
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-600 uppercase">Available Driver</label>
              <Select key={`driver-${selectedReq?.id}`} value={assignDriver} onValueChange={setAssignDriver}>
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue placeholder="Select a driver..." />
                </SelectTrigger>
                <SelectContent>
                  {loadingResources
                    ? <SelectItem value="loading" disabled>Loading available drivers...</SelectItem>
                    : availableDrivers.length > 0
                      ? availableDrivers.map(d => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            {d.name} {d.license_number ? `— Lic: ${d.license_number}` : ""}
                          </SelectItem>
                        ))
                      : <SelectItem value="none" disabled>No available drivers for this time window</SelectItem>
                  }
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button className="bg-brand-blue hover:bg-blue-800" disabled={actionLoading || !assignVehicle || !assignDriver} onClick={handleAssign}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserCheck className="mr-2 h-4 w-4" /> Confirm Assignment</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

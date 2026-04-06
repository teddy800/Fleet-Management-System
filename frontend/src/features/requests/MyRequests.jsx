/**
 * FR-1.2: Personal Request Dashboard
 * Shows logged-in user's own trip requests with status, details, and cancel option.
 * FR-1.3: Cancel button shown only for pending requests.
 */
import { useEffect, useState, useCallback } from "react";
import { tripApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Eye, XCircle, RefreshCw, ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const STATE_META = {
  draft:       { label: "Draft",       cls: "bg-gray-100 text-gray-600 border-gray-200" },
  pending:     { label: "Pending",     cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  approved:    { label: "Approved",    cls: "bg-green-100 text-green-800 border-green-200" },
  rejected:    { label: "Rejected",    cls: "bg-red-100 text-red-800 border-red-200" },
  assigned:    { label: "Assigned",    cls: "bg-blue-100 text-blue-800 border-blue-200" },
  in_progress: { label: "In Progress", cls: "bg-purple-100 text-purple-800 border-purple-200" },
  completed:   { label: "Completed",   cls: "bg-teal-100 text-teal-800 border-teal-200" },
  cancelled:   { label: "Cancelled",   cls: "bg-gray-100 text-gray-500 border-gray-200" },
};

export default function MyRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(null);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await tripApi.listMine();
      setRequests(res.trip_requests || []);
    } catch (err) {
      toast.error("Failed to load requests: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleCancel = async (req) => {
    setCancelling(true);
    try {
      await tripApi.cancel(req.id);
      toast.success(`Request ${req.name} cancelled`);
      setConfirmCancel(null);
      fetchRequests();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCancelling(false);
    }
  };

  const counts = {
    pending: requests.filter(r => r.state === "pending").length,
    active: requests.filter(r => ["approved", "assigned", "in_progress"].includes(r.state)).length,
    completed: requests.filter(r => r.state === "completed").length,
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-brand-blue flex items-center gap-2">
            <ClipboardList className="h-6 w-6" /> My Trip Requests
          </h1>
          <p className="text-sm text-gray-400">{requests.length} total requests</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchRequests} className="p-2 rounded-xl border bg-white hover:bg-gray-50 shadow-sm">
            <RefreshCw className={`h-4 w-4 text-gray-500 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Link to="/requests/new">
            <Button className="bg-brand-blue hover:bg-blue-800 rounded-xl gap-2">
              <Plus className="h-4 w-4" /> New Request
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Pending", value: counts.pending, color: "text-yellow-600", bg: "bg-yellow-50" },
          { label: "Active", value: counts.active, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Completed", value: counts.completed, color: "text-teal-600", bg: "bg-teal-50" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 border shadow-sm text-center`}>
            <p className="text-xs text-gray-500 uppercase font-bold">{s.label}</p>
            <p className={`text-2xl font-black mt-1 ${s.color}`}>
              {loading ? <span className="inline-block w-8 h-6 bg-white/60 animate-pulse rounded" /> : s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-md border overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="font-black text-xs uppercase text-gray-500">Request ID</TableHead>
              <TableHead className="font-black text-xs uppercase text-gray-500">Purpose</TableHead>
              <TableHead className="font-black text-xs uppercase text-gray-500">Route</TableHead>
              <TableHead className="font-black text-xs uppercase text-gray-500">Date</TableHead>
              <TableHead className="font-black text-xs uppercase text-gray-500">Status</TableHead>
              <TableHead className="font-black text-xs uppercase text-gray-500 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-16"><Loader2 className="h-7 w-7 animate-spin mx-auto text-brand-blue" /></TableCell></TableRow>
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16">
                  <ClipboardList className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                  <p className="text-gray-400 text-sm">No requests yet</p>
                  <Link to="/requests/new" className="text-brand-blue text-sm font-bold hover:underline mt-1 block">
                    Create your first request →
                  </Link>
                </TableCell>
              </TableRow>
            ) : requests.map(req => {
              const sm = STATE_META[req.state] || STATE_META.draft;
              return (
                <TableRow key={req.id} className="hover:bg-gray-50 transition-colors">
                  <TableCell className="font-bold text-sm text-brand-blue">{req.name || `#${req.id}`}</TableCell>
                  <TableCell className="text-sm max-w-[160px] truncate">{req.purpose}</TableCell>
                  <TableCell>
                    <p className="text-xs text-gray-500 truncate max-w-[120px]">{req.pickup_location}</p>
                    <p className="text-xs font-bold text-gray-700 truncate max-w-[120px]">→ {req.destination_location}</p>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {req.start_datetime ? new Date(req.start_datetime).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs border ${sm.cls}`}>{sm.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={() => setSelected(req)}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> View
                      </Button>
                      {/* FR-1.3: Cancel only if pending */}
                      {req.state === "pending" && (
                        <Button size="sm" className="h-8 rounded-lg text-xs bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white"
                          onClick={() => setConfirmCancel(req)}>
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-brand-blue font-black">{selected?.name} — Details</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 text-sm py-2">
            {[
              ["Status", <Badge key="s" className={`text-xs border ${STATE_META[selected?.state]?.cls || ""}`}>{STATE_META[selected?.state]?.label}</Badge>],
              ["Purpose", selected?.purpose],
              ["Vehicle Category", selected?.vehicle_category],
              ["Trip Type", selected?.trip_type?.replace("_", " ")],
              ["Passengers", selected?.passenger_count],
              ["Priority", selected?.priority],
              ["From", selected?.pickup_location],
              ["To", selected?.destination_location],
              ["Start", selected?.start_datetime ? new Date(selected.start_datetime).toLocaleString() : "—"],
              ["End", selected?.end_datetime ? new Date(selected.end_datetime).toLocaleString() : "—"],
              ["Assigned Vehicle", selected?.assigned_vehicle || "Pending assignment"],
              ["Assigned Driver", selected?.assigned_driver || "Pending assignment"],
            ].map(([label, value]) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 font-bold uppercase">{label}</p>
                <div className="font-bold text-gray-800 capitalize mt-0.5">{value || "—"}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <Dialog open={!!confirmCancel} onOpenChange={v => !v && setConfirmCancel(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-red-600 font-black">Cancel Request?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            Are you sure you want to cancel <span className="font-bold">{confirmCancel?.name}</span>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancel(null)}>Keep It</Button>
            <Button className="bg-red-600 hover:bg-red-700" disabled={cancelling} onClick={() => handleCancel(confirmCancel)}>
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

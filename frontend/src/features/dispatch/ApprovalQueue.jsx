import { useState, useEffect } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Eye, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { tripApi } from "@/lib/api";
import { toast } from "sonner";

const STATUS_COLORS = {
  pending: "bg-brand-gold text-black",
  approved: "bg-green-600 text-white",
  rejected: "bg-red-600 text-white",
  in_progress: "bg-blue-600 text-white",
  completed: "bg-gray-500 text-white",
};

export default function ApprovalQueue() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchRequests = async () => {
    try {
      const res = await tripApi.list();
      setRequests(res.trip_requests || []);
    } catch (err) {
      toast.error("Failed to load requests: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleApprove = async (id) => {
    setActionLoading(true);
    try {
      await tripApi.approve(id);
      toast.success("Request approved");
      setOpen(false);
      fetchRequests();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id) => {
    setActionLoading(true);
    try {
      await tripApi.reject(id, rejectReason);
      toast.success("Request rejected");
      setOpen(false);
      setRejectReason("");
      fetchRequests();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const pendingCount = requests.filter((r) => r.state === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-brand-blue">Incoming Trip Requests</h2>
        <Badge variant="outline" className="text-brand-blue border-brand-blue px-4 py-1">
          {pendingCount} Pending
        </Badge>
      </div>

      <div className="bg-white rounded-xl shadow-md border overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="font-bold">ID</TableHead>
              <TableHead className="font-bold">Requested By</TableHead>
              <TableHead className="font-bold">Destination</TableHead>
              <TableHead className="font-bold">Date</TableHead>
              <TableHead className="font-bold">Priority</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="text-right font-bold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-brand-blue" />
                </TableCell>
              </TableRow>
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-gray-400">
                  No trip requests found
                </TableCell>
              </TableRow>
            ) : (
              requests.map((req) => (
                <TableRow key={req.id} className="hover:bg-gray-50 transition-colors">
                  <TableCell className="font-medium text-xs text-gray-500">{req.name || `#${req.id}`}</TableCell>
                  <TableCell>{req.employee_name}</TableCell>
                  <TableCell>{req.destination_location}</TableCell>
                  <TableCell className="text-sm">
                    {req.start_datetime ? new Date(req.start_datetime).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-bold uppercase ${req.priority === "urgent" ? "text-red-600" : "text-gray-500"}`}>
                      {req.priority}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[req.state] || "bg-gray-200 text-gray-700"}>
                      {req.state}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog open={open && selectedReq?.id === req.id} onOpenChange={(v) => { setOpen(v); if (!v) setRejectReason(""); }}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setSelectedReq(req); setOpen(true); }}
                        >
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle className="text-brand-blue">
                            Review — {selectedReq?.name || `#${selectedReq?.id}`}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-3 py-4 text-sm">
                          {[
                            ["Requested By", selectedReq?.employee_name],
                            ["Purpose", selectedReq?.purpose],
                            ["From", selectedReq?.pickup_location],
                            ["To", selectedReq?.destination_location],
                            ["Passengers", selectedReq?.passenger_count],
                            ["Trip Type", selectedReq?.trip_type],
                            ["Priority", selectedReq?.priority],
                            ["Start", selectedReq?.start_datetime ? new Date(selectedReq.start_datetime).toLocaleString() : "—"],
                            ["End", selectedReq?.end_datetime ? new Date(selectedReq.end_datetime).toLocaleString() : "—"],
                          ].map(([label, value]) => (
                            <div key={label} className="grid grid-cols-2 border-b pb-2">
                              <span className="text-gray-500">{label}:</span>
                              <span className="font-bold">{value || "—"}</span>
                            </div>
                          ))}
                          <div className="space-y-2 pt-2">
                            <label className="text-sm font-bold">Rejection Reason (if rejecting)</label>
                            <Textarea
                              placeholder="Add reason for rejection..."
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                            />
                          </div>
                        </div>
                        {selectedReq?.state === "pending" && (
                          <DialogFooter className="flex gap-2">
                            <Button
                              className="bg-red-600 hover:bg-red-700 flex-1"
                              disabled={actionLoading}
                              onClick={() => handleReject(selectedReq.id)}
                            >
                              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><XCircle className="mr-2 h-4 w-4" /> Reject</>}
                            </Button>
                            <Button
                              className="bg-brand-blue hover:bg-blue-800 flex-1"
                              disabled={actionLoading}
                              onClick={() => handleApprove(selectedReq.id)}
                            >
                              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="mr-2 h-4 w-4" /> Approve</>}
                            </Button>
                          </DialogFooter>
                        )}
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

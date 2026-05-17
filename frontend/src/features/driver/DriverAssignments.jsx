import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { driverMobileApi } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Truck, MapPin, Play, CheckCircle2, RefreshCw, Loader2,
  Navigation, Fuel, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const STATE_STYLES = {
  assigned: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
};

function TripDetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
      <TripDetailRowContent label={label} value={value} />
    </div>
  );
}

function TripDetailRowContent({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase">{label}</p>
      <p className="text-gray-700">{value}</p>
    </div>
  );
}

function AssignmentCard({ assignment, actionId, onStart, onComplete }) {
  const trip = assignment.trip_request || {};
  const vehicle = assignment.vehicle || {};
  const canStart = assignment.state === "assigned";
  const canComplete = assignment.state === "in_progress";

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-black text-brand-blue">
            {trip.purpose || `Assignment #${assignment.id}`}
          </CardTitle>
          <Badge className={cn("capitalize shrink-0", STATE_STYLES[assignment.state] || "bg-gray-100")}>
            {assignment.state?.replace("_", " ")}
          </Badge>
        </div>
        <p className="text-xs text-gray-500">Requester: {trip.requester || "—"}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <TripDetailRow icon={MapPin} label="Pickup" value={trip.pickup_location || "—"} />
          <TripDetailRow icon={MapPin} label="Destination" value={trip.destination_location || "—"} />
          <TripDetailRow
            icon={Truck}
            label="Vehicle"
            value={`${vehicle.name || "—"} (${vehicle.license_plate || "—"})`}
          />
          <TripDetailRow
            icon={Clock}
            label="Scheduled"
            value={
              trip.start_datetime
                ? format(new Date(trip.start_datetime), "MMM d, yyyy HH:mm")
                : "—"
            }
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {canStart && (
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
              disabled={actionId === assignment.id}
              onClick={() => onStart(assignment.id)}
            >
              {actionId === assignment.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1" /> Start Trip
                </>
              )}
            </Button>
          )}
          {canComplete && (
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => onComplete(assignment)}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Complete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DriverAssignments() {
  const { isDriver, meta } = usePermissions();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [completeForm, setCompleteForm] = useState({
    actual_distance: "",
    end_odometer: "",
    notes: "",
  });

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await driverMobileApi.assignments();
      setAssignments(res.assignments || []);
    } catch (err) {
      if (isDriver) toast.error(err.message || "Could not load assignments");
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [isDriver]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleStart = async (id) => {
    setActionId(id);
    try {
      await driverMobileApi.startTrip(id);
      toast.success("Trip started");
      fetchAssignments();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionId(null);
    }
  };

  const openComplete = (assignment) => {
    setSelected(assignment);
    setCompleteForm({ actual_distance: "", end_odometer: "", notes: "" });
    setCompleteOpen(true);
  };

  const handleComplete = async () => {
    if (!selected) return;
    setActionId(selected.id);
    try {
      await driverMobileApi.completeTrip(selected.id, {
        actual_distance: parseFloat(completeForm.actual_distance) || 0,
        end_odometer: parseFloat(completeForm.end_odometer) || 0,
        notes: completeForm.notes,
      });
      toast.success("Trip completed");
      setCompleteOpen(false);
      fetchAssignments();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionId(null);
    }
  };

  const active = assignments.filter((a) => a.state === "in_progress").length;
  const pending = assignments.filter((a) => a.state === "assigned").length;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DriverAssignmentsIcon meta={meta} />
          <div>
            <h1 className="text-2xl font-black text-brand-blue">My Assignments</h1>
            <p className="text-sm text-gray-400">Start, run, and complete assigned trips</p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchAssignments} className="rounded-xl">
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active", value: active, cls: "bg-purple-50 border-purple-100 text-purple-700" },
          { label: "Ready", value: pending, cls: "bg-blue-50 border-blue-100 text-blue-700" },
          { label: "Total", value: assignments.length, cls: "bg-white border" },
        ].map((s) => (
          <div key={s.label} className={cn("rounded-2xl border p-4 text-center", s.cls)}>
            <p className="text-xs uppercase font-bold opacity-70">{s.label}</p>
            <p className="text-2xl font-black">{loading ? "—" : s.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
        </div>
      ) : assignments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-gray-500">
            No active assignments yet.
            <Link to="/my-requests" className="block text-brand-blue font-bold mt-2 hover:underline">
              View my requests →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {assignments.map((a) => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              actionId={actionId}
              onStart={handleStart}
              onComplete={openComplete}
            />
          ))}
        </div>
      )}

      <DriverQuickLinks />

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Trip</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Distance (km)</label>
              <Input
                type="number"
                value={completeForm.actual_distance}
                onChange={(e) =>
                  setCompleteForm((f) => ({ ...f, actual_distance: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">End odometer</label>
              <Input
                type="number"
                value={completeForm.end_odometer}
                onChange={(e) =>
                  setCompleteForm((f) => ({ ...f, end_odometer: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Notes</label>
              <Textarea
                value={completeForm.notes}
                onChange={(e) => setCompleteForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>Cancel</Button>
            <Button className="bg-brand-blue" disabled={!!actionId} onClick={handleComplete}>
              Complete Trip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DriverAssignmentsIcon({ meta }) {
  return (
    <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center text-white", meta.headerBg)}>
      <Truck className="h-5 w-5" />
    </div>
  );
}

function DriverQuickLinks() {
  return (
    <div className="flex gap-2">
      <Link to="/tracking">
        <Button variant="outline" className="rounded-xl">
          <Navigation className="h-4 w-4 mr-2" /> GPS
        </Button>
      </Link>
      <Link to="/fuel-log">
        <Button variant="outline" className="rounded-xl">
          <Fuel className="h-4 w-4 mr-2" /> Fuel Log
        </Button>
      </Link>
    </div>
  );
}

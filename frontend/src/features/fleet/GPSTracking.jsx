/**
 * FR-3.1: Assigned Route Display
 * FR-3.2: Real-Time GPS Integration (10s poll + Refresh button)
 * FR-3.3: Collaborative Pickup — shows co-passengers on same vehicle/assignment
 * FR-3.4: Dynamic Pickup Point Update — calls backend to persist change
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { fleetApi, tripApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  MapPin, Navigation, RefreshCw, Loader2, Car, Activity,
  AlertCircle, CheckCircle2, Edit3, Clock, Users,
} from "lucide-react";
import { toast } from "sonner";
import { tripApi as tripApiFull } from "@/lib/api";

const STATUS_DOT = {
  available:   "bg-green-500",
  in_use:      "bg-blue-500",
  maintenance: "bg-red-500",
  unavailable: "bg-gray-400",
};

const STATUS_PULSE = {
  available: false,
  in_use:    true,
  maintenance: false,
  unavailable: false,
};

const STALE_MINUTES = 5;

function isStale(lastUpdate) {
  if (!lastUpdate) return true;
  return (Date.now() - new Date(lastUpdate).getTime()) / 60000 > STALE_MINUTES;
}

function VehicleCard({ vehicle, onSelect, selected }) {
  const stale = isStale(vehicle.current_location?.last_update);
  const hasGPS = vehicle.current_location?.latitude && vehicle.current_location?.longitude;
  return (
    <div
      onClick={() => onSelect(vehicle)}
      className={`p-3 rounded-xl border cursor-pointer transition-all animate-fade-in-up ${selected?.id === vehicle.id ? "border-brand-blue bg-blue-50 shadow-md" : "border-gray-200 bg-white hover:border-brand-blue hover:shadow-sm"}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="relative shrink-0 w-2.5 h-2.5">
          <span className={`w-2.5 h-2.5 rounded-full block ${STATUS_DOT[vehicle.mesob_status] || "bg-gray-400"}`} />
          {STATUS_PULSE[vehicle.mesob_status] && (
            <span className={`absolute inset-0 rounded-full ${STATUS_DOT[vehicle.mesob_status]} opacity-50 animate-ping`} />
          )}
        </div>
        <p className="font-bold text-sm text-gray-800 truncate flex-1">{vehicle.name}</p>
        {stale && hasGPS && <AlertCircle className="h-3.5 w-3.5 text-gray-400 shrink-0" title="GPS stale" />}
      </div>
      <p className="text-xs text-gray-500 font-mono">{vehicle.license_plate}</p>
      {hasGPS ? (
        <div className="mt-2 text-xs text-gray-500 space-y-0.5">
          <p className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {vehicle.current_location.latitude.toFixed(4)}, {vehicle.current_location.longitude.toFixed(4)}
          </p>
          {vehicle.current_location.last_update && (
            <p className={`flex items-center gap-1 ${stale ? "text-gray-400" : "text-green-600"}`}>
              <Clock className="h-3 w-3" />
              {stale ? "Stale — " : ""}{new Date(vehicle.current_location.last_update).toLocaleTimeString()}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-xs text-gray-400 flex items-center gap-1"><MapPin className="h-3 w-3" /> No GPS data</p>
      )}
      {vehicle.assigned_driver && (
        <p className="mt-1 text-xs text-brand-blue font-medium">{vehicle.assigned_driver}</p>
      )}
    </div>
  );
}

// FR-3.3: Co-passenger pickup points panel
function CoPassengerPanel({ tripId }) {
  const [coPassengers, setCoPassengers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) return;
    tripApiFull.coPassengers(tripId)
      .then(res => setCoPassengers(res.co_passengers || []))
      .catch(() => setCoPassengers([]))
      .finally(() => setLoading(false));
  }, [tripId]);

  if (loading) {
    return (
      <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
        <p className="text-xs font-black text-purple-700 uppercase flex items-center gap-1 mb-2">
          <Users className="h-3.5 w-3.5" /> Co-Passengers
        </p>
        <div className="h-8 bg-purple-100 animate-pulse rounded" />
      </div>
    );
  }

  if (coPassengers.length === 0) {
    return (
      <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
        <p className="text-xs font-black text-purple-700 uppercase flex items-center gap-1 mb-1">
          <Users className="h-3.5 w-3.5" /> Co-Passengers (FR-3.3)
        </p>
        <p className="text-xs text-gray-400">No other passengers on this trip</p>
      </div>
    );
  }

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
      <p className="text-xs font-black text-purple-700 uppercase flex items-center gap-2 mb-3">
        <Users className="h-3.5 w-3.5" /> Co-Passengers — {coPassengers.length} sharing this vehicle
      </p>
      <div className="space-y-2">
        {coPassengers.map(cp => (
          <div key={cp.id} className="bg-white rounded-lg border border-purple-100 p-2.5 flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-purple-200 flex items-center justify-center shrink-0 mt-0.5">
              <Users className="h-3 w-3 text-purple-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-800">{cp.name}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{cp.pickup_location || "—"}</span>
              </p>
              {cp.pickup_updated && (
                <Badge className="mt-1 text-[10px] bg-orange-100 text-orange-700 border-orange-200">
                  Pickup updated
                </Badge>
              )}
              {cp.pickup_update_note && (
                <p className="text-[10px] text-gray-400 mt-0.5 italic">{cp.pickup_update_note}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GPSTracking() {
  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickupDialog, setPickupDialog] = useState(false);
  const [newPickup, setNewPickup] = useState("");
  const [pickupNote, setPickupNote] = useState("");
  const [pickupSaving, setPickupSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const intervalRef = useRef(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [vRes, tRes] = await Promise.all([fleetApi.list(), tripApi.list()]);
      setVehicles(vRes.vehicles || []);
      setTrips((tRes.trip_requests || []).filter(t =>
        ["approved", "assigned", "in_progress"].includes(t.state)
      ));
    } catch (err) {
      if (!silent) toast.error("Failed to load tracking data: " + err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(() => fetchData(true), 10000);
    return () => clearInterval(intervalRef.current);
  }, [fetchData]);

  useEffect(() => {
    if (selected) {
      const updated = vehicles.find(v => v.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [vehicles]);

  const filtered = vehicles.filter(v => filterStatus === "all" || v.mesob_status === filterStatus);
  const activeVehicles = vehicles.filter(v => v.mesob_status === "in_use");
  const withGPS = vehicles.filter(v => v.current_location?.latitude);
  const activeTripForSelected = selected ? trips.find(t => t.assigned_vehicle === selected.name) : null;

  // FR-3.4: Update pickup — calls real backend
  const handlePickupUpdate = async () => {
    if (!newPickup.trim()) { toast.error("Enter a pickup location"); return; }
    if (!activeTripForSelected) { toast.error("No active trip found"); return; }
    setPickupSaving(true);
    try {
      await tripApi.updatePickup(activeTripForSelected.id, newPickup, pickupNote);
      toast.success("Pickup point updated — driver has been notified");
      setPickupDialog(false);
      setNewPickup("");
      setPickupNote("");
      fetchData(true);
    } catch (err) {
      toast.error(err.message || "Failed to update pickup");
    } finally {
      setPickupSaving(false);
    }
  };

  const mapUrl = selected?.current_location?.latitude && selected?.current_location?.longitude
    ? (() => {
        const lat = selected.current_location.latitude;
        const lng = selected.current_location.longitude;
        return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.02}%2C${lat - 0.02}%2C${lng + 0.02}%2C${lat + 0.02}&layer=mapnik&marker=${lat}%2C${lng}`;
      })()
    : null;

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-brand-blue flex items-center gap-2">
            <Navigation className="h-6 w-6" /> GPS Tracking
          </h1>
          <p className="text-sm text-gray-400">Live positions · auto-refreshes every 10s</p>
        </div>
        <button onClick={() => fetchData(true)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-brand-blue bg-white border rounded-xl px-3 py-2 shadow-sm">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active Trips", value: activeVehicles.length, color: "text-blue-600", bg: "bg-blue-50", icon: Activity },
          { label: "GPS Online",   value: withGPS.length,        color: "text-green-600", bg: "bg-green-50", icon: MapPin },
          { label: "Total Fleet",  value: vehicles.length,       color: "text-brand-blue", bg: "bg-white",   icon: Car },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 border shadow-sm flex items-center gap-3`}>
            <s.icon className={`h-5 w-5 ${s.color}`} />
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold">{s.label}</p>
              <p className={`text-2xl font-black ${s.color}`}>
                {loading ? <span className="inline-block w-8 h-6 bg-gray-100 animate-pulse rounded" /> : s.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Vehicle List */}
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {["all", "in_use", "available", "maintenance"].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${filterStatus === s ? "bg-brand-blue text-white border-brand-blue" : "bg-white text-gray-600 border-gray-200"}`}>
                {s === "all" ? "All" : s.replace("_", " ")}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-xl" />)}</div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No vehicles found</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {filtered.map(v => <VehicleCard key={v.id} vehicle={v} onSelect={setSelected} selected={selected} />)}
            </div>
          )}
        </div>

        {/* Map + Trip Detail */}
        <div className="lg:col-span-2 space-y-4">
          {/* Map */}
          <div className="bg-white rounded-2xl border shadow-md overflow-hidden">
            <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-700">
                {selected ? `${selected.name} — Live Position` : "Select a vehicle to view on map"}
              </p>
              {selected && (
                isStale(selected.current_location?.last_update)
                  ? <Badge className="bg-gray-200 text-gray-600 text-xs">GPS Stale</Badge>
                  : <Badge className="bg-green-100 text-green-700 text-xs flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Live</Badge>
              )}
            </div>
            <div className="h-72 bg-gray-100 flex items-center justify-center">
              {!selected ? (
                <div className="text-center text-gray-400">
                  <MapPin className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Select a vehicle from the list</p>
                </div>
              ) : !mapUrl ? (
                <div className="text-center text-gray-400">
                  <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No GPS coordinates available</p>
                  <p className="text-xs mt-1">GPS device may be offline</p>
                </div>
              ) : (
                <iframe title={`GPS Map — ${selected.name}`} src={mapUrl} className="w-full h-full border-0" loading="lazy" />
              )}
            </div>
          </div>

          {/* Active Trip Detail */}
          {selected && activeTripForSelected && (
            <div className="bg-white rounded-2xl border shadow-md p-4 space-y-3">
              <h3 className="font-black text-sm text-brand-blue uppercase tracking-widest">Active Trip</h3>

              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Request", activeTripForSelected.name || `#${activeTripForSelected.id}`],
                  ["Status", activeTripForSelected.state?.replace("_", " ")],
                  ["Requester", activeTripForSelected.employee_name],
                  ["Priority", activeTripForSelected.priority],
                ].map(([label, value]) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-2.5">
                    <p className="text-xs text-gray-400 font-bold uppercase">{label}</p>
                    <p className="text-sm font-bold text-gray-800 capitalize">{value || "—"}</p>
                  </div>
                ))}
              </div>

              {/* FR-3.1: Route */}
              <div className="bg-brand-blue/5 rounded-xl p-3 border border-brand-blue/10">
                <p className="text-xs text-gray-400 font-bold uppercase mb-2 flex items-center gap-1">
                  <Navigation className="h-3 w-3" /> Route
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex-1">
                    <p className="text-xs text-gray-400">From</p>
                    <p className="font-bold text-gray-800">{activeTripForSelected.pickup_location || "—"}</p>
                  </div>
                  <div className="text-brand-blue font-black">→</div>
                  <div className="flex-1 text-right">
                    <p className="text-xs text-gray-400">To</p>
                    <p className="font-bold text-gray-800">{activeTripForSelected.destination_location || "—"}</p>
                  </div>
                </div>
              </div>

              {/* FR-3.3: Co-passengers */}
              <CoPassengerPanel tripId={activeTripForSelected.id} />

              {/* FR-3.4: Update pickup */}
              <Button variant="outline" size="sm" className="w-full rounded-xl border-brand-blue text-brand-blue hover:bg-brand-blue hover:text-white"
                onClick={() => { setNewPickup(activeTripForSelected.pickup_location || ""); setPickupDialog(true); }}>
                <Edit3 className="h-4 w-4 mr-2" /> Update My Pickup Point
              </Button>
            </div>
          )}

          {/* Vehicle status when no active trip */}
          {selected && !activeTripForSelected && (
            <div className="bg-white rounded-2xl border shadow-md p-4">
              <h3 className="font-black text-sm text-brand-blue uppercase tracking-widest mb-3">Vehicle Status</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Status", selected.mesob_status?.replace("_", " ")],
                  ["Driver", selected.assigned_driver || "Unassigned"],
                  ["Odometer", `${selected.current_odometer?.toLocaleString()} km`],
                  ["Category", selected.vehicle_category?.replace("_", " ")],
                ].map(([label, value]) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-2.5">
                    <p className="text-xs text-gray-400 font-bold uppercase">{label}</p>
                    <p className="text-sm font-bold text-gray-800 capitalize">{value || "—"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FR-3.4: Pickup Update Dialog */}
      <Dialog open={pickupDialog} onOpenChange={v => !v && setPickupDialog(false)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-brand-blue font-black flex items-center gap-2">
              <Edit3 className="h-5 w-5" /> Update Pickup Point
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-500">Adjust your exact pickup location. The driver will be notified immediately.</p>
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-600 uppercase">New Pickup Location *</label>
              <Input placeholder="e.g. MESSOB Center, Main Entrance, Gate B"
                value={newPickup} onChange={e => setNewPickup(e.target.value)} className="rounded-xl h-11" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-600 uppercase">Note for Driver (optional)</label>
              <Input placeholder="e.g. I'll be at the blue gate on the left side"
                value={pickupNote} onChange={e => setPickupNote(e.target.value)} className="rounded-xl h-11" />
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800">
              Co-passengers on this trip will also see your updated pickup point.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickupDialog(false)}>Cancel</Button>
            <Button className="bg-brand-blue hover:bg-blue-800" disabled={pickupSaving || !newPickup.trim()} onClick={handlePickupUpdate}>
              {pickupSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="mr-2 h-4 w-4" /> Confirm Update</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

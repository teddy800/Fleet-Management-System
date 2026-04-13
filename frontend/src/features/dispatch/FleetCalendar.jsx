/**
 * FR-2.3: Fleet Availability Grid
 * Shows all vehicles and their scheduled trips on a weekly timeline.
 * Vehicles are rows; columns are days; colored blocks = occupied/maintenance.
 */
import { useEffect, useState } from "react";
import { fleetApi, tripApi } from "@/lib/api";
import { Loader2, ChevronLeft, ChevronRight, Car } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const STATUS_COLORS = {
  available:   "bg-green-100 text-green-700 border-green-200",
  in_use:      "bg-blue-100 text-blue-700 border-blue-200",
  maintenance: "bg-red-100 text-red-700 border-red-200",
  unavailable: "bg-gray-100 text-gray-500 border-gray-200",
};

const TRIP_STATE_COLORS = {
  pending:     "bg-yellow-400 text-yellow-900",
  approved:    "bg-blue-500 text-white",
  assigned:    "bg-indigo-500 text-white",
  in_progress: "bg-green-500 text-white",
  completed:   "bg-gray-400 text-white",
};

function getWeekDays(startDate) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function tripOverlapsDay(trip, day) {
  if (!trip.start_datetime || !trip.end_datetime) return false;
  const start = new Date(trip.start_datetime);
  const end = new Date(trip.end_datetime);
  const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
  return start <= dayEnd && end >= dayStart;
}

export default function FleetCalendar() {
  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1); // Monday
    d.setHours(0, 0, 0, 0);
    return d;
  });

  useEffect(() => {
    Promise.all([fleetApi.list(), tripApi.list()])
      .then(([vRes, tRes]) => {
        setVehicles(vRes.vehicles || []);
        setTrips((tRes.trip_requests || []).filter(t =>
          ["approved", "assigned", "in_progress"].includes(t.state)
        ));
      })
      .catch(err => toast.error("Failed to load calendar: " + err.message))
      .finally(() => setLoading(false));
  }, []);

  const days = getWeekDays(weekStart);
  const today = new Date();

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  // Map vehicle id → trips
  // Prefer assigned_vehicle_id (numeric), fall back to name matching
  const tripsByVehicle = {};
  trips.forEach((trip) => {
    let vehicleId = trip.assigned_vehicle_id;
    if (!vehicleId && trip.assigned_vehicle) {
      const match = vehicles.find(v => v.name === trip.assigned_vehicle);
      vehicleId = match?.id;
    }
    if (!vehicleId) return;
    if (!tripsByVehicle[vehicleId]) tripsByVehicle[vehicleId] = [];
    const stateColor = TRIP_STATE_COLORS[trip.state] || "bg-blue-400 text-white";
    tripsByVehicle[vehicleId].push({ ...trip, _color: stateColor });
  });

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-brand-blue">Fleet Availability Grid</h2>
          <p className="text-sm text-gray-400">Weekly view — click a vehicle row to see trip details</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="p-2 rounded-xl border bg-white hover:bg-gray-50 shadow-sm">
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
          <span className="text-sm font-bold text-gray-700 px-2">
            {days[0].toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} –{" "}
            {days[6].toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
          <button onClick={nextWeek} className="p-2 rounded-xl border bg-white hover:bg-gray-50 shadow-sm">
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs font-bold">
        {Object.entries(STATUS_COLORS).map(([status, cls]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-full border ${cls}`} />
            <span className="text-gray-600 capitalize">{status.replace("_", " ")}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-400" />
          <span className="text-gray-600">Scheduled Trip</span>
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-2xl shadow-md border overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-brand-blue" />
          </div>
        ) : (
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 text-xs font-black text-gray-500 uppercase w-44">Vehicle</th>
                {days.map(day => (
                  <th key={day.toISOString()} className={`text-center px-2 py-3 text-xs font-black uppercase ${isSameDay(day, today) ? "text-brand-blue bg-blue-50" : "text-gray-500"}`}>
                    <div>{day.toLocaleDateString("en-GB", { weekday: "short" })}</div>
                    <div className={`text-lg font-black ${isSameDay(day, today) ? "text-brand-blue" : "text-gray-700"}`}>
                      {day.getDate()}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vehicles.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">No vehicles found</td></tr>
              ) : vehicles.map(vehicle => {
                const vehicleTrips = tripsByVehicle[vehicle.id] || [];
                const sm = STATUS_COLORS[vehicle.mesob_status] || STATUS_COLORS.unavailable;
                return (
                  <tr key={vehicle.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-brand-blue/10 flex items-center justify-center shrink-0">
                          <Car className="h-3.5 w-3.5 text-brand-blue" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">{vehicle.name}</p>
                          <Badge className={`text-[10px] border mt-0.5 ${sm}`}>
                            {vehicle.mesob_status?.replace("_", " ")}
                          </Badge>
                        </div>
                      </div>
                    </td>
                    {days.map(day => {
                      const dayTrips = vehicleTrips.filter(t => tripOverlapsDay(t, day));
                      const isToday = isSameDay(day, today);
                      return (
                        <td key={day.toISOString()} className={`px-1 py-2 text-center align-middle ${isToday ? "bg-blue-50/50" : ""}`}>
                          {vehicle.mesob_status === "maintenance" ? (
                            <div className="mx-auto w-full h-7 rounded bg-red-100 border border-red-200 flex items-center justify-center">
                              <span className="text-[9px] font-bold text-red-600">MAINT</span>
                            </div>
                          ) : dayTrips.length > 0 ? (
                            <div className="space-y-0.5">
                              {dayTrips.map(trip => (
                                <div key={trip.id} title={`${trip.name}: ${trip.pickup_location} → ${trip.destination_location}`}
                                  className={`mx-auto w-full h-7 rounded ${trip._color} flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity animate-scale-in`}>
                                  <span className="text-[9px] font-black text-white truncate px-1">{trip.name || `#${trip.id}`}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mx-auto w-full h-7 rounded bg-green-50 border border-green-100 flex items-center justify-center">
                              <span className="text-[9px] font-bold text-green-500">FREE</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

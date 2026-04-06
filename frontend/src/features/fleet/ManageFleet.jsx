import { useEffect, useState } from "react";
import { fleetApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Car, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS = {
  available: "bg-green-100 text-green-700 border-green-200",
  in_use: "bg-blue-100 text-blue-700 border-blue-200",
  maintenance: "bg-red-100 text-red-700 border-red-200",
  unavailable: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function ManageFleet() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fleetApi.list()
      .then((res) => setVehicles(res.vehicles || []))
      .catch((err) => toast.error("Failed to load fleet: " + err.message))
      .finally(() => setLoading(false));
  }, []);

  const available = vehicles.filter((v) => v.mesob_status === "available").length;
  const inUse = vehicles.filter((v) => v.mesob_status === "in_use").length;
  const maintenanceDue = vehicles.filter((v) => v.maintenance_due).length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-blue">Manage Fleet</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: vehicles.length, color: "text-brand-blue" },
          { label: "Available", value: available, color: "text-green-600" },
          { label: "In Use", value: inUse, color: "text-blue-600" },
          { label: "Maintenance Due", value: maintenanceDue, color: "text-red-600" },
        ].map((s) => (
          <Card key={s.label} className="p-4 text-center shadow-sm">
            <p className="text-xs text-gray-500 uppercase font-bold">{s.label}</p>
            <p className={`text-3xl font-black mt-1 ${s.color}`}>
              {loading ? <span className="inline-block w-8 h-7 bg-gray-100 animate-pulse rounded" /> : s.value}
            </p>
          </Card>
        ))}
      </div>

      {/* Vehicle table */}
      <div className="bg-white rounded-xl shadow-md border overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="font-bold">Vehicle</TableHead>
              <TableHead className="font-bold">Plate</TableHead>
              <TableHead className="font-bold">Category</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="font-bold">Driver</TableHead>
              <TableHead className="font-bold">Odometer</TableHead>
              <TableHead className="font-bold">Efficiency</TableHead>
              <TableHead className="font-bold">Maintenance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-brand-blue" />
                </TableCell>
              </TableRow>
            ) : vehicles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-gray-400">
                  No vehicles found
                </TableCell>
              </TableRow>
            ) : (
              vehicles.map((v) => (
                <TableRow key={v.id} className="hover:bg-gray-50 transition-colors">
                  <TableCell className="font-medium flex items-center gap-2">
                    <Car className="h-4 w-4 text-brand-blue shrink-0" />
                    {v.name}
                  </TableCell>
                  <TableCell className="text-sm font-mono">{v.license_plate}</TableCell>
                  <TableCell className="text-sm capitalize">{v.vehicle_category?.replace("_", " ")}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs border ${STATUS_COLORS[v.mesob_status] || "bg-gray-100 text-gray-600"}`}>
                      {v.mesob_status?.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{v.assigned_driver || <span className="text-gray-400">Unassigned</span>}</TableCell>
                  <TableCell className="text-sm">{v.current_odometer?.toLocaleString()} km</TableCell>
                  <TableCell className="text-sm">{v.fuel_efficiency?.toFixed(2)} KM/L</TableCell>
                  <TableCell>
                    {v.maintenance_due ? (
                      <span className="flex items-center gap-1 text-red-600 text-xs font-bold">
                        <AlertCircle className="h-3.5 w-3.5" /> Due
                      </span>
                    ) : (
                      <span className="text-green-600 text-xs font-bold">OK</span>
                    )}
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

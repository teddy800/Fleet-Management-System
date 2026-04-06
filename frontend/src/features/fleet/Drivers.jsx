/**
 * Driver Management
 * Lists all drivers with license info, active trips, performance metrics
 * Backend: /api/fleet/drivers
 */
import { useEffect, useState } from "react";
import { driverApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Search, RefreshCw, Loader2, CheckCircle2, AlertCircle, Car } from "lucide-react";
import { toast } from "sonner";

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const res = await driverApi.list();
      setDrivers(res.drivers || []);
    } catch (err) {
      toast.error("Failed to load drivers: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDrivers(); }, []);

  const filtered = drivers.filter(d =>
    !search || d.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.license_number?.toLowerCase().includes(search.toLowerCase())
  );

  const available = drivers.filter(d => d.active_trips === 0).length;
  const onTrip = drivers.filter(d => d.active_trips > 0).length;

  const isLicenseExpiringSoon = (expiry) => {
    if (!expiry) return false;
    const days = (new Date(expiry) - new Date()) / (1000 * 60 * 60 * 24);
    return days <= 30 && days > 0;
  };

  const isLicenseExpired = (expiry) => {
    if (!expiry) return false;
    return new Date(expiry) < new Date();
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center">
            <Users className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-brand-blue">Driver Management</h1>
            <p className="text-sm text-gray-400">{drivers.length} registered drivers</p>
          </div>
        </div>
        <button onClick={fetchDrivers} className="p-2 rounded-xl border bg-white hover:bg-gray-50 shadow-sm">
          <RefreshCw className={`h-4 w-4 text-gray-500 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Drivers", value: drivers.length, color: "text-brand-blue", bg: "bg-white" },
          { label: "Available", value: available, color: "text-green-600", bg: "bg-green-50" },
          { label: "On Trip", value: onTrip, color: "text-blue-600", bg: "bg-blue-50" },
        ].map(s => (
          <Card key={s.label} className={`border-0 shadow-sm ${s.bg}`}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500 uppercase font-bold">{s.label}</p>
              <p className={`text-2xl font-black mt-1 ${s.color}`}>
                {loading ? <span className="inline-block w-8 h-6 bg-gray-100 animate-pulse rounded" /> : s.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <Input placeholder="Search driver, license..." className="pl-9 h-10 rounded-xl border-gray-200" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-md border overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              {["Driver", "License Number", "License Expiry", "Active Trips", "Status"].map(h => (
                <TableHead key={h} className="font-black text-xs uppercase text-gray-500">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-16"><Loader2 className="h-7 w-7 animate-spin mx-auto text-brand-blue" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-16">
                  <Users className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                  <p className="text-gray-400 text-sm">No drivers found</p>
                  <p className="text-xs text-gray-300 mt-1">Drivers are synced from the HR system</p>
                </TableCell>
              </TableRow>
            ) : filtered.map(d => {
              const expired = isLicenseExpired(d.license_expiry);
              const expiringSoon = isLicenseExpiringSoon(d.license_expiry);
              return (
                <TableRow key={d.id} className="hover:bg-gray-50 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-brand-blue flex items-center justify-center text-white text-xs font-black">
                        {d.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <span className="font-bold text-sm text-gray-800">{d.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-gray-600">{d.license_number || "—"}</TableCell>
                  <TableCell>
                    {d.license_expiry ? (
                      <span className={`text-sm font-medium ${expired ? "text-red-600" : expiringSoon ? "text-orange-600" : "text-gray-600"}`}>
                        {new Date(d.license_expiry).toLocaleDateString("en-GB")}
                        {expired && " (Expired)"}
                        {expiringSoon && " (Expiring soon)"}
                      </span>
                    ) : <span className="text-gray-300 text-sm">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Car className={`h-3.5 w-3.5 ${d.active_trips > 0 ? "text-blue-500" : "text-gray-300"}`} />
                      <span className="text-sm font-bold">{d.active_trips}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {d.active_trips > 0 ? (
                      <Badge className="bg-blue-100 text-blue-700 text-xs">On Trip</Badge>
                    ) : expired ? (
                      <Badge className="bg-red-100 text-red-700 text-xs flex items-center gap-1 w-fit">
                        <AlertCircle className="h-3 w-3" /> License Expired
                      </Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-700 text-xs flex items-center gap-1 w-fit">
                        <CheckCircle2 className="h-3 w-3" /> Available
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

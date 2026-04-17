/**
 * Driver Management
 * Lists all drivers with license info, active trips, performance metrics
 * Backend: /api/fleet/drivers
 */
import { useEffect, useState, useMemo } from "react";
import { driverApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Search, RefreshCw, Loader2, CheckCircle2, Car, Shield } from "lucide-react";
import { toast } from "sonner";

const AVATAR_COLORS = [
  "bg-blue-500", "bg-purple-500", "bg-teal-500", "bg-indigo-500",
  "bg-pink-500", "bg-orange-500", "bg-green-600", "bg-red-500",
];

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < (name?.length || 0); i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function LicenseExpiryBar({ expiry }) {
  if (!expiry) return <span className="text-gray-300 text-xs">—</span>;
  const now = new Date();
  const exp = new Date(expiry);
  const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
  const expired = daysLeft <= 0;
  const critical = daysLeft > 0 && daysLeft <= 30;
  const warning = daysLeft > 30 && daysLeft <= 90;

  const barColor = expired ? "bg-red-500" : critical ? "bg-orange-500" : warning ? "bg-yellow-500" : "bg-green-500";
  const textColor = expired ? "text-red-600" : critical ? "text-orange-600" : warning ? "text-yellow-600" : "text-green-600";
  const pct = expired ? 100 : Math.max(0, Math.min(100, (1 - daysLeft / 365) * 100));

  return (
    <div className="space-y-1 min-w-[120px]">
      <div className="flex justify-between items-center">
        <span className={`text-xs font-bold ${textColor}`}>
          {expired ? "Expired" : `${daysLeft}d left`}
        </span>
        <span className="text-[10px] text-gray-400">{exp.toLocaleDateString("en-GB")}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const res = await driverApi.list();
      // Deduplicate: prefer record with a license number; deduplicate by name
      const byName = new Map();
      (res.drivers || []).forEach(d => {
        const key = d.name?.trim().toLowerCase();
        if (!byName.has(key)) {
          byName.set(key, d);
        } else {
          // Keep the one with a license number, or the one with a later expiry
          const existing = byName.get(key);
          if (!existing.license_number && d.license_number) byName.set(key, d);
        }
      });
      setDrivers(Array.from(byName.values()));
    } catch (err) {
      toast.error("Failed to load drivers: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDrivers(); }, []);

  const filtered = useMemo(() => drivers.filter(d =>
    !search || d.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.license_number?.toLowerCase().includes(search.toLowerCase())
  ), [drivers, search]);

  const available = useMemo(() => drivers.filter(d => d.active_trips === 0).length, [drivers]);
  const onTrip = useMemo(() => drivers.filter(d => d.active_trips > 0).length, [drivers]);
  const expiringSoon = useMemo(() => drivers.filter(d => {
    if (!d.license_expiry) return false;
    const days = (new Date(d.license_expiry) - new Date()) / (1000 * 60 * 60 * 24);
    return days <= 30;
  }).length, [drivers]);

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
        <button onClick={fetchDrivers} className="p-2 rounded-xl border bg-white hover:bg-gray-50 shadow-sm transition-colors">
          <RefreshCw className={`h-4 w-4 text-gray-500 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-children">
        {[
          { label: "Total Drivers", value: drivers.length, color: "text-brand-blue", bg: "bg-white border" },
          { label: "Available", value: available, color: "text-green-600", bg: "gradient-card-green border-green-100" },
          { label: "On Trip", value: onTrip, color: "text-blue-600", bg: "gradient-card-blue border-blue-100" },
          { label: "License Alert", value: expiringSoon, color: "text-orange-600", bg: expiringSoon > 0 ? "gradient-card-amber border-amber-100" : "bg-white border" },
        ].map(s => (
          <Card key={s.label} className={`border shadow-sm animate-fade-in-up ${s.bg}`}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500 uppercase font-black tracking-widest">{s.label}</p>
              <p className={`text-2xl font-black mt-1 ${s.color}`}>
                {loading ? <span className="inline-block w-8 h-6 shimmer rounded" /> : s.value}
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
              const avatarColor = getAvatarColor(d.name);
              const isOnTrip = d.active_trips > 0;
              return (
                <TableRow key={d.id} className="hover:bg-gray-50/80 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full ${avatarColor} flex items-center justify-center text-white text-sm font-black shadow-sm shrink-0`}>
                        {d.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-800">{d.name}</p>
                        {isOnTrip && <p className="text-[10px] text-blue-500 font-bold">Currently on trip</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-gray-400" />
                      <span className="font-mono text-sm text-gray-600">{d.license_number || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <LicenseExpiryBar expiry={d.license_expiry} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Car className={`h-3.5 w-3.5 ${isOnTrip ? "text-blue-500" : "text-gray-300"}`} />
                      <span className="text-sm font-bold">{d.active_trips}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isOnTrip ? (
                      <Badge className="bg-blue-100 text-blue-700 text-xs border border-blue-200 flex items-center gap-1 w-fit">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        On Trip
                      </Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-700 text-xs border border-green-200 flex items-center gap-1 w-fit">
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


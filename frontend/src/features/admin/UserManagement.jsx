/**
 * FR-5.1: User Management — Admin can view users and assign roles
 * FR-5.2: Driver CRUD — Admin can toggle driver status and update license info
 */
import { useEffect, useState, useCallback } from "react";
import { userMgmtApi, driverApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Search, RefreshCw, Loader2, ShieldCheck, Edit3, Car } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ROLE_META = {
  fleet_manager:    { label: "Admin",      cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  fleet_dispatcher: { label: "Dispatcher", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  fleet_user:       { label: "Staff",      cls: "bg-green-100 text-green-700 border-green-200" },
};

function getRoleKey(roles) {
  if (roles.includes("fleet_manager")) return "fleet_manager";
  if (roles.includes("fleet_dispatcher")) return "fleet_dispatcher";
  return "fleet_user";
}

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState(null);
  const [editRole, setEditRole] = useState("");
  const [editDriver, setEditDriver] = useState(null);
  const [driverLicense, setDriverLicense] = useState("");
  const [driverExpiry, setDriverExpiry] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("users");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, dRes] = await Promise.all([userMgmtApi.list(), driverApi.list()]);
      setUsers(uRes.users || []);
      // Deduplicate drivers by name (same person may have multiple HR records)
      const byName = new Map();
      (dRes.drivers || []).forEach(d => {
        const key = d.name?.trim().toLowerCase();
        if (!byName.has(key)) {
          byName.set(key, d);
        } else {
          const existing = byName.get(key);
          if (!existing.license_number && d.license_number) byName.set(key, d);
        }
      });
      setDrivers(Array.from(byName.values()));
    } catch (err) {
      toast.error("Failed to load: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSetRole = async () => {
    if (!editRole) return;
    setSaving(true);
    try {
      await userMgmtApi.setRole(editUser.id, editRole);
      toast.success(`Role updated for ${editUser.name}`);
      setEditUser(null);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDriver = async () => {
    setSaving(true);
    try {
      await driverApi.update(editDriver.id, {
        license_number: driverLicense,
        license_expiry: driverExpiry || null,
      });
      toast.success(`Driver ${editDriver.name} updated`);
      setEditDriver(null);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(u =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredDrivers = drivers.filter(d =>
    !search || d.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-yellow-100 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-yellow-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-brand-blue">User Management</h1>
            <p className="text-sm text-gray-400">{users.length} users · {drivers.length} drivers</p>
          </div>
        </div>
        <button onClick={fetchData} className="p-2 rounded-xl border bg-white hover:bg-gray-50 shadow-sm">
          <RefreshCw className={`h-4 w-4 text-gray-500 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { id: "users",   label: `Users (${users.length})` },
          { id: "drivers", label: `Drivers (${drivers.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-black border-b-2 transition-colors",
              tab === t.id ? "border-brand-blue text-brand-blue" : "border-transparent text-gray-500 hover:text-gray-700"
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <Input placeholder="Search..." className="pl-9 h-10 rounded-xl border-gray-200" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Users Tab */}
      {tab === "users" && (
        <div className="bg-white rounded-2xl shadow-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                {["Name", "Email / Login", "Role", "Driver", "Actions"].map(h => (
                  <TableHead key={h} className="font-black text-xs uppercase text-gray-500">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-16"><Loader2 className="h-7 w-7 animate-spin mx-auto text-brand-blue" /></TableCell></TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-gray-400 text-sm">No users found</TableCell></TableRow>
              ) : filteredUsers.map(u => {
                const roleKey = getRoleKey(u.roles);
                const rm = ROLE_META[roleKey] || ROLE_META.fleet_user;
                return (
                  <TableRow key={u.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-brand-blue flex items-center justify-center text-white text-xs font-black shrink-0">
                          {u.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <span className="font-bold text-sm text-gray-800">{u.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {(u.email || u.login || "").replace(/^mailto:/i, "")}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs border ${rm.cls}`}>{rm.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {u.is_driver
                        ? <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">Driver</Badge>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" className="h-8 rounded-xl text-xs"
                        onClick={() => { setEditUser(u); setEditRole(roleKey); }}>
                        <Edit3 className="h-3.5 w-3.5 mr-1" /> Role
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Drivers Tab */}
      {tab === "drivers" && (
        <div className="bg-white rounded-2xl shadow-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                {["Driver", "License Number", "License Expiry", "Active Trips", "Actions"].map(h => (
                  <TableHead key={h} className="font-black text-xs uppercase text-gray-500">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-16"><Loader2 className="h-7 w-7 animate-spin mx-auto text-brand-blue" /></TableCell></TableRow>
              ) : filteredDrivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <Car className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                    <p className="text-gray-400 text-sm">No drivers found</p>
                    <p className="text-xs text-gray-300 mt-1">Drivers are synced from the HR system</p>
                  </TableCell>
                </TableRow>
              ) : filteredDrivers.map(d => (
                <TableRow key={d.id} className="hover:bg-gray-50 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-black shrink-0">
                        {d.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <span className="font-bold text-sm text-gray-800">{d.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-gray-600">{d.license_number || "—"}</TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {d.license_expiry ? new Date(d.license_expiry).toLocaleDateString("en-GB") : "—"}
                  </TableCell>
                  <TableCell className="text-sm font-bold">{d.active_trips}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" className="h-8 rounded-xl text-xs"
                      onClick={() => {
                        setEditDriver(d);
                        setDriverLicense(d.license_number || "");
                        setDriverExpiry(d.license_expiry ? d.license_expiry.split("T")[0] : "");
                      }}>
                      <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Role Dialog */}
      <Dialog open={!!editUser} onOpenChange={v => !v && setEditUser(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-brand-blue font-black">Change Role — {editUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-xs font-black text-gray-600 uppercase">Assign Role</label>
            <Select value={editRole} onValueChange={setEditRole}>
              <SelectTrigger className="rounded-xl h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fleet_manager">Admin (Fleet Manager)</SelectItem>
                <SelectItem value="fleet_dispatcher">Dispatcher</SelectItem>
                <SelectItem value="fleet_user">Staff (Fleet User)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button className="bg-brand-blue hover:bg-blue-800" disabled={saving} onClick={handleSetRole}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Driver Dialog */}
      <Dialog open={!!editDriver} onOpenChange={v => !v && setEditDriver(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-brand-blue font-black">Edit Driver — {editDriver?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-black text-gray-600 uppercase">License Number</label>
              <Input className="mt-1 rounded-xl h-11" value={driverLicense} onChange={e => setDriverLicense(e.target.value)} placeholder="e.g. DL-123456" />
            </div>
            <div>
              <label className="text-xs font-black text-gray-600 uppercase">License Expiry Date</label>
              <Input type="date" className="mt-1 rounded-xl h-11" value={driverExpiry} onChange={e => setDriverExpiry(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDriver(null)}>Cancel</Button>
            <Button className="bg-brand-blue hover:bg-blue-800" disabled={saving} onClick={handleUpdateDriver}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

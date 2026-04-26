/**
 * FR-4.4 / Inventory Cross-Link: Parts allocation to vehicles
 * Messob Inventory integration — allocate products to fleet vehicles
 * Backend: /api/fleet/inventory/allocations, /api/fleet/inventory/products
 */
import { useEffect, useState, useMemo, useCallback } from "react";
import { inventoryApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Plus, Search, RefreshCw, Loader2, CheckCircle2, Wrench, DollarSign } from "lucide-react";
import { toast } from "sonner";

const STATE_BADGE = {
  allocated: "bg-blue-100 text-blue-700 border-blue-200",
  installed: "bg-green-100 text-green-700 border-green-200",
  returned:  "bg-gray-100 text-gray-600 border-gray-200",
};

export default function Inventory() {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const fetchAllocations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.listAllocations();
      setAllocations(res.allocations || []);
    } catch (err) {
      toast.error("Failed to load allocations: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAllocations(); }, [fetchAllocations]);

  const filtered = useMemo(() => allocations.filter(a =>
    !search ||
    a.vehicle_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.product_name?.toLowerCase().includes(search.toLowerCase())
  ), [allocations, search]);

  const totalCost = useMemo(() => allocations.reduce((s, a) => s + (a.total_cost || 0), 0), [allocations]);
  const installed = useMemo(() => allocations.filter(a => a.state === "installed").length, [allocations]);
  const pending   = useMemo(() => allocations.filter(a => a.state === "allocated").length, [allocations]);

  const handleInstall = async (id) => {
    try {
      await inventoryApi.installPart(id);
      toast.success("Part marked as installed — stock updated in Messob Inventory");
      fetchAllocations();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center">
            <Package className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-brand-blue">Parts & Inventory</h1>
            <p className="text-sm text-gray-400">{allocations.length} allocations · linked to Messob Inventory</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAllocations} className="p-2 rounded-xl border bg-white hover:bg-gray-50 shadow-sm">
            <RefreshCw className={`h-4 w-4 text-gray-500 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Button onClick={() => setShowCreate(true)} className="rounded-xl gap-2 bg-brand-blue hover:bg-brand-blue/90">
            <Plus className="h-4 w-4" /> Allocate Part
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Allocations", value: allocations.length, color: "text-brand-blue", bg: "bg-white border" },
          { label: "Installed",         value: installed,           color: "text-green-600", bg: "bg-green-50 border-green-100" },
          { label: "Pending Install",   value: pending,             color: "text-blue-600",  bg: "bg-blue-50 border-blue-100" },
          { label: "Total Cost (ETB)",  value: totalCost.toLocaleString("en-ET", { maximumFractionDigits: 0 }), color: "text-orange-600", bg: "bg-white border" },
        ].map(s => (
          <Card key={s.label} className={`border shadow-sm ${s.bg}`}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500 uppercase font-black tracking-widest">{s.label}</p>
              <p className={`text-2xl font-black mt-1 ${s.color}`}>
                {loading ? <span className="inline-block w-12 h-6 bg-gray-100 animate-pulse rounded" /> : s.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <Input placeholder="Search vehicle, part..." className="pl-9 h-10 rounded-xl border-gray-200" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="bg-white rounded-2xl shadow-md border overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              {["Vehicle", "Part / Product", "Qty", "Unit Cost", "Total Cost", "Date", "Status", ""].map(h => (
                <TableHead key={h} className="font-black text-xs uppercase text-gray-500">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-16"><Loader2 className="h-7 w-7 animate-spin mx-auto text-brand-blue" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-16">
                  <Package className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                  <p className="text-gray-400 text-sm">No parts allocated yet</p>
                </TableCell>
              </TableRow>
            ) : filtered.map(a => (
              <TableRow key={a.id} className="hover:bg-gray-50/80 transition-colors">
                <TableCell className="font-semibold text-sm">{a.vehicle_name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Wrench className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-sm">{a.product_name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm font-bold">{a.quantity}</TableCell>
                <TableCell className="text-sm text-gray-600">{a.unit_cost?.toLocaleString()}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5 text-gray-400" />
                    <span className="font-bold text-sm">{a.total_cost?.toLocaleString()}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-gray-500">
                  {a.allocation_date ? new Date(a.allocation_date).toLocaleDateString("en-GB") : "—"}
                </TableCell>
                <TableCell>
                  <Badge className={`text-xs border w-fit ${STATE_BADGE[a.state] || STATE_BADGE.allocated}`}>
                    {a.state}
                  </Badge>
                </TableCell>
                <TableCell>
                  {a.state === "allocated" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg" onClick={() => handleInstall(a.id)}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Install
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {showCreate && <CreateAllocationDialog onClose={() => setShowCreate(false)} onCreated={fetchAllocations} />}
    </div>
  );
}

function CreateAllocationDialog({ onClose, onCreated }) {
  const [form, setForm] = useState({ vehicle_id: "", product_id: "", quantity: 1, unit_cost: 0, notes: "" });
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    inventoryApi.searchProducts(productSearch).then(r => setProducts(r.products || [])).catch(() => {});
  }, [productSearch]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vehicle_id || !form.product_id) return toast.error("Vehicle ID and Product are required");
    setSaving(true);
    try {
      await inventoryApi.createAllocation(form);
      toast.success("Parts allocated successfully");
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-orange-500" /> Allocate Part to Vehicle
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="text-xs font-black text-gray-600 uppercase">Vehicle ID</label>
            <Input placeholder="Enter vehicle ID" value={form.vehicle_id} onChange={e => set("vehicle_id", e.target.value)} className="mt-1 rounded-xl" required />
          </div>
          <div>
            <label className="text-xs font-black text-gray-600 uppercase">Search Part (Messob Inventory)</label>
            <Input placeholder="Type to search..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="mt-1 rounded-xl" />
            {products.length > 0 && (
              <div className="mt-1 border rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                {products.map(p => (
                  <button key={p.id} type="button"
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${form.product_id == p.id ? "bg-blue-50 font-bold" : ""}`}
                    onClick={() => { set("product_id", p.id); set("unit_cost", p.list_price || 0); setProductSearch(p.name); }}>
                    <span className="font-medium">{p.name}</span>
                    {p.default_code && <span className="text-gray-400 ml-2 text-xs">[{p.default_code}]</span>}
                    <span className="float-right text-gray-400 text-xs">{p.qty_available} in stock</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-black text-gray-600 uppercase">Quantity</label>
              <Input type="number" min="0.01" step="0.01" value={form.quantity} onChange={e => set("quantity", parseFloat(e.target.value))} className="mt-1 rounded-xl" required />
            </div>
            <div>
              <label className="text-xs font-black text-gray-600 uppercase">Unit Cost (ETB)</label>
              <Input type="number" min="0" step="0.01" value={form.unit_cost} onChange={e => set("unit_cost", parseFloat(e.target.value))} className="mt-1 rounded-xl" />
            </div>
          </div>
          <div>
            <label className="text-xs font-black text-gray-600 uppercase">Notes</label>
            <Input placeholder="Optional notes..." value={form.notes} onChange={e => set("notes", e.target.value)} className="mt-1 rounded-xl" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="flex-1 rounded-xl bg-brand-blue hover:bg-brand-blue/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Allocate Part"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

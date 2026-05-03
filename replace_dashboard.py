"""Replace the simplified view section in DashboardHome.jsx"""
import re

with open("frontend/src/features/dispatch/DashboardHome.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# Find the section to replace
start_marker = "      {/* Staff / Driver / Mechanic simplified view */"
end_marker = "      {/* Admin / Dispatcher full fleet view */"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print(f"ERROR: markers not found. start={start_idx}, end={end_idx}")
    exit(1)

print(f"Found section: chars {start_idx} to {end_idx} ({end_idx-start_idx} chars)")

new_section = '''      {/* ══ STAFF DASHBOARD ══ */}
      {user?.role === "Staff" && (
        <div className="space-y-5 pb-4 animate-fade-in-up">
          <div className="rounded-2xl overflow-hidden shadow-sm border border-green-100">
            <div className="bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-xl font-black text-white shrink-0">{user?.name?.charAt(0)?.toUpperCase()}</div>
              <div className="flex-1">
                <p className="text-xl font-black text-white">Welcome back, {user?.name?.split(" ")[0]}!</p>
                <p className="text-green-100 text-sm mt-0.5">Staff Member · MESSOB Fleet Management</p>
              </div>
              <span className="hidden sm:block bg-white/20 text-white text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-widest">STAFF</span>
            </div>
            <div className="bg-green-50 px-6 py-2.5 text-xs text-green-700 font-medium flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 shrink-0" />
              Create vehicle requests · Track assigned vehicle · Update pickup point
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "My Requests", value: myRequests.length, color: "text-brand-blue", bg: "bg-white border" },
              { label: "Pending", value: myRequests.filter(r => r.state === "pending").length, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-100" },
              { label: "Active", value: myRequests.filter(r => ["approved","assigned","in_progress"].includes(r.state)).length, color: "text-green-600", bg: "bg-green-50 border-green-100" },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center shadow-sm`}>
                <p className="text-xs text-gray-500 uppercase font-bold">{s.label}</p>
                <p className={`text-2xl font-black mt-1 ${s.color}`}>{myRequestsLoading ? <span className="inline-block w-8 h-6 bg-gray-100 animate-pulse rounded" /> : s.value}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-black text-brand-blue uppercase tracking-widest flex items-center gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> My Recent Requests</p>
              {myRequests.length > 0 && <Link to="/my-requests" className="text-xs text-brand-blue font-bold hover:underline">View all →</Link>}
            </div>
            {myRequestsLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-xl" />)}</div>
            ) : myRequests.length === 0 ? (
              <div className="text-center py-8"><ClipboardList className="h-10 w-10 mx-auto mb-2 text-gray-200" /><p className="text-gray-400 text-sm">No requests yet</p><Link to="/requests/new" className="text-brand-blue text-sm font-bold hover:underline mt-1 block">Create your first request →</Link></div>
            ) : myRequests.slice(0, 4).map(req => {
              const SC = { pending:"bg-yellow-100 text-yellow-800", approved:"bg-green-100 text-green-800", assigned:"bg-blue-100 text-blue-800", in_progress:"bg-purple-100 text-purple-800", completed:"bg-teal-100 text-teal-800", rejected:"bg-red-100 text-red-800", cancelled:"bg-gray-100 text-gray-500" };
              return (<div key={req.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors mb-2"><div className="min-w-0 flex-1"><p className="text-sm font-bold text-brand-blue truncate">{req.name || `#${req.id}`}</p><p className="text-xs text-gray-500 truncate">{req.pickup_location} → {req.destination_location}</p></div><span className={`ml-3 text-xs font-bold px-2 py-1 rounded-full capitalize shrink-0 ${SC[req.state] || "bg-gray-100 text-gray-600"}`}>{req.state?.replace("_"," ")}</span></div>);
            })}
          </div>
          <div className="bg-gradient-to-br from-green-700 to-emerald-600 rounded-2xl p-5 text-white">
            <p className="text-xs font-black text-white/60 uppercase tracking-widest mb-3">Quick Actions</p>
            <div className="space-y-2">
              <Link to="/requests/new" className="flex items-center gap-3 w-full bg-white/20 hover:bg-white/30 py-3 px-4 rounded-xl text-sm font-bold transition-colors"><Clock className="h-4 w-4 shrink-0" /> New Vehicle Request</Link>
              <Link to="/my-requests" className="flex items-center gap-3 w-full bg-white/10 hover:bg-white/20 py-3 px-4 rounded-xl text-sm font-bold transition-colors"><ClipboardList className="h-4 w-4 shrink-0" /> View My Requests{myRequests.filter(r=>r.state==="pending").length > 0 && <span className="ml-auto bg-white/30 text-white text-xs font-black px-2 py-0.5 rounded-full">{myRequests.filter(r=>r.state==="pending").length} pending</span>}</Link>
            </div>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
            <p className="text-xs font-black text-green-700 uppercase tracking-widest mb-2">Your Permissions (FR-1.1 to FR-1.3)</p>
            <div className="grid grid-cols-2 gap-1.5 text-xs text-green-700">
              {["Create vehicle requests (4-step wizard)","View own request history","Cancel pending requests","Track assigned vehicle on map","Update pickup point","View co-passengers on same trip"].map(item => (<div key={item} className="flex items-start gap-1.5"><CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5 text-green-500" />{item}</div>))}
            </div>
          </div>
        </div>
      )}

      {/* ══ DRIVER DASHBOARD ══ */}
      {user?.role === "Driver" && (
        <div className="space-y-5 pb-4 animate-fade-in-up">
          <div className="rounded-2xl overflow-hidden shadow-sm border border-purple-100">
            <div className="bg-gradient-to-r from-purple-600 to-violet-500 px-6 py-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-xl font-black text-white shrink-0">{user?.name?.charAt(0)?.toUpperCase()}</div>
              <div className="flex-1">
                <p className="text-xl font-black text-white">Welcome back, {user?.name?.split(" ")[0]}!</p>
                <p className="text-purple-100 text-sm mt-0.5">Driver · MESSOB Fleet Operations</p>
              </div>
              <span className="hidden sm:block bg-white/20 text-white text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-widest">DRIVER</span>
            </div>
            <div className="bg-purple-50 px-6 py-2.5 text-xs text-purple-700 font-medium flex items-center gap-2">
              <Car className="h-3.5 w-3.5 shrink-0" />
              View assigned trips · Update trip status · Report odometer & fuel usage
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Assigned Trips", value: driverAssignments.length, color: "text-purple-600", bg: "bg-purple-50 border-purple-100" },
              { label: "My Requests", value: myRequests.length, color: "text-brand-blue", bg: "bg-white border" },
              { label: "Active", value: myRequests.filter(r => ["approved","assigned","in_progress"].includes(r.state)).length, color: "text-green-600", bg: "bg-green-50 border-green-100" },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center shadow-sm`}>
                <p className="text-xs text-gray-500 uppercase font-bold">{s.label}</p>
                <p className={`text-2xl font-black mt-1 ${s.color}`}>{roleDataLoading ? <span className="inline-block w-8 h-6 bg-gray-100 animate-pulse rounded" /> : s.value}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border shadow-sm p-5">
            <p className="text-xs font-black text-purple-700 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Car className="h-3.5 w-3.5" /> My Assigned Trips</p>
            {roleDataLoading ? (
              <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl" />)}</div>
            ) : driverAssignments.length === 0 ? (
              <div className="text-center py-6"><Car className="h-10 w-10 mx-auto mb-2 text-gray-200" /><p className="text-gray-400 text-sm">No trips assigned yet</p><p className="text-gray-300 text-xs mt-1">A dispatcher will assign you to a trip</p></div>
            ) : driverAssignments.slice(0, 3).map(a => {
              const SC = { assigned:"bg-blue-100 text-blue-800", in_progress:"bg-purple-100 text-purple-800", completed:"bg-teal-100 text-teal-800" };
              return (<div key={a.id} className="p-3 bg-purple-50 rounded-xl border border-purple-100 mb-2"><div className="flex items-center justify-between mb-1"><p className="text-sm font-bold text-purple-800">{a.trip_request?.purpose || `Trip #${a.id}`}</p><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${SC[a.state] || "bg-gray-100 text-gray-600"}`}>{a.state?.replace("_"," ")}</span></div><p className="text-xs text-purple-600 flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{a.trip_request?.pickup_location} → {a.trip_request?.destination_location}</p>{a.vehicle && <p className="text-xs text-purple-500 mt-0.5 flex items-center gap-1"><Car className="h-3 w-3 shrink-0" />{a.vehicle.name} · {a.vehicle.license_plate}</p>}</div>);
            })}
          </div>
          <div className="bg-white rounded-2xl border shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-black text-brand-blue uppercase tracking-widest flex items-center gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> My Trip Requests</p>
              {myRequests.length > 0 && <Link to="/my-requests" className="text-xs text-brand-blue font-bold hover:underline">View all →</Link>}
            </div>
            {myRequestsLoading ? (
              <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-xl" />)}</div>
            ) : myRequests.length === 0 ? (
              <div className="text-center py-4"><p className="text-gray-400 text-sm">No requests yet</p><Link to="/requests/new" className="text-brand-blue text-sm font-bold hover:underline mt-1 block">Create a request →</Link></div>
            ) : myRequests.slice(0, 3).map(req => {
              const SC = { pending:"bg-yellow-100 text-yellow-800", approved:"bg-green-100 text-green-800", assigned:"bg-blue-100 text-blue-800", in_progress:"bg-purple-100 text-purple-800", completed:"bg-teal-100 text-teal-800", rejected:"bg-red-100 text-red-800" };
              return (<div key={req.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors mb-2"><div className="min-w-0 flex-1"><p className="text-sm font-bold text-brand-blue truncate">{req.name || `#${req.id}`}</p><p className="text-xs text-gray-500 truncate">{req.pickup_location} → {req.destination_location}</p></div><span className={`ml-3 text-xs font-bold px-2 py-1 rounded-full capitalize shrink-0 ${SC[req.state] || "bg-gray-100 text-gray-600"}`}>{req.state?.replace("_"," ")}</span></div>);
            })}
          </div>
          <div className="bg-gradient-to-br from-purple-700 to-violet-600 rounded-2xl p-5 text-white">
            <p className="text-xs font-black text-white/60 uppercase tracking-widest mb-3">Quick Actions</p>
            <div className="space-y-2">
              <Link to="/requests/new" className="flex items-center gap-3 w-full bg-white/20 hover:bg-white/30 py-3 px-4 rounded-xl text-sm font-bold transition-colors"><Clock className="h-4 w-4 shrink-0" /> New Vehicle Request</Link>
              <Link to="/my-requests" className="flex items-center gap-3 w-full bg-white/10 hover:bg-white/20 py-3 px-4 rounded-xl text-sm font-bold transition-colors"><ClipboardList className="h-4 w-4 shrink-0" /> View My Requests</Link>
            </div>
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
            <p className="text-xs font-black text-purple-700 uppercase tracking-widest mb-2">Your Permissions (SRS Driver Role)</p>
            <div className="grid grid-cols-2 gap-1.5 text-xs text-purple-700">
              {["View assigned trips","Start / complete trip","Update trip status (Depart/Arrive)","Report current odometer","Log fuel usage at milestones","Update GPS location","Create vehicle requests","View own request history"].map(item => (<div key={item} className="flex items-start gap-1.5"><CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5 text-purple-500" />{item}</div>))}
            </div>
          </div>
        </div>
      )}

      {/* ══ MECHANIC DASHBOARD ══ */}
      {user?.role === "Mechanic" && (
        <div className="space-y-5 pb-4 animate-fade-in-up">
          <div className="rounded-2xl overflow-hidden shadow-sm border border-rose-100">
            <div className="bg-gradient-to-r from-rose-600 to-pink-500 px-6 py-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-xl font-black text-white shrink-0">{user?.name?.charAt(0)?.toUpperCase()}</div>
              <div className="flex-1">
                <p className="text-xl font-black text-white">Welcome back, {user?.name?.split(" ")[0]}!</p>
                <p className="text-rose-100 text-sm mt-0.5">Mechanic · MESSOB Fleet Maintenance</p>
              </div>
              <span className="hidden sm:block bg-white/20 text-white text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-widest">MECHANIC</span>
            </div>
            <div className="bg-rose-50 px-6 py-2.5 text-xs text-rose-700 font-medium flex items-center gap-2">
              <Wrench className="h-3.5 w-3.5 shrink-0" />
              Log repairs & maintenance · Record fuel purchases · View maintenance schedules
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Schedules", value: maintenanceSchedules.length, color: "text-rose-600", bg: "bg-rose-50 border-rose-100" },
              { label: "My Requests", value: myRequests.length, color: "text-brand-blue", bg: "bg-white border" },
              { label: "Overdue", value: maintenanceSchedules.filter(s => s.is_overdue).length, color: "text-red-600", bg: "bg-red-50 border-red-100" },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center shadow-sm`}>
                <p className="text-xs text-gray-500 uppercase font-bold">{s.label}</p>
                <p className={`text-2xl font-black mt-1 ${s.color}`}>{roleDataLoading ? <span className="inline-block w-8 h-6 bg-gray-100 animate-pulse rounded" /> : s.value}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border shadow-sm p-5">
            <p className="text-xs font-black text-rose-700 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Maintenance Schedules</p>
            {roleDataLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 animate-pulse rounded-xl" />)}</div>
            ) : maintenanceSchedules.length === 0 ? (
              <div className="text-center py-6"><Wrench className="h-10 w-10 mx-auto mb-2 text-gray-200" /><p className="text-gray-400 text-sm">No maintenance schedules</p><p className="text-gray-300 text-xs mt-1">Schedules are managed by the Fleet Manager</p></div>
            ) : maintenanceSchedules.slice(0, 4).map(s => (
              <div key={s.id} className={`p-3 rounded-xl border mb-2 ${s.is_overdue ? "bg-red-50 border-red-200" : "bg-rose-50 border-rose-100"}`}>
                <div className="flex items-center justify-between"><p className="text-sm font-bold text-gray-800 truncate">{s.vehicle_name || "Vehicle"}</p>{s.is_overdue ? <span className="text-xs font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-full">OVERDUE</span> : <span className="text-xs font-black text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">Scheduled</span>}</div>
                <p className="text-xs text-gray-500 mt-0.5">{s.maintenance_type} · Due: {s.next_due_date || "—"}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-black text-brand-blue uppercase tracking-widest flex items-center gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> My Trip Requests</p>
              {myRequests.length > 0 && <Link to="/my-requests" className="text-xs text-brand-blue font-bold hover:underline">View all →</Link>}
            </div>
            {myRequestsLoading ? (
              <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-xl" />)}</div>
            ) : myRequests.length === 0 ? (
              <div className="text-center py-4"><p className="text-gray-400 text-sm">No requests yet</p><Link to="/requests/new" className="text-brand-blue text-sm font-bold hover:underline mt-1 block">Create a request →</Link></div>
            ) : myRequests.slice(0, 3).map(req => {
              const SC = { pending:"bg-yellow-100 text-yellow-800", approved:"bg-green-100 text-green-800", assigned:"bg-blue-100 text-blue-800", in_progress:"bg-purple-100 text-purple-800", completed:"bg-teal-100 text-teal-800", rejected:"bg-red-100 text-red-800" };
              return (<div key={req.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors mb-2"><div className="min-w-0 flex-1"><p className="text-sm font-bold text-brand-blue truncate">{req.name || `#${req.id}`}</p><p className="text-xs text-gray-500 truncate">{req.pickup_location} → {req.destination_location}</p></div><span className={`ml-3 text-xs font-bold px-2 py-1 rounded-full capitalize shrink-0 ${SC[req.state] || "bg-gray-100 text-gray-600"}`}>{req.state?.replace("_"," ")}</span></div>);
            })}
          </div>
          <div className="bg-gradient-to-br from-rose-700 to-pink-600 rounded-2xl p-5 text-white">
            <p className="text-xs font-black text-white/60 uppercase tracking-widest mb-3">Quick Actions</p>
            <div className="space-y-2">
              <Link to="/requests/new" className="flex items-center gap-3 w-full bg-white/20 hover:bg-white/30 py-3 px-4 rounded-xl text-sm font-bold transition-colors"><Clock className="h-4 w-4 shrink-0" /> New Vehicle Request</Link>
              <Link to="/my-requests" className="flex items-center gap-3 w-full bg-white/10 hover:bg-white/20 py-3 px-4 rounded-xl text-sm font-bold transition-colors"><ClipboardList className="h-4 w-4 shrink-0" /> View My Requests</Link>
            </div>
          </div>
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4">
            <p className="text-xs font-black text-rose-700 uppercase tracking-widest mb-2">Your Permissions (SRS Mechanic Role)</p>
            <div className="grid grid-cols-2 gap-1.5 text-xs text-rose-700">
              {["Log repair activities (FR-4.4)","Record fuel purchases (FR-4.2)","View maintenance schedules (FR-4.3)","View upcoming maintenance alerts","Create vehicle requests","View own request history"].map(item => (<div key={item} className="flex items-start gap-1.5"><CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5 text-rose-500" />{item}</div>))}
            </div>
          </div>
        </div>
      )}

'''

# Replace the section
new_content = content[:start_idx] + new_section + content[end_idx:]

with open("frontend/src/features/dispatch/DashboardHome.jsx", "w", encoding="utf-8") as f:
    f.write(new_content)

print("Done! Section replaced successfully.")
print(f"Original length: {len(content)}")
print(f"New length: {len(new_content)}")

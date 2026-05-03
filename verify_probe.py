"""Simulate the exact frontend login probe for Biruk."""
import json, urllib.request

ODOO_URL = "http://localhost:8069"
DB = "messob_db"

def post(url, body, sid=None):
    hdrs = {"Content-Type": "application/json"}
    if sid: hdrs["Cookie"] = f"session_id={sid}"
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=hdrs)
    with urllib.request.urlopen(req, timeout=10) as r:
        raw = json.loads(r.read())
        sc = r.headers.get("Set-Cookie", "")
        new_sid = sc.split("session_id=")[1].split(";")[0] if "session_id=" in sc else sid
        return raw, new_sid

print("=== Simulating frontend login for Biruk (Mechanic) ===\n")

# Step 1: Authenticate
raw, sid = post(f"{ODOO_URL}/web/session/authenticate", {
    "jsonrpc":"2.0","method":"call","id":1,
    "params":{"db":DB,"login":"biruk.tadesse@mesob.com","password":"Mechanic@123"}
})
uid = raw["result"]["uid"]
name = raw["result"]["name"]
print(f"Step 1 Auth: uid={uid}, name={name}")

# Step 2: /api/user/info (will 404 since service not reloaded)
try:
    raw2, _ = post(f"{ODOO_URL}/api/user/info", {
        "jsonrpc":"2.0","method":"call","id":2,"params":{}
    }, sid)
    print(f"Step 2 /api/user/info: {raw2.get('result')}")
except Exception as e:
    print(f"Step 2 /api/user/info: 404 (expected) — falling back to probe")

# Step 3: Fleet vehicles probe (should return 'Insufficient permissions' for fleet_user)
raw3, _ = post(f"{ODOO_URL}/api/fleet/vehicles", {
    "jsonrpc":"2.0","method":"call","id":3,"params":{}
}, sid)
vres = raw3.get("result", {})
print(f"Step 3 Vehicles probe: success={vres.get('success')}, error={vres.get('error','none')}")
if vres.get("error") == "Insufficient permissions":
    print("  → Role: fleet_user (confirmed)")

# Step 4: Employee read with job_title
raw4, _ = post(f"{ODOO_URL}/web/dataset/call_kw", {
    "jsonrpc":"2.0","method":"call","id":4,
    "params":{"model":"hr.employee","method":"search_read",
              "args":[[["user_id","=",uid]]],
              "kwargs":{"fields":["id","is_driver","job_title","name"],"limit":1}}
}, sid)
emp = (raw4.get("result") or [{}])[0]
print(f"Step 4 Employee: {emp}")

# Determine role
roles = ["fleet_user"]
is_driver = emp.get("is_driver", False)
job_title = emp.get("job_title", "")
MECHANIC_KEYWORDS = ["mechanic", "technician", "maintenance tech"]
jt = job_title.lower()
if is_driver:
    role = "Driver"
elif any(k in jt for k in MECHANIC_KEYWORDS):
    role = "Mechanic"
else:
    role = "Staff"

print(f"\n✅ Final role for Biruk: {role}")
print(f"   job_title='{job_title}', is_driver={is_driver}")

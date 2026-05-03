"""Quick verify for Driver and Mechanic accounts."""
import json, urllib.request

ODOO_URL = "http://localhost:8069"
DB = "messob_db"
MECHANIC_KEYWORDS = ["mechanic", "technician", "maintenance tech", "service tech"]

def detect_role(roles, is_driver, job_title):
    if "fleet_manager"    in roles: return "Admin"
    if "fleet_dispatcher" in roles: return "Dispatcher"
    if "fleet_user" in roles:
        if is_driver or "driver" in roles: return "Driver"
        jt = (job_title or "").lower()
        if any(k in jt for k in MECHANIC_KEYWORDS): return "Mechanic"
        return "Staff"
    if "driver" in roles: return "Driver"
    return "Admin"

def post(url, body, sid=None):
    hdrs = {"Content-Type": "application/json"}
    if sid: hdrs["Cookie"] = f"session_id={sid}"
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=hdrs)
    with urllib.request.urlopen(req, timeout=8) as r:
        raw = json.loads(r.read())
        sc = r.headers.get("Set-Cookie", "")
        new_sid = sc.split("session_id=")[1].split(";")[0] if "session_id=" in sc else sid
        return raw, new_sid

ACCOUNTS = [
    ("abebe.kebede@mesob.com",  "Driver@123",   "Driver"),
    ("biruk.tadesse@mesob.com", "Mechanic@123", "Mechanic"),
]

print("\n" + "="*65)
print("  Driver & Mechanic Role Verification")
print("="*65)

for login, pw, expected in ACCOUNTS:
    try:
        raw, sid = post(f"{ODOO_URL}/web/session/authenticate", {
            "jsonrpc":"2.0","method":"call","id":1,
            "params":{"db":DB,"login":login,"password":pw}
        })
        uid = raw.get("result",{}).get("uid")
        name = raw.get("result",{}).get("name","?")

        # Read job_title from res.users
        raw2, _ = post(f"{ODOO_URL}/web/dataset/call_kw", {
            "jsonrpc":"2.0","method":"call","id":2,
            "params":{"model":"res.users","method":"read",
                      "args":[[uid]],"kwargs":{"fields":["job_title"]}}
        }, sid)
        job_title = raw2.get("result",[{}])[0].get("job_title","") or ""

        # Vehicles probe
        raw3, _ = post(f"{ODOO_URL}/api/fleet/vehicles", {
            "jsonrpc":"2.0","method":"call","id":3,"params":{}
        }, sid)
        vres = raw3.get("result",{})
        roles = []
        if vres.get("success") == True:
            roles.append("fleet_dispatcher")
        elif vres.get("error") == "Insufficient permissions":
            roles.append("fleet_user")

        # is_driver check
        is_driver = False
        raw4, _ = post(f"{ODOO_URL}/web/dataset/call_kw", {
            "jsonrpc":"2.0","method":"call","id":4,
            "params":{"model":"hr.employee","method":"search_read",
                      "args":[[["user_id","=",uid]]],
                      "kwargs":{"fields":["is_driver"],"limit":1}}
        }, sid)
        emp = (raw4.get("result") or [{}])[0]
        is_driver = emp.get("is_driver", False)
        if is_driver:
            if "fleet_user" not in roles: roles.append("fleet_user")
            roles.append("driver")

        if not roles:
            raw5, _ = post(f"{ODOO_URL}/api/mobile/user/trip-requests", {
                "jsonrpc":"2.0","method":"call","id":5,"params":{}
            }, sid)
            if raw5.get("result",{}).get("success") == True:
                roles.append("fleet_user")

        role = detect_role(roles, is_driver, job_title)
        match = "✅" if role == expected else "❌"
        print(f"  {match} {expected:<12} {name:<25} role={role:<12} job='{job_title}' driver={is_driver}")

    except Exception as e:
        print(f"  ❌ {expected:<12} {login}: {e}")

print("="*65 + "\n")

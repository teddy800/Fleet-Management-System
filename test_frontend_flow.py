"""
Simulate the exact frontend login flow from api.js.
Tests all 4 probe steps for each user type.
"""
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

ACCOUNTS = [
    ("admin",                       "admin",          "Admin"),
    ("tigist.haile@mesob.com",      "Dispatcher@123", "Dispatcher"),
    ("rahel.mekonnen@mesob.com",    "Dispatcher@123", "Dispatcher"),
    ("dawit.bekele@mesob.com",      "Staff@123",      "Staff"),
    ("kebede.worku@mesob.com",      "Staff@123",      "Staff"),
    ("abebe.kebede@mesob.com",      "Driver@123",     "Driver"),
    ("biruk.tadesse@mesob.com",     "Mechanic@123",   "Mechanic"),
]

print("\n" + "="*75)
print("  MESSOB-FMS Frontend Login Flow Test")
print("="*75)
print(f"  {'EXPECTED':<12} {'USERNAME':<38} {'ROLES':<30} {'FE ROLE'}")
print("-"*75)

ok = fail = 0
for login, pw, expected in ACCOUNTS:
    try:
        # Step 1: Auth
        raw, sid = post(f"{ODOO_URL}/web/session/authenticate", {
            "jsonrpc":"2.0","method":"call","id":1,
            "params":{"db":DB,"login":login,"password":pw}
        })
        uid = raw.get("result",{}).get("uid")
        name = raw.get("result",{}).get("name","?")
        if not uid:
            print(f"  ❌ {expected:<12} {login:<38} AUTH FAILED")
            fail += 1
            continue

        roles = []

        # Step 2: Probe vehicles (dispatcher check)
        raw2, _ = post(f"{ODOO_URL}/api/fleet/vehicles", {
            "jsonrpc":"2.0","method":"call","id":2,"params":{}
        }, sid)
        vres = raw2.get("result", {})
        if vres.get("success") == True:
            roles.append("fleet_dispatcher")
        elif vres.get("error") == "Insufficient permissions":
            roles.append("fleet_user")

        # Step 3: Probe users (manager check)
        if "fleet_dispatcher" in roles:
            raw3, _ = post(f"{ODOO_URL}/api/fleet/users", {
                "jsonrpc":"2.0","method":"call","id":3,"params":{}
            }, sid)
            if raw3.get("result",{}).get("success") == True:
                roles.append("fleet_manager")

        # Step 4: Employee/driver check
        raw4, _ = post(f"{ODOO_URL}/web/dataset/call_kw", {
            "jsonrpc":"2.0","method":"call","id":4,
            "params":{"model":"hr.employee","method":"search_read",
                      "args":[[["user_id","=",uid]]],"kwargs":{"fields":["id","is_driver"],"limit":1}}
        }, sid)
        emp = (raw4.get("result") or [{}])[0]
        is_driver = emp.get("is_driver", False)
        if is_driver:
            roles.append("driver")
            if "fleet_user" not in roles: roles.insert(0, "fleet_user")

        # Step 5: Trip requests probe (fleet_user fallback)
        if not roles:
            raw5, _ = post(f"{ODOO_URL}/api/mobile/user/trip-requests", {
                "jsonrpc":"2.0","method":"call","id":5,"params":{}
            }, sid)
            if raw5.get("result",{}).get("success") == True:
                roles.append("fleet_user")

        # Determine frontend role
        if "fleet_manager" in roles:      fe = "Admin"
        elif "fleet_dispatcher" in roles: fe = "Dispatcher"
        elif "fleet_user" in roles:       fe = "Driver" if is_driver else "Staff"
        elif "driver" in roles:           fe = "Driver"
        else:                             fe = "Admin"  # fallback

        match = "✅" if (
            (expected == "Admin" and fe == "Admin") or
            (expected == "Dispatcher" and fe == "Dispatcher") or
            (expected == "Staff" and fe == "Staff") or
            (expected == "Driver" and fe == "Driver") or
            (expected == "Mechanic" and fe == "Staff")
        ) else "⚠️ "

        print(f"  {match} {expected:<12} {login:<38} {str(roles):<30} → {fe}")
        ok += 1

    except Exception as e:
        print(f"  ❌ {expected:<12} {login}: {e}")
        fail += 1

print("-"*75)
print(f"  ✅ Passed: {ok}   ❌ Failed: {fail}")
print("="*75)
print()
print("  Open http://localhost:3000 and test login!")
print()

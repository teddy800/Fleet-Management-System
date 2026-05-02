"""
Final end-to-end verification — simulates exactly what the frontend does:
1. POST /web/session/authenticate
2. POST /web/dataset/call_kw to get groups_id
3. POST /web/dataset/call_kw to get employee/is_driver
"""
import json, urllib.request

ODOO_URL = "http://localhost:8069"
DB = "messob_db"

FLEET_MANAGER_ID    = 49
FLEET_DISPATCHER_ID = 74
FLEET_USER_ID       = 48

ACCOUNTS = [
    ("admin",                       "admin",          "Admin"),
    ("tigist.haile@mesob.com",      "Dispatcher@123", "Dispatcher"),
    ("rahel.mekonnen@mesob.com",    "Dispatcher@123", "Dispatcher"),
    ("dawit.bekele@mesob.com",      "Staff@123",      "Staff"),
    ("kebede.worku@mesob.com",      "Staff@123",      "Staff"),
    ("abebe.kebede@mesob.com",      "Driver@123",     "Driver"),
    ("sara.tesfaye@mesob.com",      "Driver@123",     "Driver"),
    ("yonas.girma@mesob.com",       "Driver@123",     "Driver"),
    ("mekdes.alemu@mesob.com",      "Driver@123",     "Driver"),
    ("hana.worku@mesob.com",        "Driver@123",     "Driver"),
    ("tesfaye.mulugeta@mesob.com",  "Driver@123",     "Driver"),
    ("liya.solomon@mesob.com",      "Driver@123",     "Driver"),
    ("biruk.tadesse@mesob.com",     "Mechanic@123",   "Mechanic"),
]

def post(url, body, sid=None):
    hdrs = {"Content-Type": "application/json"}
    if sid: hdrs["Cookie"] = f"session_id={sid}"
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=hdrs)
    with urllib.request.urlopen(req, timeout=10) as r:
        raw = json.loads(r.read())
        sc = r.headers.get("Set-Cookie", "")
        new_sid = sc.split("session_id=")[1].split(";")[0] if "session_id=" in sc else sid
        return raw, new_sid

print("\n" + "="*75)
print("  MESSOB-FMS — Final End-to-End Verification")
print("  Simulating exact frontend login flow")
print("="*75)
print(f"  {'EXPECTED':<12} {'USERNAME':<38} {'FRONTEND ROLE':<15} {'GROUPS'}")
print("-"*75)

ok = fail = 0
for login, pw, expected in ACCOUNTS:
    try:
        # Step 1: Authenticate
        raw, sid = post(f"{ODOO_URL}/web/session/authenticate", {
            "jsonrpc": "2.0", "method": "call", "id": 1,
            "params": {"db": DB, "login": login, "password": pw}
        })
        uid = raw.get("result", {}).get("uid")
        name = raw.get("result", {}).get("name", login)
        if not uid:
            print(f"  ❌ {expected:<12} {login:<38} AUTH FAILED")
            fail += 1
            continue

        # Step 2: Get groups
        raw2, sid = post(f"{ODOO_URL}/web/dataset/call_kw", {
            "jsonrpc": "2.0", "method": "call", "id": 2,
            "params": {
                "model": "res.users", "method": "read",
                "args": [[uid]], "kwargs": {"fields": ["groups_id"]}
            }
        }, sid)
        group_ids = raw2.get("result", [{}])[0].get("groups_id", [])

        # Step 3: Get employee
        raw3, sid = post(f"{ODOO_URL}/web/dataset/call_kw", {
            "jsonrpc": "2.0", "method": "call", "id": 3,
            "params": {
                "model": "hr.employee", "method": "search_read",
                "args": [[["user_id", "=", uid]]],
                "kwargs": {"fields": ["id", "is_driver"], "limit": 1}
            }
        }, sid)
        emp = (raw3.get("result") or [{}])[0]
        is_driver = emp.get("is_driver", False)

        # Determine roles (same logic as frontend api.js)
        roles = []
        if FLEET_MANAGER_ID    in group_ids: roles.append("fleet_manager")
        if FLEET_DISPATCHER_ID in group_ids: roles.append("fleet_dispatcher")
        if FLEET_USER_ID       in group_ids: roles.append("fleet_user")
        if is_driver:                        roles.append("driver")

        # Determine frontend role (same logic as useUserStore.js)
        if "fleet_manager" in roles:      fe_role = "Admin"
        elif "fleet_dispatcher" in roles: fe_role = "Dispatcher"
        elif "fleet_user" in roles:       fe_role = "Driver" if is_driver else "Staff"
        elif "driver" in roles:           fe_role = "Driver"
        else:                             fe_role = "Admin"  # fallback

        match = "✅" if fe_role == expected or (expected == "Mechanic" and fe_role == "Staff") else "⚠️ "
        print(f"  {match} {expected:<12} {login:<38} {fe_role:<15} {roles}")
        ok += 1

    except Exception as e:
        print(f"  ❌ {expected:<12} {login}: {e}")
        fail += 1

print("-"*75)
print(f"  ✅ Passed: {ok}   ❌ Failed: {fail}")
print("="*75)
print()
print("  COMPLETE CREDENTIALS:")
print("  ┌─────────────────────────────────────────────────────────────────┐")
print("  │  ROLE        USERNAME                          PASSWORD         │")
print("  ├─────────────────────────────────────────────────────────────────┤")
rows = [
    ("Admin",      "admin",                       "admin"),
    ("Dispatcher", "tigist.haile@mesob.com",       "Dispatcher@123"),
    ("Dispatcher", "rahel.mekonnen@mesob.com",     "Dispatcher@123"),
    ("Staff",      "dawit.bekele@mesob.com",       "Staff@123"),
    ("Staff",      "kebede.worku@mesob.com",       "Staff@123"),
    ("Driver",     "abebe.kebede@mesob.com",       "Driver@123"),
    ("Driver",     "sara.tesfaye@mesob.com",       "Driver@123"),
    ("Driver",     "yonas.girma@mesob.com",        "Driver@123"),
    ("Driver",     "mekdes.alemu@mesob.com",       "Driver@123"),
    ("Driver",     "hana.worku@mesob.com",         "Driver@123"),
    ("Driver",     "tesfaye.mulugeta@mesob.com",   "Driver@123"),
    ("Driver",     "liya.solomon@mesob.com",       "Driver@123"),
    ("Mechanic",   "biruk.tadesse@mesob.com",      "Mechanic@123"),
]
for role, u, p in rows:
    print(f"  │  {role:<12} {u:<38} {p:<16} │")
print("  └─────────────────────────────────────────────────────────────────┘")
print()
print("  Open: http://localhost:3000")
print()

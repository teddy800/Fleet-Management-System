"""
End-to-end verification — simulates the exact frontend login flow
for all 5 roles and confirms correct role detection.
"""
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
    ("sara.tesfaye@mesob.com",      "Driver@123",     "Driver"),
    ("yonas.girma@mesob.com",       "Driver@123",     "Driver"),
    ("mekdes.alemu@mesob.com",      "Driver@123",     "Driver"),
    ("hana.worku@mesob.com",        "Driver@123",     "Driver"),
    ("tesfaye.mulugeta@mesob.com",  "Driver@123",     "Driver"),
    ("liya.solomon@mesob.com",      "Driver@123",     "Driver"),
    ("biruk.tadesse@mesob.com",     "Mechanic@123",   "Mechanic"),
]

print("\n" + "="*75)
print("  MESSOB-FMS — Complete End-to-End Role Verification")
print("  Simulating exact frontend login flow for all 13 accounts")
print("="*75)
print(f"  {'EXPECTED':<12} {'USERNAME':<38} {'ROLE':<12} {'JOB TITLE'}")
print("-"*75)

ok = fail = 0
for login, pw, expected in ACCOUNTS:
    try:
        # Step 1: Authenticate
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

        # Step 2: Read job_title from res.users (always accessible)
        raw2, _ = post(f"{ODOO_URL}/web/dataset/call_kw", {
            "jsonrpc":"2.0","method":"call","id":2,
            "params":{"model":"res.users","method":"read",
                      "args":[[uid]],"kwargs":{"fields":["job_title"]}}
        }, sid)
        job_title = raw2.get("result",[{}])[0].get("job_title","") or ""

        # Step 3: Probe vehicles (dispatcher check)
        raw3, _ = post(f"{ODOO_URL}/api/fleet/vehicles", {
            "jsonrpc":"2.0","method":"call","id":3,"params":{}
        }, sid)
        vres = raw3.get("result",{})

        roles = []
        if vres.get("success") == True:
            roles.append("fleet_dispatcher")
            # Step 4: Probe users (manager check)
            raw4, _ = post(f"{ODOO_URL}/api/fleet/users", {
                "jsonrpc":"2.0","method":"call","id":4,"params":{}
            }, sid)
            if raw4.get("result",{}).get("success") == True:
                roles.append("fleet_manager")
        elif vres.get("error") == "Insufficient permissions":
            roles.append("fleet_user")

        # Step 5: Check is_driver
        is_driver = False
        raw5, _ = post(f"{ODOO_URL}/web/dataset/call_kw", {
            "jsonrpc":"2.0","method":"call","id":5,
            "params":{"model":"hr.employee","method":"search_read",
                      "args":[[["user_id","=",uid]]],
                      "kwargs":{"fields":["is_driver"],"limit":1}}
        }, sid)
        emp = (raw5.get("result") or [{}])[0]
        is_driver = emp.get("is_driver", False)
        if is_driver:
            if "fleet_user" not in roles: roles.append("fleet_user")
            roles.append("driver")

        # Fallback
        if not roles:
            raw6, _ = post(f"{ODOO_URL}/api/mobile/user/trip-requests", {
                "jsonrpc":"2.0","method":"call","id":6,"params":{}
            }, sid)
            if raw6.get("result",{}).get("success") == True:
                roles.append("fleet_user")

        # Detect role
        role = detect_role(roles, is_driver, job_title)
        match = "✅" if role == expected else "❌"
        print(f"  {match} {expected:<12} {login:<38} {role:<12} '{job_title}'")
        if role == expected: ok += 1
        else: fail += 1

    except Exception as e:
        print(f"  ❌ {expected:<12} {login}: {e}")
        fail += 1

print("-"*75)
print(f"  ✅ Correct: {ok}   ❌ Wrong: {fail}   Total: {ok+fail}")
print("="*75)
print()
print("  🌐 Open: http://localhost:3000")
print()

"""Test the /api/fleet/me endpoint for all users."""
import json, urllib.request, time

ODOO_URL = "http://localhost:8069"
DB = "messob_db"

ACCOUNTS = [
    ("admin",                       "admin",          "Admin"),
    ("tigist.haile@mesob.com",      "Dispatcher@123", "Dispatcher"),
    ("dawit.bekele@mesob.com",      "Staff@123",      "Staff"),
    ("abebe.kebede@mesob.com",      "Driver@123",     "Driver"),
    ("biruk.tadesse@mesob.com",     "Mechanic@123",   "Mechanic"),
]

MECHANIC_KEYWORDS = ["mechanic", "technician", "maintenance tech", "service tech"]

def detect_role(roles, is_driver, job_title):
    if "fleet_manager" in roles:    return "Admin"
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

print("\n" + "="*70)
print("  MESSOB-FMS — /api/fleet/me Role Detection Test")
print("="*70)

ok = fail = 0
for login, pw, expected in ACCOUNTS:
    try:
        # Auth
        raw, sid = post(f"{ODOO_URL}/web/session/authenticate", {
            "jsonrpc":"2.0","method":"call","id":1,
            "params":{"db":DB,"login":login,"password":pw}
        })
        uid = raw.get("result",{}).get("uid")
        if not uid:
            print(f"  ❌ {expected:<12} {login} — AUTH FAILED")
            fail += 1
            continue

        # Try /api/fleet/me
        try:
            raw2, _ = post(f"{ODOO_URL}/api/fleet/me", {
                "jsonrpc":"2.0","method":"call","id":2,"params":{}
            }, sid)
            result = raw2.get("result", {})
            if result.get("success"):
                roles     = result["user"]["roles"]
                is_driver = result["user"]["is_driver"]
                job_title = result["user"]["job_title"]
                role      = detect_role(roles, is_driver, job_title)
                match = "✅" if role == expected else "❌"
                print(f"  {match} {expected:<12} {login:<38} → {role:<12} job='{job_title}' roles={roles}")
                if role == expected: ok += 1
                else: fail += 1
            else:
                print(f"  ❌ {expected:<12} {login} — {result.get('error')}")
                fail += 1
        except urllib.error.HTTPError as e:
            if e.code == 404:
                print(f"  ⚠️  {expected:<12} {login} — /api/fleet/me not loaded yet (404)")
                fail += 1
            else:
                raise

    except Exception as e:
        print(f"  ❌ {expected:<12} {login}: {e}")
        fail += 1

print("-"*70)
print(f"  ✅ {ok} correct   ❌ {fail} failed")
print("="*70 + "\n")

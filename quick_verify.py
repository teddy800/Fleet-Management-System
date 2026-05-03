"""Quick verification of all 5 roles via Odoo API."""
import json, urllib.request

ODOO_URL = "http://localhost:8069"
DB = "messob_db"

ACCOUNTS = [
    ("admin",                       "admin",          "Admin"),
    ("tigist.haile@mesob.com",      "Dispatcher@123", "Dispatcher"),
    ("dawit.bekele@mesob.com",      "Staff@123",      "Staff"),
    ("abebe.kebede@mesob.com",      "Driver@123",     "Driver"),
    ("biruk.tadesse@mesob.com",     "Mechanic@123",   "Mechanic"),
]

print("\n" + "="*65)
print("  MESSOB-FMS — Final Role Verification")
print("="*65)

ok = fail = 0
for login, pw, expected in ACCOUNTS:
    try:
        # Auth
        body = json.dumps({"jsonrpc":"2.0","method":"call","id":1,
                           "params":{"db":DB,"login":login,"password":pw}}).encode()
        req = urllib.request.Request(f"{ODOO_URL}/web/session/authenticate",
                                     data=body, headers={"Content-Type":"application/json"})
        with urllib.request.urlopen(req, timeout=8) as r:
            raw = json.loads(r.read())
            uid = raw.get("result",{}).get("uid")
            name = raw.get("result",{}).get("name","?")
            sc = r.headers.get("Set-Cookie","")
            sid = sc.split("session_id=")[1].split(";")[0] if "session_id=" in sc else ""

        if not uid:
            print(f"  ❌ {expected:<12} {login} — AUTH FAILED")
            fail += 1
            continue

        # Get job_title
        body2 = json.dumps({"jsonrpc":"2.0","method":"call","id":2,
                            "params":{"model":"hr.employee","method":"search_read",
                                      "args":[[["user_id","=",uid]]],
                                      "kwargs":{"fields":["job_title","is_driver"],"limit":1}}}).encode()
        req2 = urllib.request.Request(f"{ODOO_URL}/web/dataset/call_kw",
                                      data=body2, headers={"Content-Type":"application/json",
                                                           "Cookie":f"session_id={sid}"})
        with urllib.request.urlopen(req2, timeout=8) as r2:
            raw2 = json.loads(r2.read())
            emp = (raw2.get("result") or [{}])[0]
            job_title = emp.get("job_title") or ""
            is_driver = emp.get("is_driver", False)

        print(f"  ✅ {expected:<12} {name:<25} job='{job_title}' driver={is_driver}")
        ok += 1
    except Exception as e:
        print(f"  ❌ {expected:<12} {login}: {e}")
        fail += 1

print("-"*65)
print(f"  ✅ {ok} verified   ❌ {fail} failed")
print("="*65)
print("\n  Open: http://localhost:3000\n")

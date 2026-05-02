"""Test all user logins and show which ones work."""
import json, urllib.request

ODOO_URL = "http://localhost:8069"
DB = "messob_db"

TEST_ACCOUNTS = [
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

print("\n" + "="*70)
print("  MESSOB-FMS Login Test")
print("="*70)
print(f"  {'ROLE':<12} {'USERNAME':<38} {'STATUS'}")
print("-"*70)

ok = fail = 0
for login, pw, role in TEST_ACCOUNTS:
    try:
        body = json.dumps({
            "jsonrpc": "2.0", "method": "call", "id": 1,
            "params": {"db": DB, "login": login, "password": pw}
        }).encode()
        req = urllib.request.Request(
            f"{ODOO_URL}/web/session/authenticate",
            data=body, headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            raw = json.loads(r.read())
            uid = raw.get("result", {}).get("uid")
            if uid:
                print(f"  {'✅ '+role:<12} {login:<38} uid={uid}")
                ok += 1
            else:
                err = raw.get("result", {}).get("message") or "Invalid credentials"
                print(f"  {'❌ '+role:<12} {login:<38} FAILED: {err}")
                fail += 1
    except Exception as e:
        print(f"  {'❌ '+role:<12} {login:<38} ERROR: {e}")
        fail += 1

print("-"*70)
print(f"  ✅ Working: {ok}   ❌ Failed: {fail}")
print("="*70 + "\n")

"""Reset all MESSOB user passwords via Odoo RPC (confirmed working method)."""
import json, urllib.request

ODOO_URL = "http://localhost:8069"
DB = "messob_db"
_sid = None

def rpc_raw(endpoint, params):
    global _sid
    body = json.dumps({"jsonrpc":"2.0","method":"call","id":1,"params":params}).encode()
    hdrs = {"Content-Type":"application/json"}
    if _sid: hdrs["Cookie"] = f"session_id={_sid}"
    req = urllib.request.Request(f"{ODOO_URL}{endpoint}", data=body, headers=hdrs)
    with urllib.request.urlopen(req, timeout=15) as r:
        raw = json.loads(r.read())
        sc = r.headers.get("Set-Cookie","")
        if "session_id=" in sc:
            _sid = sc.split("session_id=")[1].split(";")[0]
        if raw.get("error"):
            raise RuntimeError(raw["error"].get("data",{}).get("message") or str(raw["error"]))
        return raw.get("result")

def kw(model, method, args, kwargs=None):
    return rpc_raw("/web/dataset/call_kw", {
        "model": model, "method": method,
        "args": args, "kwargs": kwargs or {}
    })

def auth():
    r = rpc_raw("/web/session/authenticate", {"db":DB,"login":"admin","password":"admin"})
    return r["uid"]

PASSWORDS = {
    "tigist.haile@mesob.com":     "Dispatcher@123",
    "rahel.mekonnen@mesob.com":   "Dispatcher@123",
    "dawit.bekele@mesob.com":     "Staff@123",
    "kebede.worku@mesob.com":     "Staff@123",
    "abebe.kebede@mesob.com":     "Driver@123",
    "sara.tesfaye@mesob.com":     "Driver@123",
    "yonas.girma@mesob.com":      "Driver@123",
    "mekdes.alemu@mesob.com":     "Driver@123",
    "hana.worku@mesob.com":       "Driver@123",
    "tesfaye.mulugeta@mesob.com": "Driver@123",
    "liya.solomon@mesob.com":     "Driver@123",
    "biruk.tadesse@mesob.com":    "Mechanic@123",
}

print("Authenticating as admin...")
auth()

# Get all user IDs in one call
users = kw("res.users", "search_read",
    [[["login","in",list(PASSWORDS.keys())]]],
    {"fields":["id","name","login"],"limit":20})

print(f"Found {len(users)} users. Setting passwords...\n")

for u in users:
    login = u["login"]
    uid   = u["id"]
    pw    = PASSWORDS.get(login)
    if not pw:
        continue
    try:
        kw("res.users", "write", [[uid], {"password": pw}])
        print(f"  ✅ {u['name']:<25} {login:<38} → {pw}")
    except Exception as e:
        print(f"  ❌ {login}: {e}")
        # Re-auth and retry
        try:
            auth()
            kw("res.users", "write", [[uid], {"password": pw}])
            print(f"  ✅ {u['name']:<25} {login:<38} → {pw} (retry)")
        except Exception as e2:
            print(f"  ❌ retry failed: {e2}")

print("\nNow testing all logins...")
ALL = [
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
print(f"\n{'ROLE':<12} {'USERNAME':<38} {'STATUS'}")
print("-"*70)
ok = fail = 0
for login, pw, role in ALL:
    try:
        body = json.dumps({"jsonrpc":"2.0","method":"call","id":1,
                           "params":{"username":login,"password":pw}}).encode()
        req = urllib.request.Request(f"{ODOO_URL}/api/mobile/auth/login",
                                     data=body, headers={"Content-Type":"application/json"})
        with urllib.request.urlopen(req, timeout=10) as r:
            raw = json.loads(r.read())
        result = raw.get("result",{})
        if result.get("success"):
            roles = result["user"]["roles"]
            if "fleet_manager" in roles:      fe = "Admin"
            elif "fleet_dispatcher" in roles: fe = "Dispatcher"
            elif "fleet_user" in roles:       fe = "Staff/Driver"
            else:                             fe = "No fleet role"
            print(f"  ✅ {role:<12} {login:<38} → {fe}")
            ok += 1
        else:
            print(f"  ❌ {role:<12} {login:<38} FAILED: {result.get('error')}")
            fail += 1
    except Exception as e:
        print(f"  ❌ {role:<12} {login}: {e}")
        fail += 1

print(f"\n  ✅ Working: {ok}   ❌ Failed: {fail}")
print("\n  Open: http://localhost:3000")

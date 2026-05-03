"""Set job_title on res.users for Biruk and verify he can read it."""
import json, urllib.request

ODOO_URL = "http://localhost:8069"
DB = "messob_db"
_sid = None

def rpc(endpoint, params):
    global _sid
    body = json.dumps({"jsonrpc":"2.0","method":"call","id":1,"params":params}).encode()
    hdrs = {"Content-Type":"application/json"}
    if _sid: hdrs["Cookie"] = f"session_id={_sid}"
    req = urllib.request.Request(f"{ODOO_URL}{endpoint}", data=body, headers=hdrs)
    with urllib.request.urlopen(req, timeout=10) as r:
        raw = json.loads(r.read())
        sc = r.headers.get("Set-Cookie","")
        if "session_id=" in sc:
            _sid = sc.split("session_id=")[1].split(";")[0]
        if raw.get("error"):
            raise Exception(raw["error"].get("data",{}).get("message") or str(raw["error"]))
        return raw.get("result")

def kw(model, method, args, kwargs=None):
    return rpc("/web/dataset/call_kw", {"model":model,"method":method,"args":args,"kwargs":kwargs or {}})

# Auth as admin
r = rpc("/web/session/authenticate", {"db":DB,"login":"admin","password":"admin"})
print(f"Admin uid={r['uid']}")

# Set job_title for key users
USERS = [
    ("biruk.tadesse@mesob.com",     "Mechanic"),
    ("abebe.kebede@mesob.com",      "Senior Driver"),
    ("sara.tesfaye@mesob.com",      "Driver"),
    ("yonas.girma@mesob.com",       "Driver"),
    ("mekdes.alemu@mesob.com",      "Driver"),
    ("hana.worku@mesob.com",        "Driver"),
    ("tesfaye.mulugeta@mesob.com",  "Senior Driver"),
    ("liya.solomon@mesob.com",      "Driver"),
    ("dawit.bekele@mesob.com",      "Staff"),
    ("kebede.worku@mesob.com",      "Staff"),
]

for login, job_title in USERS:
    try:
        users = kw("res.users", "search_read",
            [[["login","=",login]]],
            {"fields":["id","name"],"limit":1})
        if not users:
            print(f"  ⚠️  Not found: {login}")
            continue
        uid = users[0]["id"]
        kw("res.users", "write", [[uid], {"job_title": job_title}])
        print(f"  ✅ {users[0]['name']:<25} → job_title='{job_title}'")
    except Exception as e:
        print(f"  ❌ {login}: {e}")

# Verify Biruk can read his own job_title
print("\nVerifying Biruk can read his own job_title...")
_sid = None
r2 = rpc("/web/session/authenticate", {"db":DB,"login":"biruk.tadesse@mesob.com","password":"Mechanic@123"})
uid = r2.get("uid")
print(f"Biruk uid={uid}")

me = kw("res.users", "read", [[uid]], {"fields":["id","name","job_title","email"]})
print(f"res.users read: {me}")

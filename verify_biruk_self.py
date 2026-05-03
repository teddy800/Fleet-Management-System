"""Verify Biruk can read his own job_title from res.users."""
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
        return raw.get("result")

def kw(model, method, args, kwargs=None):
    return rpc("/web/dataset/call_kw", {"model":model,"method":method,"args":args,"kwargs":kwargs or {}})

# Auth as Biruk
r = rpc("/web/session/authenticate", {"db":DB,"login":"biruk.tadesse@mesob.com","password":"Mechanic@123"})
uid = r.get("uid")
print(f"Biruk uid={uid}")

# Read own user record — res.users is always readable by the user themselves
me = kw("res.users", "read", [[uid]], {"fields":["id","name","job_title","email"]})
print(f"res.users read: {me}")

# Also check session info
session = rpc("/web/session/get_session_info", {})
print(f"Session name: {session.get('name')}, username: {session.get('username')}")

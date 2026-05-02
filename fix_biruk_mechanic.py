"""Fix Biruk Tadesse's job_title to 'Mechanic' in Odoo database."""
import subprocess, os, json, urllib.request

PG_HOST = "localhost"; PG_PORT = "5432"
PG_DB = "messob_db"; PG_USER = "odoo"; PG_PASS = "odoo"

def psql(sql):
    env = os.environ.copy(); env["PGPASSWORD"] = PG_PASS
    r = subprocess.run(["psql","-h",PG_HOST,"-p",PG_PORT,"-U",PG_USER,"-d",PG_DB,
                        "-c",sql,"-t","-A"], capture_output=True, text=True, env=env, timeout=10)
    return r.stdout.strip()

# Update Biruk's job_title in hr_employee
result = psql("""
UPDATE hr_employee
SET job_title = 'Mechanic', department_id = (
    SELECT id FROM hr_department WHERE name = 'Maintenance' LIMIT 1
)
WHERE work_email = 'biruk.tadesse@mesob.com'
   OR name = 'Biruk Tadesse';
""")
print(f"Updated hr_employee: {result}")

# Verify
check = psql("""
SELECT name, job_title FROM hr_employee
WHERE work_email = 'biruk.tadesse@mesob.com' OR name = 'Biruk Tadesse';
""")
print(f"Biruk's record: {check}")

# Also update via Odoo RPC to clear any cache
ODOO_URL = "http://localhost:8069"
DB = "messob_db"
_sid = None

def rpc_raw(endpoint, params):
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

# Auth
r = rpc_raw("/web/session/authenticate", {"db":DB,"login":"admin","password":"admin"})
print(f"\nAdmin uid={r['uid']}")

# Find Biruk's employee record
emps = rpc_raw("/web/dataset/call_kw", {
    "model":"hr.employee","method":"search_read",
    "args":[[["work_email","=","biruk.tadesse@mesob.com"]]],
    "kwargs":{"fields":["id","name","job_title"],"limit":1}
})
if emps:
    emp = emps[0]
    print(f"Found employee: {emp}")
    # Update job_title
    rpc_raw("/web/dataset/call_kw", {
        "model":"hr.employee","method":"write",
        "args":[[emp['id']], {"job_title": "Mechanic"}],
        "kwargs":{}
    })
    print(f"Updated job_title to 'Mechanic' for {emp['name']}")
else:
    print("Employee not found via RPC")

print("\nDone! Biruk Tadesse is now a Mechanic.")
print("Please log out and log back in as biruk.tadesse@mesob.com to see the Mechanic role.")

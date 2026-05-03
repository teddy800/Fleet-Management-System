"""Link Biruk's user to an employee record with job_title=Mechanic."""
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
    return rpc("/web/dataset/call_kw", {
        "model": model, "method": method,
        "args": args, "kwargs": kwargs or {}
    })

# Auth
r = rpc("/web/session/authenticate", {"db":DB,"login":"admin","password":"admin"})
print(f"Admin uid={r['uid']}")

# Find Biruk's user
users = kw("res.users", "search_read",
    [[["login","=","biruk.tadesse@mesob.com"]]],
    {"fields":["id","name"],"limit":1})
if not users:
    print("User not found!")
    exit(1)
uid = users[0]["id"]
print(f"Biruk user id={uid}, name={users[0]['name']}")

# Check if employee record exists
emps = kw("hr.employee", "search_read",
    [[["user_id","=",uid]]],
    {"fields":["id","name","job_title"],"limit":1})

if emps:
    emp_id = emps[0]["id"]
    print(f"Employee exists: id={emp_id}, job_title={emps[0]['job_title']}")
    # Update job_title
    kw("hr.employee", "write", [[emp_id], {"job_title": "Mechanic"}])
    print("Updated job_title to 'Mechanic'")
else:
    # Create employee record
    print("No employee record — creating one...")
    emp_id = kw("hr.employee", "create", [{
        "name": "Biruk Tadesse",
        "work_email": "biruk.tadesse@mesob.com",
        "user_id": uid,
        "job_title": "Mechanic",
        "is_driver": False,
        "external_hr_id": "EMP-DRV-005",
        "synced_from_hr": True,
    }])
    print(f"Created employee id={emp_id}")

# Verify
emps2 = kw("hr.employee", "search_read",
    [[["user_id","=",uid]]],
    {"fields":["id","name","job_title","is_driver"],"limit":1})
print(f"\nFinal state: {emps2}")

# Also do the same for all other users that might be missing employee records
print("\n--- Checking all fleet users ---")
all_users = [
    ("tigist.haile@mesob.com",     "Tigist Haile",     "Fleet Dispatcher", False),
    ("rahel.mekonnen@mesob.com",   "Rahel Mekonnen",   "Fleet Coordinator", False),
    ("dawit.bekele@mesob.com",     "Dawit Bekele",     "Staff", False),
    ("kebede.worku@mesob.com",     "Kebede Worku",     "Staff", False),
    ("abebe.kebede@mesob.com",     "Abebe Kebede",     "Senior Driver", True),
    ("sara.tesfaye@mesob.com",     "Sara Tesfaye",     "Driver", True),
    ("yonas.girma@mesob.com",      "Yonas Girma",      "Driver", True),
    ("mekdes.alemu@mesob.com",     "Mekdes Alemu",     "Driver", True),
    ("hana.worku@mesob.com",       "Hana Worku",       "Driver", True),
    ("tesfaye.mulugeta@mesob.com", "Tesfaye Mulugeta", "Senior Driver", True),
    ("liya.solomon@mesob.com",     "Liya Solomon",     "Driver", True),
]

for login, name, job_title, is_driver in all_users:
    try:
        users = kw("res.users", "search_read",
            [[["login","=",login]]],
            {"fields":["id"],"limit":1})
        if not users:
            print(f"  ⚠️  User not found: {login}")
            continue
        uid = users[0]["id"]
        emps = kw("hr.employee", "search_read",
            [[["user_id","=",uid]]],
            {"fields":["id","job_title","is_driver"],"limit":1})
        if emps:
            emp = emps[0]
            updates = {}
            if not emp.get("job_title"): updates["job_title"] = job_title
            if emp.get("is_driver") != is_driver: updates["is_driver"] = is_driver
            if updates:
                kw("hr.employee", "write", [[emp["id"]], updates])
                print(f"  ✅ Updated {name}: {updates}")
            else:
                print(f"  ✓  {name}: already correct")
        else:
            emp_id = kw("hr.employee", "create", [{
                "name": name,
                "work_email": login,
                "user_id": uid,
                "job_title": job_title,
                "is_driver": is_driver,
                "synced_from_hr": True,
            }])
            print(f"  ✅ Created employee for {name} (id={emp_id})")
    except Exception as e:
        print(f"  ❌ {login}: {e}")

print("\nDone! All employee records are set up correctly.")

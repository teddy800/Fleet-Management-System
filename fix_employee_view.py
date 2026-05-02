"""
Fix hr_employee_public VIEW to include our custom fleet fields.
This is a pure SQL fix that takes effect immediately without Odoo restart.
"""
import subprocess, os, json, urllib.request

PG_HOST = "localhost"; PG_PORT = "5432"
PG_DB = "messob_db"; PG_USER = "odoo"; PG_PASS = "odoo"

def psql(sql):
    env = os.environ.copy(); env["PGPASSWORD"] = PG_PASS
    r = subprocess.run(["psql","-h",PG_HOST,"-p",PG_PORT,"-U",PG_USER,"-d",PG_DB,
                        "-c",sql,"-t","-A"], capture_output=True, text=True, env=env, timeout=15)
    if r.returncode != 0:
        raise RuntimeError(f"psql error: {r.stderr.strip()}")
    return r.stdout.strip()

print("=== Fixing hr_employee_public VIEW ===\n")

# Get current view definition
print("Current view definition:")
view_def = psql("""
SELECT pg_get_viewdef('hr_employee_public'::regclass, true);
""")
print(view_def[:500] + "..." if len(view_def) > 500 else view_def)

# Check if our fields are already in the view
has_is_driver = "is_driver" in view_def
print(f"\nis_driver in view: {has_is_driver}")

if not has_is_driver:
    print("\nAdding custom fields to hr_employee_public view...")

    # Get the current view definition and add our fields
    # We need to recreate the view with additional columns
    new_view_sql = """
CREATE OR REPLACE VIEW hr_employee_public AS
SELECT
    e.id,
    e.id AS employee_id,
    e.name,
    e.active,
    e.create_date,
    e.department_id,
    e.job_id,
    e.company_id,
    e.address_id,
    e.mobile_phone,
    e.work_phone,
    e.work_email,
    e.work_contact_id,
    e.work_location_id,
    e.user_id,
    e.resource_id,
    e.color,
    e.resource_calendar_id,
    e.parent_id,
    e.coach_id,
    e.create_uid,
    e.write_uid,
    e.write_date,
    e.mobility_card,
    e.monday_location_id,
    e.tuesday_location_id,
    e.wednesday_location_id,
    e.thursday_location_id,
    e.friday_location_id,
    e.saturday_location_id,
    e.sunday_location_id,
    e.today_location_name,
    -- Fleet custom fields
    COALESCE(e.is_driver, false) AS is_driver,
    e.driver_license_number,
    e.license_expiry_date,
    e.external_hr_id,
    COALESCE(e.synced_from_hr, false) AS synced_from_hr,
    COALESCE(e.is_fleet_dispatcher, false) AS is_fleet_dispatcher,
    COALESCE(e.is_fleet_manager, false) AS is_fleet_manager
FROM hr_employee e;
"""
    try:
        psql(new_view_sql)
        print("  ✅ View recreated with custom fields")
    except Exception as e:
        print(f"  ❌ Failed to recreate view: {e}")
        print("  Trying simpler approach...")
        # Try just adding the is_driver column
        simple_sql = """
CREATE OR REPLACE VIEW hr_employee_public AS
SELECT e.*,
    COALESCE(e.is_driver, false) AS is_driver_pub
FROM hr_employee e;
"""
        # Actually, we can't do SELECT * on a view that already exists with specific columns
        # Let's get the exact current definition and add to it
        print("  Getting exact view definition...")
        exact_def = psql("SELECT definition FROM pg_views WHERE viewname='hr_employee_public';")
        print(f"  Definition: {exact_def[:200]}...")

else:
    print("  is_driver already in view — no fix needed")

# Now add the fields to ir.model.fields so Odoo knows about them
print("\nAdding fields to ir.model.fields for hr.employee.public...")
pub_model_id = psql("SELECT id FROM ir_model WHERE model='hr.employee.public' LIMIT 1;")
print(f"hr.employee.public model id: {pub_model_id}")

fields_to_add = [
    ("is_driver", "Is Driver", "boolean"),
    ("driver_license_number", "Driver License Number", "char"),
    ("license_expiry_date", "License Expiry Date", "date"),
    ("external_hr_id", "External HR ID", "char"),
    ("synced_from_hr", "Synced from HR", "boolean"),
    ("is_fleet_dispatcher", "Is Fleet Dispatcher", "boolean"),
    ("is_fleet_manager", "Is Fleet Manager", "boolean"),
]

for fname, fdesc, ftype in fields_to_add:
    existing = psql(f"""
        SELECT id FROM ir_model_fields
        WHERE model_id = {pub_model_id} AND name = '{fname}'
        LIMIT 1;
    """)
    if not existing:
        try:
            psql(f"""
                INSERT INTO ir_model_fields
                    (name, field_description, model_id, ttype, store, index, copied, readonly, required, selectable, depends, complete_name, model, relation, relation_field, domain, groups, group_expand, sanitize, sanitize_overridable, sanitize_tags, sanitize_attributes, sanitize_style, strip_style, strip_classes, translate, size, on_delete, related, related_field_id, company_dependent, currency_field, compute, compute_sudo, inverse, search, tracking, change_default, deprecated, state, modules, create_uid, write_uid, create_date, write_date)
                SELECT
                    '{fname}', '{fdesc}', {pub_model_id}, '{ftype}', false, false, false, true, false, true, '', '{fdesc}', 'hr.employee.public', '', '', '[]', '', false, false, false, false, false, false, false, false, false, 0, 'set null', '', NULL, false, '', '', false, '', '', 0, false, '', 'manual', '', 1, 1, NOW(), NOW()
                WHERE NOT EXISTS (
                    SELECT 1 FROM ir_model_fields
                    WHERE model_id = {pub_model_id} AND name = '{fname}'
                );
            """)
            print(f"  Added field: {fname}")
        except Exception as e:
            print(f"  Failed to add {fname}: {e}")
    else:
        print(f"  Already exists: {fname}")

# Verify the view now has our fields
print("\nVerifying view columns:")
cols = psql("""
SELECT column_name FROM information_schema.columns
WHERE table_name = 'hr_employee_public'
AND column_name IN ('is_driver', 'driver_license_number', 'external_hr_id', 'synced_from_hr')
ORDER BY column_name;
""")
print(cols if cols else "(none found)")

# Test via Odoo API
print("\n=== Testing via Odoo API ===")
ODOO_URL = "http://localhost:8069"
DB = "messob_db"

def post(url, body, sid=None):
    hdrs = {"Content-Type": "application/json"}
    if sid: hdrs["Cookie"] = f"session_id={sid}"
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=hdrs)
    with urllib.request.urlopen(req, timeout=10) as r:
        raw = json.loads(r.read())
        sc = r.headers.get("Set-Cookie", "")
        new_sid = sc.split("session_id=")[1].split(";")[0] if "session_id=" in sc else sid
        return raw, new_sid

raw, sid = post(f"{ODOO_URL}/web/session/authenticate", {
    "jsonrpc":"2.0","method":"call","id":1,
    "params":{"db":DB,"login":"tigist.haile@mesob.com","password":"Dispatcher@123"}
})
uid = raw["result"]["uid"]
print(f"Tigist uid={uid}")

raw2, _ = post(f"{ODOO_URL}/api/fleet/vehicles", {
    "jsonrpc":"2.0","method":"call","id":2,"params":{}
}, sid)
res2 = raw2.get("result", {})
print(f"Fleet vehicles: success={res2.get('success')}, error={str(res2.get('error','none'))[:100]}")

raw3, _ = post(f"{ODOO_URL}/api/fleet/trip-requests", {
    "jsonrpc":"2.0","method":"call","id":3,"params":{}
}, sid)
res3 = raw3.get("result", {})
print(f"Trip requests: success={res3.get('success')}, count={len(res3.get('trip_requests',[]))}, error={str(res3.get('error','none'))[:80]}")

"""Fix hr_employee_public view — job_title is in hr_version."""
import subprocess, os

PG_HOST = "localhost"; PG_PORT = "5432"
PG_DB = "messob_db"; PG_USER = "odoo"; PG_PASS = "odoo"

def psql(sql):
    env = os.environ.copy(); env["PGPASSWORD"] = PG_PASS
    r = subprocess.run(["psql","-h",PG_HOST,"-p",PG_PORT,"-U",PG_USER,"-d",PG_DB,
                        "-c",sql,"-t","-A"], capture_output=True, text=True, env=env, timeout=15)
    if r.returncode != 0:
        raise RuntimeError(f"psql error: {r.stderr.strip()}")
    return r.stdout.strip()

# Check what columns hr_version has
print("hr_version columns (job-related):")
print(psql("""
SELECT column_name FROM information_schema.columns
WHERE table_name = 'hr_version'
AND (column_name LIKE '%job%' OR column_name LIKE '%title%')
ORDER BY column_name;
"""))

# Check what columns hr_employee has (our custom fields)
print("\nhr_employee custom fleet columns:")
print(psql("""
SELECT column_name FROM information_schema.columns
WHERE table_name = 'hr_employee'
AND column_name IN ('is_driver','driver_license_number','license_expiry_date',
                    'external_hr_id','synced_from_hr','is_fleet_dispatcher','is_fleet_manager')
ORDER BY column_name;
"""))

# Recreate view: job_title from v, fleet fields from e
new_view_sql = """
CREATE OR REPLACE VIEW hr_employee_public AS
SELECT e.id,
    e.id AS employee_id,
    e.name,
    e.active,
    v.create_date,
    v.department_id,
    v.job_id,
    v.company_id,
    v.address_id,
    e.mobile_phone,
    e.work_phone,
    e.work_email,
    e.work_contact_id,
    v.work_location_id,
    e.user_id,
    e.resource_id,
    e.color,
    v.resource_calendar_id,
    e.parent_id,
    e.coach_id,
    v.create_uid,
    v.write_uid,
    v.write_date,
    e.mobility_card,
    e.monday_location_id,
    e.tuesday_location_id,
    e.wednesday_location_id,
    e.thursday_location_id,
    e.friday_location_id,
    e.saturday_location_id,
    e.sunday_location_id,
    e.today_location_name,
    v.job_title,
    COALESCE(e.is_driver, false) AS is_driver,
    e.driver_license_number,
    e.license_expiry_date,
    e.external_hr_id,
    COALESCE(e.synced_from_hr, false) AS synced_from_hr,
    COALESCE(e.is_fleet_dispatcher, false) AS is_fleet_dispatcher,
    COALESCE(e.is_fleet_manager, false) AS is_fleet_manager
FROM hr_employee e
LEFT JOIN hr_version v ON v.id = e.current_version_id;
"""

print("\nRecreating view...")
try:
    result = psql(new_view_sql)
    print(f"✅ View recreated: {result or 'success'}")
except Exception as ex:
    print(f"❌ Failed: {ex}")

# Verify
cols = psql("""
SELECT column_name FROM information_schema.columns
WHERE table_name = 'hr_employee_public'
AND column_name IN ('is_driver', 'job_title', 'external_hr_id')
ORDER BY column_name;
""")
print(f"\nFleet columns in view: {cols}")

# Test: read Biruk's employee via the view
print("\nTesting employee read for Biruk via view:")
result = psql("""
SELECT e.name, e.job_title, e.is_driver
FROM hr_employee_public e
JOIN res_users u ON u.id = e.user_id
WHERE u.login = 'biruk.tadesse@mesob.com';
""")
print(f"Biruk: {result}")

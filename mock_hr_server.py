"""
Mock HR Server for testing MESOB HR Integration
Run this: python mock_hr_server.py
Then set mesob.hr_sync_url = http://localhost:5000/api/employees in Odoo

Each employee has a unique external_hr_id — the Odoo sync uses this to
upsert (update-or-create), so running the sync multiple times will NOT
create duplicates.
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import json

MOCK_EMPLOYEES = [
    # ── Drivers (8 unique) ──────────────────────────────────────────────────
    {
        "external_hr_id": "EMP-DRV-001",
        "name": "Abebe Kebede",
        "email": "abebe.kebede@mesob.com",
        "job_title": "Senior Driver",
        "department": "Fleet Operations",
        "is_driver": True,
        "driver_license_number": "DL-ETH-001",
        "license_expiry_date": "2027-12-31"
    },
    {
        "external_hr_id": "EMP-DRV-002",
        "name": "Sara Tesfaye",
        "email": "sara.tesfaye@mesob.com",
        "job_title": "Driver",
        "department": "Fleet Operations",
        "is_driver": True,
        "driver_license_number": "DL-ETH-002",
        "license_expiry_date": "2026-06-30"
    },
    {
        "external_hr_id": "EMP-DRV-003",
        "name": "Yonas Girma",
        "email": "yonas.girma@mesob.com",
        "job_title": "Driver",
        "department": "Fleet Operations",
        "is_driver": True,
        "driver_license_number": "DL-ETH-003",
        "license_expiry_date": "2028-03-15"
    },
    {
        "external_hr_id": "EMP-DRV-004",
        "name": "Mekdes Alemu",
        "email": "mekdes.alemu@mesob.com",
        "job_title": "Driver",
        "department": "Fleet Operations",
        "is_driver": True,
        "driver_license_number": "DL-ETH-004",
        "license_expiry_date": "2027-09-20"
    },
    {
        "external_hr_id": "EMP-DRV-005",
        "name": "Biruk Tadesse",
        "email": "biruk.tadesse@mesob.com",
        "job_title": "Driver",
        "department": "Fleet Operations",
        "is_driver": True,
        "driver_license_number": "DL-ETH-005",
        "license_expiry_date": "2025-11-30"   # expiring soon — tests alert
    },
    {
        "external_hr_id": "EMP-DRV-006",
        "name": "Hana Worku",
        "email": "hana.worku@mesob.com",
        "job_title": "Driver",
        "department": "Fleet Operations",
        "is_driver": True,
        "driver_license_number": "DL-ETH-006",
        "license_expiry_date": "2029-01-10"
    },
    {
        "external_hr_id": "EMP-DRV-007",
        "name": "Tesfaye Mulugeta",
        "email": "tesfaye.mulugeta@mesob.com",
        "job_title": "Senior Driver",
        "department": "Fleet Operations",
        "is_driver": True,
        "driver_license_number": "DL-ETH-007",
        "license_expiry_date": "2028-07-22"
    },
    {
        "external_hr_id": "EMP-DRV-008",
        "name": "Liya Solomon",
        "email": "liya.solomon@mesob.com",
        "job_title": "Driver",
        "department": "Fleet Operations",
        "is_driver": True,
        "driver_license_number": "DL-ETH-008",
        "license_expiry_date": "2027-04-05"
    },

    # ── Staff / Dispatchers ─────────────────────────────────────────────────
    {
        "external_hr_id": "EMP-STF-001",
        "name": "Tigist Haile",
        "email": "tigist.haile@mesob.com",
        "job_title": "Fleet Dispatcher",
        "department": "Fleet Operations",
        "is_driver": False
    },
    {
        "external_hr_id": "EMP-STF-002",
        "name": "Dawit Bekele",
        "email": "dawit.bekele@mesob.com",
        "job_title": "Staff",
        "department": "Administration",
        "is_driver": False
    },
    {
        "external_hr_id": "EMP-STF-003",
        "name": "Rahel Mekonnen",
        "email": "rahel.mekonnen@mesob.com",
        "job_title": "Fleet Coordinator",
        "department": "Fleet Operations",
        "is_driver": False
    },
    {
        "external_hr_id": "EMP-STF-004",
        "name": "Kebede Worku",
        "email": "kebede.worku@mesob.com",
        "job_title": "Mechanic",
        "department": "Maintenance",
        "is_driver": False
    },
]


class MockHRHandler(BaseHTTPRequestHandler):

    def do_GET(self):
        if self.path == '/api/employees':
            body = json.dumps(MOCK_EMPLOYEES, ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            drivers = [e for e in MOCK_EMPLOYEES if e.get('is_driver')]
            print(f"[HR Mock] Served {len(MOCK_EMPLOYEES)} employees "
                  f"({len(drivers)} drivers, {len(MOCK_EMPLOYEES) - len(drivers)} staff)")
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # suppress default access log; we print manually above


if __name__ == '__main__':
    server = HTTPServer(('localhost', 5000), MockHRHandler)
    drivers = [e for e in MOCK_EMPLOYEES if e.get('is_driver')]
    print("=" * 55)
    print("  Mock HR Server running at http://localhost:5000")
    print("=" * 55)
    print(f"  Employees: {len(MOCK_EMPLOYEES)} total")
    print(f"    Drivers : {len(drivers)}")
    print(f"    Staff   : {len(MOCK_EMPLOYEES) - len(drivers)}")
    print()
    print("  Set in Odoo System Parameters:")
    print("  mesob.hr_sync_url = http://localhost:5000/api/employees")
    print()
    print("  Then trigger sync:")
    print("  Settings → Scheduled Actions → HR Employee Sync → Run Manually")
    print()
    print("  NOTE: Each employee has a unique external_hr_id.")
    print("  Running the sync multiple times will NOT create duplicates.")
    print("=" * 55)
    server.serve_forever()

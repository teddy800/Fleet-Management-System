"""
Mock HR Server for testing MESOB HR Integration
Run this: python mock_hr_server.py
Then set mesob.hr_sync_url = http://localhost:5000/api/employees
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import json

MOCK_EMPLOYEES = [
    {
        "external_hr_id": "EMP001",
        "name": "Abebe Kebede",
        "email": "abebe@mesob.com",
        "job_title": "Driver",
        "department": "Fleet Operations",
        "is_driver": True,
        "driver_license_number": "DL-ETH-001",
        "license_expiry_date": "2027-12-31"
    },
    {
        "external_hr_id": "EMP002",
        "name": "Tigist Haile",
        "email": "tigist@mesob.com",
        "job_title": "Fleet Dispatcher",
        "department": "Fleet Operations",
        "is_driver": False
    },
    {
        "external_hr_id": "EMP003",
        "name": "Dawit Bekele",
        "email": "dawit@mesob.com",
        "job_title": "Staff",
        "department": "Administration",
        "is_driver": False
    },
    {
        "external_hr_id": "EMP004",
        "name": "Sara Tesfaye",
        "email": "sara@mesob.com",
        "job_title": "Driver",
        "department": "Fleet Operations",
        "is_driver": True,
        "driver_license_number": "DL-ETH-002",
        "license_expiry_date": "2026-06-30"
    }
]

class MockHRHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/employees':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(MOCK_EMPLOYEES).encode())
            print(f"Served {len(MOCK_EMPLOYEES)} employees")
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        print(f"[HR Mock] {format % args}")

if __name__ == '__main__':
    server = HTTPServer(('localhost', 5000), MockHRHandler)
    print("Mock HR Server running at http://localhost:5000")
    print("Set mesob.hr_sync_url = http://localhost:5000/api/employees in Odoo")
    print("Press Ctrl+C to stop")
    server.serve_forever()

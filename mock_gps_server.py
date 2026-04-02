"""
Mock GPS Server for testing MESOB GPS Integration
Run this: python mock_gps_server.py
Then set mesob.gps_gateway_url = http://localhost:5001/api/gps in Odoo System Parameters

This server:
1. Serves GET /api/gps  — returns current GPS positions for all vehicles (polled by cron)
2. Accepts POST /api/gps/update — receives GPS updates from devices
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import math
import time
import threading
from datetime import datetime

# Addis Ababa coordinates as base
BASE_LAT = 9.0054
BASE_LNG = 38.7636

# Simulated vehicle GPS data — update vehicle_plate to match your actual plates in Odoo
VEHICLE_GPS_DATA = {
    "AA-12345": {"lat": 9.0054, "lng": 38.7636, "speed": 0,  "heading": 0,   "engine": True,  "fuel": 85.0, "odometer": 45230},
    "AA-001-ET": {"lat": 9.0120, "lng": 38.7700, "speed": 45, "heading": 90,  "engine": True,  "fuel": 62.0, "odometer": 32100},
    "AA-002-ET": {"lat": 8.9980, "lng": 38.7580, "speed": 0,  "heading": 180, "engine": False, "fuel": 91.0, "odometer": 18750},
}

_lock = threading.Lock()
_tick = 0


def simulate_movement():
    """Background thread: moves vehicles slightly each second to simulate live GPS"""
    global _tick
    while True:
        time.sleep(3)
        with _lock:
            _tick += 1
            for plate, data in VEHICLE_GPS_DATA.items():
                if data["engine"] and data["speed"] > 0:
                    # Move vehicle along heading
                    rad = math.radians(data["heading"])
                    delta = data["speed"] * 3 / 3600 / 111  # degrees per 3 seconds
                    data["lat"] += delta * math.cos(rad)
                    data["lng"] += delta * math.sin(rad)
                    data["odometer"] += data["speed"] * 3 / 3600
                    # Slightly vary speed
                    data["speed"] = max(0, data["speed"] + ((_tick % 3) - 1) * 2)


def build_gps_records():
    """Build GPS payload matching what Odoo's create_from_gps_data expects"""
    records = []
    with _lock:
        for plate, data in VEHICLE_GPS_DATA.items():
            records.append({
                "vehicle_plate": plate,
                "latitude": round(data["lat"], 6),
                "longitude": round(data["lng"], 6),
                "speed": round(data["speed"], 1),
                "heading": data["heading"],
                "accuracy": 5.0,
                "altitude": 2355.0,  # Addis Ababa elevation
                "engine_on": data["engine"],
                "fuel_level": data["fuel"],
                "odometer": round(data["odometer"], 1),
                "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
            })
    return records


class MockGPSHandler(BaseHTTPRequestHandler):

    def do_GET(self):
        if self.path == '/api/gps':
            records = build_gps_records()
            body = json.dumps(records).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            print(f"[GPS Mock] Served {len(records)} vehicle positions")
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == '/api/gps/update':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body)
                plate = data.get('vehicle_plate', 'unknown')
                with _lock:
                    if plate in VEHICLE_GPS_DATA:
                        VEHICLE_GPS_DATA[plate].update({
                            "lat": data.get("latitude", VEHICLE_GPS_DATA[plate]["lat"]),
                            "lng": data.get("longitude", VEHICLE_GPS_DATA[plate]["lng"]),
                            "speed": data.get("speed", 0),
                        })
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True}).encode())
                print(f"[GPS Mock] Updated position for {plate}")
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # suppress default logging, we print manually


if __name__ == '__main__':
    # Start movement simulation in background
    t = threading.Thread(target=simulate_movement, daemon=True)
    t.start()

    server = HTTPServer(('localhost', 5001), MockGPSHandler)
    print("=" * 55)
    print("  Mock GPS Server running at http://localhost:5001")
    print("=" * 55)
    print("  GET  /api/gps         — returns all vehicle positions")
    print("  POST /api/gps/update  — update a vehicle position")
    print()
    print("  In Odoo System Parameters set:")
    print("  mesob.gps_gateway_url = http://localhost:5001/api/gps")
    print()
    print("  Simulated vehicles:")
    for plate in VEHICLE_GPS_DATA:
        print(f"    {plate}")
    print()
    print("  Press Ctrl+C to stop")
    print("=" * 55)
    server.serve_forever()

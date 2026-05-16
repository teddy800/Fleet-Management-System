#!/usr/bin/env python3
"""
Mock GPS Tracking Server for Testing
Simulates GPS device updates and vehicle tracking
"""

from flask import Flask, jsonify, request
from datetime import datetime, timedelta
import random
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Mock vehicle locations (Addis Ababa area)
VEHICLES = {
    "AA-12345": {
        "vehicle_id": "AA-12345",
        "latitude": 9.0320,
        "longitude": 38.7469,
        "speed": 45.5,
        "heading": 180,
        "altitude": 2355,
        "accuracy": 5.0,
        "last_update": datetime.now().isoformat(),
        "status": "moving",
        "driver": "Abebe Kebede"
    },
    "AA-67890": {
        "vehicle_id": "AA-67890",
        "latitude": 9.0050,
        "longitude": 38.7636,
        "speed": 0.0,
        "heading": 0,
        "altitude": 2400,
        "accuracy": 3.0,
        "last_update": datetime.now().isoformat(),
        "status": "parked",
        "driver": "Sara Tesfaye"
    },
    "AA-11111": {
        "vehicle_id": "AA-11111",
        "latitude": 8.9806,
        "longitude": 38.7578,
        "speed": 60.2,
        "heading": 90,
        "altitude": 2380,
        "accuracy": 4.5,
        "last_update": datetime.now().isoformat(),
        "status": "moving",
        "driver": "Yonas Girma"
    },
}

def simulate_movement(vehicle_id):
    """Simulate vehicle movement"""
    if vehicle_id in VEHICLES:
        vehicle = VEHICLES[vehicle_id]
        
        # Random movement
        if vehicle['status'] == 'moving':
            vehicle['latitude'] += random.uniform(-0.001, 0.001)
            vehicle['longitude'] += random.uniform(-0.001, 0.001)
            vehicle['speed'] = random.uniform(30, 80)
            vehicle['heading'] = (vehicle['heading'] + random.uniform(-10, 10)) % 360
        
        vehicle['last_update'] = datetime.now().isoformat()
        return vehicle
    return None

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "Mock GPS Tracking System",
        "timestamp": datetime.now().isoformat(),
        "vehicles_tracked": len(VEHICLES)
    })

@app.route('/api/vehicles', methods=['GET'])
def get_all_vehicles():
    """Get all vehicle locations"""
    logger.info(f"Received vehicle list request from {request.remote_addr}")
    
    # Simulate movement for all vehicles
    for vehicle_id in VEHICLES:
        simulate_movement(vehicle_id)
    
    return jsonify({
        "success": True,
        "count": len(VEHICLES),
        "vehicles": list(VEHICLES.values()),
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/vehicles/<vehicle_id>', methods=['GET'])
def get_vehicle_location(vehicle_id):
    """Get single vehicle location"""
    logger.info(f"Received location request for vehicle {vehicle_id}")
    
    vehicle = simulate_movement(vehicle_id)
    
    if vehicle:
        return jsonify({
            "success": True,
            "vehicle": vehicle
        })
    else:
        return jsonify({
            "success": False,
            "error": "Vehicle not found"
        }), 404

@app.route('/api/vehicles/<vehicle_id>/location', methods=['POST'])
def update_vehicle_location(vehicle_id):
    """Update vehicle location (from GPS device)"""
    data = request.get_json()
    logger.info(f"Received location update for vehicle {vehicle_id}")
    
    if vehicle_id not in VEHICLES:
        VEHICLES[vehicle_id] = {
            "vehicle_id": vehicle_id,
            "driver": data.get('driver', 'Unknown')
        }
    
    vehicle = VEHICLES[vehicle_id]
    vehicle.update({
        "latitude": data.get('latitude', vehicle.get('latitude', 0)),
        "longitude": data.get('longitude', vehicle.get('longitude', 0)),
        "speed": data.get('speed', 0),
        "heading": data.get('heading', 0),
        "altitude": data.get('altitude', 2355),
        "accuracy": data.get('accuracy', 5.0),
        "last_update": datetime.now().isoformat(),
        "status": "moving" if data.get('speed', 0) > 5 else "parked"
    })
    
    return jsonify({
        "success": True,
        "message": "Location updated",
        "vehicle": vehicle
    })

@app.route('/api/vehicles/<vehicle_id>/history', methods=['GET'])
def get_vehicle_history(vehicle_id):
    """Get vehicle location history"""
    logger.info(f"Received history request for vehicle {vehicle_id}")
    
    # Generate mock history (last 10 points)
    if vehicle_id not in VEHICLES:
        return jsonify({
            "success": False,
            "error": "Vehicle not found"
        }), 404
    
    vehicle = VEHICLES[vehicle_id]
    history = []
    
    for i in range(10):
        timestamp = datetime.now() - timedelta(minutes=i*5)
        history.append({
            "latitude": vehicle['latitude'] + random.uniform(-0.01, 0.01),
            "longitude": vehicle['longitude'] + random.uniform(-0.01, 0.01),
            "speed": random.uniform(0, 80),
            "timestamp": timestamp.isoformat()
        })
    
    return jsonify({
        "success": True,
        "vehicle_id": vehicle_id,
        "history": history
    })

@app.route('/api/geofence/check', methods=['POST'])
def check_geofence():
    """Check if vehicle is within geofence"""
    data = request.get_json()
    vehicle_id = data.get('vehicle_id')
    geofence = data.get('geofence', {})
    
    logger.info(f"Checking geofence for vehicle {vehicle_id}")
    
    if vehicle_id not in VEHICLES:
        return jsonify({
            "success": False,
            "error": "Vehicle not found"
        }), 404
    
    vehicle = VEHICLES[vehicle_id]
    
    # Simple circular geofence check
    center_lat = geofence.get('center_latitude', 9.0320)
    center_lon = geofence.get('center_longitude', 38.7469)
    radius = geofence.get('radius', 5.0)  # km
    
    # Haversine distance (simplified)
    import math
    lat1, lon1 = math.radians(vehicle['latitude']), math.radians(vehicle['longitude'])
    lat2, lon2 = math.radians(center_lat), math.radians(center_lon)
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    distance = 6371 * 2 * math.asin(math.sqrt(a))
    
    inside = distance <= radius
    
    return jsonify({
        "success": True,
        "vehicle_id": vehicle_id,
        "inside_geofence": inside,
        "distance_from_center": round(distance, 2),
        "geofence_radius": radius
    })

@app.route('/webhook/location', methods=['POST'])
def webhook_location():
    """Webhook endpoint for GPS device push updates"""
    data = request.get_json()
    logger.info(f"Received webhook update: {data}")
    
    vehicle_id = data.get('vehicle_id')
    if not vehicle_id:
        return jsonify({
            "success": False,
            "error": "vehicle_id required"
        }), 400
    
    # Forward to Odoo
    # In production, this would call Odoo's webhook endpoint
    logger.info(f"Would forward to Odoo: {vehicle_id}")
    
    return jsonify({
        "success": True,
        "message": "Webhook received and forwarded"
    })

if __name__ == '__main__':
    print("=" * 60)
    print("🛰️  Mock GPS Tracking Server")
    print("=" * 60)
    print(f"📍 Tracking {len(VEHICLES)} mock vehicles")
    print("🌐 Server starting on http://localhost:5001")
    print("=" * 60)
    print("\nEndpoints:")
    print("  GET  /health                        - Health check")
    print("  GET  /api/vehicles                  - List all vehicles")
    print("  GET  /api/vehicles/<id>             - Get vehicle location")
    print("  POST /api/vehicles/<id>/location    - Update location")
    print("  GET  /api/vehicles/<id>/history     - Get location history")
    print("  POST /api/geofence/check            - Check geofence")
    print("  POST /webhook/location              - Webhook endpoint")
    print("=" * 60)
    print("\nTo configure in Odoo:")
    print("  Settings → System Parameters")
    print("  Key: mesob.gps_gateway_url")
    print("  Value: http://localhost:5001/api/vehicles")
    print("=" * 60)
    print("\nMock Vehicles:")
    for vehicle_id, vehicle in VEHICLES.items():
        print(f"  {vehicle_id} - {vehicle['driver']} ({vehicle['status']})")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=5001, debug=True)

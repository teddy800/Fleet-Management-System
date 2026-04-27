# MESOB Fleet Management - Backend Integration API
# This file shows how to integrate your Python backend with Odoo

import requests
import json
from datetime import datetime
from flask import Flask, jsonify, request
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration - Use mock servers for development
CONFIG = {
    'odoo_url': 'http://localhost:8069',
    'hr_system_url': 'http://localhost:5000',  # Use mock HR server
    'gps_system_url': 'http://localhost:5001',  # Use mock GPS server
    'database': 'messob_db',
    'username': 'admin',
    'password': 'admin'
}

app = Flask(__name__)

class MesobFleetIntegration:
    def __init__(self, odoo_url, database, username, password):
        self.odoo_url = odoo_url
        self.database = database
        self.username = username
        self.password = password
        self.session = requests.Session()
        self.authenticate()
    
    def authenticate(self):
        """Authenticate with Odoo"""
        try:
            auth_url = f"{self.odoo_url}/web/session/authenticate"
            auth_data = {
                'jsonrpc': '2.0',
                'method': 'call',
                'params': {
                    'db': self.database,
                    'login': self.username,
                    'password': self.password
                }
            }
            response = self.session.post(auth_url, json=auth_data)
            result = response.json()
            logger.info("Odoo authentication successful")
            return result
        except Exception as e:
            logger.error(f"Odoo authentication failed: {e}")
            return None
    
    def sync_employees_from_hr(self, hr_api_url):
        """Sync employees from external HR system to Odoo"""
        # Get employees from your HR system
        hr_response = requests.get(hr_api_url)
        employees = hr_response.json()
        
        for employee in employees:
            # Create/update employee in Odoo
            self.create_or_update_employee(employee)
    
    def create_or_update_employee(self, employee_data):
        """Create or update employee in Odoo"""
        url = f"{self.odoo_url}/web/dataset/call_kw"
        data = {
            'jsonrpc': '2.0',
            'method': 'call',
            'params': {
                'model': 'hr.employee',
                'method': '_upsert_employee',
                'args': [employee_data],
                'kwargs': {}
            }
        }
        response = self.session.post(url, json=data)
        return response.json()
    
    def update_vehicle_location(self, vehicle_id, latitude, longitude):
        """Update vehicle GPS location"""
        url = f"{self.odoo_url}/web/dataset/call_kw"
        data = {
            'jsonrpc': '2.0',
            'method': 'call',
            'params': {
                'model': 'fleet.vehicle',
                'method': 'update_location',
                'args': [vehicle_id, latitude, longitude],
                'kwargs': {}
            }
        }
        response = self.session.post(url, json=data)
        return response.json()
    
    def create_trip_request(self, employee_id, purpose, start_date, end_date, pickup, destination):
        """Create trip request from mobile app"""
        url = f"{self.odoo_url}/web/dataset/call_kw"
        data = {
            'jsonrpc': '2.0',
            'method': 'call',
            'params': {
                'model': 'mesob.trip.request',
                'method': 'create',
                'args': [{
                    'employee_id': employee_id,
                    'purpose': purpose,
                    'start_datetime': start_date,
                    'end_datetime': end_date,
                    'pickup_location': pickup,
                    'destination_location': destination,
                    'state': 'pending'
                }],
                'kwargs': {}
            }
        }
        response = self.session.post(url, json=data)
        return response.json()
    
    def get_fleet_dashboard_data(self):
        """Get dashboard data for mobile app"""
        url = f"{self.odoo_url}/web/dataset/call_kw"
        data = {
            'jsonrpc': '2.0',
            'method': 'call',
            'params': {
                'model': 'fleet.vehicle',
                'method': 'search_read',
                'args': [[]],
                'kwargs': {
                    'fields': ['name', 'license_plate', 'mesob_status', 'current_odometer', 'maintenance_due']
                }
            }
        }
        response = self.session.post(url, json=data)
        return response.json()
    
    def send_notification(self, recipient, subject, message):
        """Send notification via external service"""
        # This would integrate with your notification backend
        notification_data = {
            'recipient': recipient,
            'subject': subject,
            'message': message,
            'timestamp': datetime.now().isoformat()
        }
        # Send to your notification service
        # requests.post('http://your-notification-service/api/send', json=notification_data)
        return notification_data

# Example usage:
if __name__ == "__main__":
    # Initialize integration
    fleet_api = MesobFleetIntegration(
        odoo_url="http://localhost:8069",
        database="messob_db",
        username="admin",
        password="admin"
    )
    
    # Sync employees from HR system
    fleet_api.sync_employees_from_hr("http://your-hr-system/api/employees")
    
    # Update vehicle location
    fleet_api.update_vehicle_location(1, 9.0192, 38.7525)
    
    # Create trip request
    fleet_api.create_trip_request(
        employee_id=1,
        purpose="Business meeting",
        start_date="2024-03-27 09:00:00",
        end_date="2024-03-27 17:00:00",
        pickup="Office",
        destination="Client location"
    )
    
    # Get dashboard data
    dashboard_data = fleet_api.get_fleet_dashboard_data()
    print(json.dumps(dashboard_data, indent=2))
    def sync_hr_employees(self):
        """Sync employees from HR system to Odoo"""
        try:
            # Get employees from mock HR server
            hr_response = requests.get(f"{CONFIG['hr_system_url']}/api/employees")
            if hr_response.status_code == 200:
                employees = hr_response.json()
                logger.info(f"Retrieved {len(employees)} employees from HR system")
                
                # Send to Odoo webhook
                webhook_url = f"{self.odoo_url}/webhook/hr/employee-sync"
                webhook_data = {'employees': employees}
                
                odoo_response = self.session.post(webhook_url, json=webhook_data)
                if odoo_response.status_code == 200:
                    result = odoo_response.json()
                    logger.info(f"HR sync completed: {result}")
                    return result
                else:
                    logger.error(f"Odoo webhook failed: {odoo_response.status_code}")
                    return None
            else:
                logger.error(f"HR system request failed: {hr_response.status_code}")
                return None
        except Exception as e:
            logger.error(f"HR sync failed: {e}")
            return None

    def get_gps_updates(self):
        """Get GPS updates from GPS system"""
        try:
            gps_response = requests.get(f"{CONFIG['gps_system_url']}/api/gps")
            if gps_response.status_code == 200:
                gps_data = gps_response.json()
                logger.info(f"Retrieved GPS data for {len(gps_data)} vehicles")
                return gps_data
            else:
                logger.error(f"GPS system request failed: {gps_response.status_code}")
                return None
        except Exception as e:
            logger.error(f"GPS update failed: {e}")
            return None

# Initialize integration
integration = MesobFleetIntegration(
    CONFIG['odoo_url'],
    CONFIG['database'],
    CONFIG['username'],
    CONFIG['password']
)

# Flask API endpoints
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'services': {
            'odoo': CONFIG['odoo_url'],
            'hr_system': CONFIG['hr_system_url'],
            'gps_system': CONFIG['gps_system_url']
        }
    })

@app.route('/sync/hr', methods=['POST'])
def sync_hr():
    """Trigger HR employee sync"""
    result = integration.sync_hr_employees()
    if result:
        return jsonify({'success': True, 'result': result})
    else:
        return jsonify({'success': False, 'error': 'HR sync failed'}), 500

@app.route('/gps/updates', methods=['GET'])
def get_gps():
    """Get current GPS positions"""
    result = integration.get_gps_updates()
    if result:
        return jsonify({'success': True, 'data': result})
    else:
        return jsonify({'success': False, 'error': 'GPS update failed'}), 500

if __name__ == '__main__':
    logger.info("🚀 Starting MESSOB Fleet Integration API...")
    logger.info(f"📡 Odoo URL: {CONFIG['odoo_url']}")
    logger.info(f"👥 HR System: {CONFIG['hr_system_url']}")
    logger.info(f"📍 GPS System: {CONFIG['gps_system_url']}")
    logger.info("🌐 Integration API running at http://localhost:8080")
    
    app.run(host='0.0.0.0', port=8080, debug=True)
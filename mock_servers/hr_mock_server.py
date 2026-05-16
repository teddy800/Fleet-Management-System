#!/usr/bin/env python3
"""
Mock HR System Server for Testing
Simulates an external HR system that provides employee data
"""

from flask import Flask, jsonify, request
from datetime import datetime
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Mock employee database
EMPLOYEES = [
    {
        "external_hr_id": "HR001",
        "name": "Abebe Kebede",
        "email": "abebe.kebede@mesob.com",
        "phone": "+251911234567",
        "job_title": "Driver",
        "department": "Fleet Operations",
        "is_driver": True,
        "driver_license": "AA-123456",
        "license_expiry": "2025-12-31",
        "hire_date": "2020-01-15",
        "status": "active"
    },
    {
        "external_hr_id": "HR002",
        "name": "Sara Tesfaye",
        "email": "sara.tesfaye@mesob.com",
        "phone": "+251911234568",
        "job_title": "Driver",
        "department": "Fleet Operations",
        "is_driver": True,
        "driver_license": "AA-123457",
        "license_expiry": "2026-03-15",
        "hire_date": "2020-03-20",
        "status": "active"
    },
    {
        "external_hr_id": "HR003",
        "name": "Biruk Tadesse",
        "email": "biruk.tadesse@mesob.com",
        "phone": "+251911234569",
        "job_title": "Mechanic",
        "department": "Maintenance",
        "is_driver": False,
        "hire_date": "2019-06-10",
        "status": "active"
    },
    {
        "external_hr_id": "HR004",
        "name": "Tigist Haile",
        "email": "tigist.haile@mesob.com",
        "phone": "+251911234570",
        "job_title": "Fleet Dispatcher",
        "department": "Fleet Operations",
        "is_driver": False,
        "hire_date": "2018-09-01",
        "status": "active"
    },
    {
        "external_hr_id": "HR005",
        "name": "Dawit Bekele",
        "email": "dawit.bekele@mesob.com",
        "phone": "+251911234571",
        "job_title": "Staff Member",
        "department": "Administration",
        "is_driver": False,
        "hire_date": "2021-02-15",
        "status": "active"
    },
]

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "Mock HR System",
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/employees', methods=['GET'])
def get_employees():
    """Get all employees"""
    logger.info(f"Received employee list request from {request.remote_addr}")
    
    # Check for API key (optional)
    api_key = request.headers.get('X-API-Key')
    if api_key:
        logger.info(f"Request authenticated with API key: {api_key[:8]}...")
    
    # Filter by status if provided
    status = request.args.get('status', 'active')
    filtered_employees = [e for e in EMPLOYEES if e.get('status') == status]
    
    return jsonify({
        "success": True,
        "count": len(filtered_employees),
        "employees": filtered_employees,
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/employees/<external_id>', methods=['GET'])
def get_employee(external_id):
    """Get single employee by external ID"""
    logger.info(f"Received employee detail request for {external_id}")
    
    employee = next((e for e in EMPLOYEES if e['external_hr_id'] == external_id), None)
    
    if employee:
        return jsonify({
            "success": True,
            "employee": employee
        })
    else:
        return jsonify({
            "success": False,
            "error": "Employee not found"
        }), 404

@app.route('/api/employees', methods=['POST'])
def create_employee():
    """Create new employee (for testing)"""
    data = request.get_json()
    logger.info(f"Creating new employee: {data.get('name')}")
    
    # Generate new ID
    max_id = max([int(e['external_hr_id'][2:]) for e in EMPLOYEES])
    new_id = f"HR{max_id + 1:03d}"
    
    new_employee = {
        "external_hr_id": new_id,
        "status": "active",
        **data
    }
    
    EMPLOYEES.append(new_employee)
    
    return jsonify({
        "success": True,
        "employee": new_employee
    }), 201

@app.route('/api/sync', methods=['POST'])
def trigger_sync():
    """Trigger sync endpoint (webhook style)"""
    logger.info("Sync triggered via webhook")
    
    return jsonify({
        "success": True,
        "message": "Sync triggered",
        "employees_count": len(EMPLOYEES)
    })

if __name__ == '__main__':
    print("=" * 60)
    print("🏢 Mock HR System Server")
    print("=" * 60)
    print(f"📊 Loaded {len(EMPLOYEES)} mock employees")
    print("🌐 Server starting on http://localhost:5000")
    print("=" * 60)
    print("\nEndpoints:")
    print("  GET  /health              - Health check")
    print("  GET  /api/employees       - List all employees")
    print("  GET  /api/employees/<id>  - Get employee by ID")
    print("  POST /api/employees       - Create employee")
    print("  POST /api/sync            - Trigger sync")
    print("=" * 60)
    print("\nTo configure in Odoo:")
    print("  Settings → System Parameters")
    print("  Key: mesob.hr_sync_url")
    print("  Value: http://localhost:5000/api/employees")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=5000, debug=True)

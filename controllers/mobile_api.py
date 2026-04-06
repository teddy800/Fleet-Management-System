from odoo import http
from odoo.http import request
import json
import logging
from datetime import datetime

_logger = logging.getLogger(__name__)


class MobileAPIController(http.Controller):
    
    @http.route('/api/mobile/auth/login', type='json', auth='none', methods=['POST'], csrf=False, cors='*')
    def mobile_login(self):
        """Mobile authentication endpoint"""
        try:
            data = request.jsonrequest
            username = data.get('username')
            password = data.get('password')
            
            if not username or not password:
                return {
                    'success': False,
                    'error': 'Username and password are required'
                }
            
            # Authenticate user
            uid = request.session.authenticate(request.session.db, username, password)
            
            if uid:
                user = request.env['res.users'].browse(uid)
                employee = request.env['hr.employee'].search([('user_id', '=', uid)], limit=1)
                
                # Get user roles
                roles = []
                if user.has_group('mesob_fleet_customizations.group_fleet_manager'):
                    roles.append('fleet_manager')
                if user.has_group('mesob_fleet_customizations.group_fleet_dispatcher'):
                    roles.append('fleet_dispatcher')
                if user.has_group('mesob_fleet_customizations.group_fleet_user'):
                    roles.append('fleet_user')
                if employee and employee.is_driver:
                    roles.append('driver')
                
                return {
                    'success': True,
                    'user': {
                        'id': user.id,
                        'name': user.name,
                        'email': user.email,
                        'employee_id': employee.id if employee else None,
                        'is_driver': employee.is_driver if employee else False,
                        'roles': roles
                    },
                    'session_id': request.session.sid
                }
            else:
                return {
                    'success': False,
                    'error': 'Invalid credentials'
                }
                
        except Exception as e:
            _logger.error(f"Mobile login error: {e}")
            return {
                'success': False,
                'error': 'Authentication failed'
            }
    
    @http.route('/api/mobile/driver/assignments', type='json', auth='user', methods=['GET'])
    def get_driver_assignments(self):
        """Get assignments for current driver"""
        try:
            employee = request.env['hr.employee'].search([
                ('user_id', '=', request.env.uid)
            ], limit=1)
            
            if not employee or not employee.is_driver:
                return {
                    'success': False,
                    'error': 'User is not a driver'
                }
            
            assignments = request.env['mesob.trip.assignment'].search([
                ('driver_id', '=', employee.id),
                ('state', 'in', ['assigned', 'in_progress'])
            ])
            
            assignment_data = []
            for assignment in assignments:
                assignment_data.append({
                    'id': assignment.id,
                    'trip_request': {
                        'id': assignment.trip_request_id.id,
                        'purpose': assignment.trip_request_id.purpose,
                        'requester': assignment.trip_request_id.employee_id.name,
                        'pickup_location': assignment.trip_request_id.pickup_location,
                        'destination_location': assignment.trip_request_id.destination_location,
                        'start_datetime': assignment.trip_request_id.start_datetime.isoformat(),
                        'end_datetime': assignment.trip_request_id.end_datetime.isoformat()
                    },
                    'vehicle': {
                        'id': assignment.vehicle_id.id,
                        'name': assignment.vehicle_id.name,
                        'license_plate': assignment.vehicle_id.license_plate
                    },
                    'state': assignment.state,
                    'start_datetime': assignment.start_datetime.isoformat(),
                    'end_datetime': assignment.end_datetime.isoformat()
                })
            
            return {
                'success': True,
                'assignments': assignment_data
            }
            
        except Exception as e:
            _logger.error(f"Get driver assignments error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @http.route('/api/mobile/trip/<int:assignment_id>/start', type='json', auth='user', methods=['POST'])
    def start_trip(self, assignment_id):
        """Start a trip assignment"""
        try:
            assignment = request.env['mesob.trip.assignment'].browse(assignment_id)
            
            if not assignment.exists():
                return {
                    'success': False,
                    'error': 'Assignment not found'
                }
            
            # Check if current user is the assigned driver
            employee = request.env['hr.employee'].search([
                ('user_id', '=', request.env.uid)
            ], limit=1)
            
            if not employee or assignment.driver_id.id != employee.id:
                return {
                    'success': False,
                    'error': 'Unauthorized access'
                }
            
            # Start the trip
            assignment.write({
                'state': 'in_progress',
                'actual_start_datetime': datetime.now()
            })
            
            # Update trip request status
            assignment.trip_request_id.write({
                'state': 'in_progress',
                'actual_start_datetime': datetime.now()
            })
            
            # Update vehicle status
            assignment.vehicle_id.write({
                'mesob_status': 'in_use'
            })
            
            return {
                'success': True,
                'message': 'Trip started successfully'
            }
            
        except Exception as e:
            _logger.error(f"Start trip error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @http.route('/api/mobile/trip/<int:assignment_id>/complete', type='json', auth='user', methods=['POST'])
    def complete_trip(self, assignment_id):
        """Complete a trip assignment"""
        try:
            data = request.jsonrequest
            assignment = request.env['mesob.trip.assignment'].browse(assignment_id)
            
            if not assignment.exists():
                return {
                    'success': False,
                    'error': 'Assignment not found'
                }
            
            # Check if current user is the assigned driver
            employee = request.env['hr.employee'].search([
                ('user_id', '=', request.env.uid)
            ], limit=1)
            
            if not employee or assignment.driver_id.id != employee.id:
                return {
                    'success': False,
                    'error': 'Unauthorized access'
                }
            
            # Complete the trip
            assignment.write({
                'state': 'completed',
                'actual_end_datetime': datetime.now(),
                'actual_distance': data.get('actual_distance', 0),
                'end_odometer': data.get('end_odometer', 0),
                'notes': data.get('notes', '')
            })
            
            # Update trip request status
            assignment.trip_request_id.write({
                'state': 'completed',
                'actual_end_datetime': datetime.now(),
                'actual_distance': data.get('actual_distance', 0)
            })
            
            # Update vehicle status and odometer
            assignment.vehicle_id.write({
                'mesob_status': 'available',
                'current_odometer': data.get('end_odometer', assignment.vehicle_id.current_odometer)
            })
            
            return {
                'success': True,
                'message': 'Trip completed successfully'
            }
            
        except Exception as e:
            _logger.error(f"Complete trip error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @http.route('/api/mobile/trip/<int:assignment_id>/update-location', type='json', auth='user', methods=['POST'])
    def update_trip_location(self, assignment_id):
        """Update current location during trip"""
        try:
            data = request.jsonrequest
            assignment = request.env['mesob.trip.assignment'].browse(assignment_id)
            
            if not assignment.exists():
                return {
                    'success': False,
                    'error': 'Assignment not found'
                }
            
            # Check if current user is the assigned driver
            employee = request.env['hr.employee'].search([
                ('user_id', '=', request.env.uid)
            ], limit=1)
            
            if not employee or assignment.driver_id.id != employee.id:
                return {
                    'success': False,
                    'error': 'Unauthorized access'
                }
            
            # Update vehicle location
            assignment.vehicle_id.update_gps_location(
                data.get('latitude'),
                data.get('longitude'),
                data.get('speed', 0),
                data.get('heading', 0),
                data.get('accuracy', 0)
            )
            
            return {
                'success': True,
                'message': 'Location updated successfully'
            }
            
        except Exception as e:
            _logger.error(f"Update trip location error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @http.route('/api/mobile/user/trip-requests', type='json', auth='user', methods=['GET'])
    def get_user_trip_requests(self):
        """Get trip requests for current user"""
        try:
            employee = request.env['hr.employee'].search([
                ('user_id', '=', request.env.uid)
            ], limit=1)
            
            if not employee:
                return {
                    'success': False,
                    'error': 'Employee record not found'
                }
            
            trip_requests = request.env['mesob.trip.request'].search([
                ('employee_id', '=', employee.id)
            ], order='create_date desc', limit=50)
            
            request_data = []
            for trip_request in trip_requests:
                request_data.append({
                    'id': trip_request.id,
                    'name': trip_request.name,
                    'purpose': trip_request.purpose,
                    'state': trip_request.state,
                    'vehicle_category': trip_request.vehicle_category,
                    'start_datetime': trip_request.start_datetime.isoformat(),
                    'end_datetime': trip_request.end_datetime.isoformat(),
                    'pickup_location': trip_request.pickup_location,
                    'destination_location': trip_request.destination_location,
                    'assigned_vehicle': trip_request.assigned_vehicle_id.name if trip_request.assigned_vehicle_id else None,
                    'assigned_driver': trip_request.assigned_driver_id.name if trip_request.assigned_driver_id else None,
                    'create_date': trip_request.create_date.isoformat()
                })
            
            return {
                'success': True,
                'trip_requests': request_data
            }
            
        except Exception as e:
            _logger.error(f"Get user trip requests error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @http.route('/api/mobile/quick-request', type='json', auth='user', methods=['POST'])
    def create_quick_request(self):
        """Create a quick trip request from mobile"""
        try:
            data = request.jsonrequest
            
            employee = request.env['hr.employee'].search([
                ('user_id', '=', request.env.uid)
            ], limit=1)
            
            if not employee:
                return {
                    'success': False,
                    'error': 'Employee record not found'
                }
            
            # Create minimal trip request
            trip_request = request.env['mesob.trip.request'].create({
                'employee_id': employee.id,
                'purpose': data.get('purpose', 'Quick Request'),
                'vehicle_category': data.get('vehicle_category', 'sedan'),
                'start_datetime': data.get('start_datetime'),
                'end_datetime': data.get('end_datetime'),
                'pickup_location': data.get('pickup_location', 'Current Location'),
                'destination_location': data.get('destination_location'),
                'priority': data.get('priority', 'normal'),
                'trip_type': 'official'
            })
            
            # Auto-submit if requested
            if data.get('auto_submit', False):
                trip_request.action_submit()
            
            return {
                'success': True,
                'trip_request_id': trip_request.id,
                'message': 'Quick request created successfully'
            }
            
        except Exception as e:
            _logger.error(f"Create quick request error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @http.route('/api/mobile/vehicles/nearby', type='json', auth='user', methods=['POST'])
    def get_nearby_vehicles(self):
        """Get vehicles near a specific location"""
        try:
            data = request.jsonrequest
            user_lat = data.get('latitude')
            user_lng = data.get('longitude')
            radius = data.get('radius', 10)  # 10 km default radius
            
            if not user_lat or not user_lng:
                return {
                    'success': False,
                    'error': 'Location coordinates are required'
                }
            
            # Get all available vehicles with GPS data
            vehicles = request.env['fleet.vehicle'].search([
                ('mesob_status', '=', 'available'),
                ('current_latitude', '!=', 0),
                ('current_longitude', '!=', 0)
            ])
            
            nearby_vehicles = []
            for vehicle in vehicles:
                # Calculate distance
                distance = self._calculate_distance(
                    user_lat, user_lng,
                    vehicle.current_latitude, vehicle.current_longitude
                )
                
                if distance <= radius:
                    nearby_vehicles.append({
                        'id': vehicle.id,
                        'name': vehicle.name,
                        'license_plate': vehicle.license_plate,
                        'vehicle_category': vehicle.mesob_vehicle_category,
                        'distance': round(distance, 2),
                        'location': {
                            'latitude': vehicle.current_latitude,
                            'longitude': vehicle.current_longitude
                        },
                        'driver': vehicle.assigned_driver_id.name if vehicle.assigned_driver_id else None
                    })
            
            # Sort by distance
            nearby_vehicles.sort(key=lambda x: x['distance'])
            
            return {
                'success': True,
                'vehicles': nearby_vehicles
            }
            
        except Exception as e:
            _logger.error(f"Get nearby vehicles error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _calculate_distance(self, lat1, lon1, lat2, lon2):
        """Calculate distance between two GPS coordinates"""
        import math
        
        # Convert to radians
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
        
        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        # Earth's radius in kilometers
        return 6371 * c
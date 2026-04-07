# flake8: noqa
# pyright: ignore
from odoo import http  # type: ignore
from odoo.http import request  # type: ignore
from odoo.tools import config  # type: ignore
import logging
from datetime import datetime

_logger = logging.getLogger(__name__)


class MobileAPIController(http.Controller):

    @http.route('/api/mobile/auth/login', type='json', auth='none', methods=['POST'], csrf=False, cors='*')
    def mobile_login(self):
        """Mobile authentication endpoint — Odoo 19 compatible"""
        try:
            # In Odoo 19, type='json' routes put parsed params in request.params
            # The frontend sends: {"username":"admin","password":"admin"}
            # Odoo 19 jsonrpc dispatcher puts this in request.params directly
            params = request.params or {}
            username = str(params.get('username', '')).strip()
            password = str(params.get('password', ''))

            _logger.info(f"Login attempt: username='{username}', params_keys={list(params.keys())}")

            if not username or not password:
                return {'success': False, 'error': 'Username and password are required'}

            # In Odoo 19 with auth='none', session.db may be empty — fall back to config
            db = request.session.db or config.get('db_name') or 'messob_db'
            _logger.info(f"Authenticating user '{username}' against db '{db}'")

            # Authenticate — sets session.uid on success, returns uid or False
            uid = request.session.authenticate(db, username, password)
            _logger.info(f"Authentication result for '{username}': uid={uid}")

            if not uid:
                return {'success': False, 'error': 'Invalid credentials'}

            # Build response using the authenticated user's environment
            env = request.env(user=uid)
            user = env['res.users'].browse(uid)
            employee = env['hr.employee'].search([('user_id', '=', uid)], limit=1)

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
                    'email': user.email or '',
                    'employee_id': employee.id if employee else None,
                    'is_driver': bool(employee and employee.is_driver),
                    'roles': roles,
                },
                'session_id': request.session.sid,
            }

        except Exception as e:
            _logger.error(f"Mobile login error: {e}", exc_info=True)
            return {'success': False, 'error': 'Authentication failed'}

    @http.route('/api/mobile/driver/assignments', type='json', auth='user', methods=['GET'])
    def get_driver_assignments(self):
        """Get assignments for current driver"""
        try:
            employee = request.env['hr.employee'].search([('user_id', '=', request.env.uid)], limit=1)
            if not employee or not employee.is_driver:
                return {'success': False, 'error': 'User is not a driver'}

            assignments = request.env['mesob.trip.assignment'].search([
                ('driver_id', '=', employee.id),
                ('state', 'in', ['assigned', 'in_progress'])
            ])

            data = []
            for a in assignments:
                data.append({
                    'id': a.id,
                    'trip_request': {
                        'id': a.trip_request_id.id,
                        'purpose': a.trip_request_id.purpose,
                        'requester': a.trip_request_id.employee_id.name,
                        'pickup_location': a.trip_request_id.pickup_location,
                        'destination_location': a.trip_request_id.destination_location,
                        'start_datetime': a.trip_request_id.start_datetime.isoformat(),
                        'end_datetime': a.trip_request_id.end_datetime.isoformat(),
                    },
                    'vehicle': {
                        'id': a.vehicle_id.id,
                        'name': a.vehicle_id.name,
                        'license_plate': a.vehicle_id.license_plate,
                    },
                    'state': a.state,
                    'start_datetime': a.start_datetime.isoformat(),
                    'end_datetime': a.end_datetime.isoformat(),
                })
            return {'success': True, 'assignments': data}
        except Exception as e:
            _logger.error(f"Get driver assignments error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/mobile/trip/<int:assignment_id>/start', type='json', auth='user', methods=['POST'])
    def start_trip(self, assignment_id):
        """Start a trip assignment"""
        try:
            assignment = request.env['mesob.trip.assignment'].browse(assignment_id)
            if not assignment.exists():
                return {'success': False, 'error': 'Assignment not found'}

            employee = request.env['hr.employee'].search([('user_id', '=', request.env.uid)], limit=1)
            if not employee or assignment.driver_id.id != employee.id:
                return {'success': False, 'error': 'Unauthorized access'}

            assignment.write({'state': 'in_progress', 'actual_start_datetime': datetime.now()})
            assignment.trip_request_id.write({'state': 'in_progress', 'actual_start_datetime': datetime.now()})
            assignment.vehicle_id.write({'mesob_status': 'in_use'})
            return {'success': True, 'message': 'Trip started successfully'}
        except Exception as e:
            _logger.error(f"Start trip error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/mobile/trip/<int:assignment_id>/complete', type='json', auth='user', methods=['POST'])
    def complete_trip(self, assignment_id):
        """Complete a trip assignment"""
        try:
            data = request.get_json_data() or {}
            assignment = request.env['mesob.trip.assignment'].browse(assignment_id)
            if not assignment.exists():
                return {'success': False, 'error': 'Assignment not found'}

            employee = request.env['hr.employee'].search([('user_id', '=', request.env.uid)], limit=1)
            if not employee or assignment.driver_id.id != employee.id:
                return {'success': False, 'error': 'Unauthorized access'}

            assignment.write({
                'state': 'completed',
                'actual_end_datetime': datetime.now(),
                'actual_distance': data.get('actual_distance', 0),
                'end_odometer': data.get('end_odometer', 0),
                'notes': data.get('notes', ''),
            })
            assignment.trip_request_id.write({
                'state': 'completed',
                'actual_end_datetime': datetime.now(),
                'actual_distance': data.get('actual_distance', 0),
            })
            assignment.vehicle_id.write({
                'mesob_status': 'available',
                'current_odometer': data.get('end_odometer', assignment.vehicle_id.current_odometer),
            })
            return {'success': True, 'message': 'Trip completed successfully'}
        except Exception as e:
            _logger.error(f"Complete trip error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/mobile/trip/<int:assignment_id>/update-location', type='json', auth='user', methods=['POST'])
    def update_trip_location(self, assignment_id):
        """Update current location during trip"""
        try:
            data = request.get_json_data() or {}
            assignment = request.env['mesob.trip.assignment'].browse(assignment_id)
            if not assignment.exists():
                return {'success': False, 'error': 'Assignment not found'}

            employee = request.env['hr.employee'].search([('user_id', '=', request.env.uid)], limit=1)
            if not employee or assignment.driver_id.id != employee.id:
                return {'success': False, 'error': 'Unauthorized access'}

            assignment.vehicle_id.update_gps_location(
                data.get('latitude'), data.get('longitude'),
                data.get('speed', 0), data.get('heading', 0), data.get('accuracy', 0)
            )
            return {'success': True, 'message': 'Location updated successfully'}
        except Exception as e:
            _logger.error(f"Update trip location error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/mobile/user/trip-requests', type='json', auth='user', methods=['GET'])
    def get_user_trip_requests(self):
        """Get trip requests for current user"""
        try:
            employee = request.env['hr.employee'].search([('user_id', '=', request.env.uid)], limit=1)
            if not employee:
                return {'success': False, 'error': 'Employee record not found'}

            trip_requests = request.env['mesob.trip.request'].search(
                [('employee_id', '=', employee.id)], order='create_date desc', limit=50
            )

            data = []
            for tr in trip_requests:
                data.append({
                    'id': tr.id,
                    'name': tr.name,
                    'purpose': tr.purpose,
                    'state': tr.state,
                    'vehicle_category': tr.vehicle_category,
                    'start_datetime': tr.start_datetime.isoformat() if tr.start_datetime else None,
                    'end_datetime': tr.end_datetime.isoformat() if tr.end_datetime else None,
                    'pickup_location': tr.pickup_location,
                    'destination_location': tr.destination_location,
                    'assigned_vehicle': tr.assigned_vehicle_id.name if tr.assigned_vehicle_id else None,
                    'assigned_driver': tr.assigned_driver_id.name if tr.assigned_driver_id else None,
                    'create_date': tr.create_date.isoformat() if tr.create_date else None,
                })
            return {'success': True, 'trip_requests': data}
        except Exception as e:
            _logger.error(f"Get user trip requests error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/mobile/quick-request', type='json', auth='user', methods=['POST'])
    def create_quick_request(self):
        """Create a quick trip request from mobile"""
        try:
            data = request.get_json_data() or {}
            employee = request.env['hr.employee'].search([('user_id', '=', request.env.uid)], limit=1)
            if not employee:
                return {'success': False, 'error': 'Employee record not found'}

            trip_request = request.env['mesob.trip.request'].create({
                'employee_id': employee.id,
                'purpose': data.get('purpose', 'Quick Request'),
                'vehicle_category': data.get('vehicle_category', 'sedan'),
                'start_datetime': data.get('start_datetime'),
                'end_datetime': data.get('end_datetime'),
                'pickup_location': data.get('pickup_location', 'Current Location'),
                'destination_location': data.get('destination_location'),
                'priority': data.get('priority', 'normal'),
                'trip_type': 'official',
            })
            if data.get('auto_submit', False):
                trip_request.action_submit()
            return {'success': True, 'trip_request_id': trip_request.id, 'message': 'Quick request created'}
        except Exception as e:
            _logger.error(f"Create quick request error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/mobile/vehicles/nearby', type='json', auth='user', methods=['POST'])
    def get_nearby_vehicles(self):
        """Get vehicles near a specific location"""
        try:
            data = request.get_json_data() or {}
            user_lat = data.get('latitude')
            user_lng = data.get('longitude')
            radius = data.get('radius', 10)

            if not user_lat or not user_lng:
                return {'success': False, 'error': 'Location coordinates are required'}

            vehicles = request.env['fleet.vehicle'].search([
                ('mesob_status', '=', 'available'),
                ('current_latitude', '!=', 0),
                ('current_longitude', '!=', 0),
            ])

            nearby = []
            for v in vehicles:
                dist = self._haversine(user_lat, user_lng, v.current_latitude, v.current_longitude)
                if dist <= radius:
                    nearby.append({
                        'id': v.id, 'name': v.name, 'license_plate': v.license_plate,
                        'vehicle_category': v.mesob_vehicle_category,
                        'distance': round(dist, 2),
                        'location': {'latitude': v.current_latitude, 'longitude': v.current_longitude},
                        'driver': v.assigned_driver_id.name if v.assigned_driver_id else None,
                    })
            nearby.sort(key=lambda x: x['distance'])
            return {'success': True, 'vehicles': nearby}
        except Exception as e:
            _logger.error(f"Get nearby vehicles error: {e}")
            return {'success': False, 'error': str(e)}

    def _haversine(self, lat1, lon1, lat2, lon2):
        import math
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
        dlat, dlon = lat2 - lat1, lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        return 6371 * 2 * math.asin(math.sqrt(a))

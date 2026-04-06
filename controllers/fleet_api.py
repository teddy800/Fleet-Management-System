from odoo import http
from odoo.http import request
import json
import logging
from datetime import datetime

_logger = logging.getLogger(__name__)


class FleetAPIController(http.Controller):
    
    @http.route('/api/fleet/dashboard', type='json', auth='user', methods=['GET'], cors='*')
    def get_dashboard_data(self):
        """Get comprehensive dashboard data"""
        try:
            analytics = request.env['mesob.fleet.analytics']
            dashboard_data = analytics.get_comprehensive_dashboard()
            
            return {
                'success': True,
                'data': dashboard_data,
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            _logger.error(f"Dashboard API error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @http.route('/api/fleet/vehicles', type='json', auth='user', methods=['GET'], cors='*')
    def get_vehicles(self):
        """Get all vehicles with enhanced data"""
        try:
            vehicles = request.env['fleet.vehicle'].search([])
            vehicle_data = []
            
            for vehicle in vehicles:
                vehicle_data.append({
                    'id': vehicle.id,
                    'name': vehicle.name,
                    'license_plate': vehicle.license_plate,
                    'mesob_status': vehicle.mesob_status,
                    'current_odometer': vehicle.current_odometer,
                    'maintenance_due': vehicle.maintenance_due,
                    'fuel_efficiency': vehicle.fuel_efficiency,
                    'utilization_rate': vehicle.utilization_rate,
                    'current_location': {
                        'latitude': vehicle.current_latitude,
                        'longitude': vehicle.current_longitude,
                        'last_update': vehicle.last_gps_update.isoformat() if vehicle.last_gps_update else None
                    },
                    'vehicle_category': vehicle.mesob_vehicle_category,
                    'assigned_driver': vehicle.assigned_driver_id.name if vehicle.assigned_driver_id else None
                })
            
            return {
                'success': True,
                'vehicles': vehicle_data
            }
        except Exception as e:
            _logger.error(f"Vehicles API error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @http.route('/api/fleet/trip-requests', type='json', auth='user', methods=['POST'], cors='*')
    def create_trip_request(self, **kwargs):
        """Create a new trip request"""
        try:
            data = request.params
            
            # Get current employee
            employee = request.env['hr.employee'].search([
                ('user_id', '=', request.env.uid)
            ], limit=1)
            
            if not employee:
                return {
                    'success': False,
                    'error': 'Employee record not found for current user'
                }
            
            # Create trip request
            trip_request = request.env['mesob.trip.request'].create({
                'employee_id': employee.id,
                'purpose': data.get('purpose'),
                'vehicle_category': data.get('vehicle_category'),
                'start_datetime': data.get('start_datetime'),
                'end_datetime': data.get('end_datetime'),
                'pickup_location': data.get('pickup_location'),
                'destination_location': data.get('destination_location'),
                'passenger_count': data.get('passenger_count', 1),
                'priority': data.get('priority', 'normal'),
                'trip_type': data.get('trip_type', 'official')
            })
            
            # Submit the request
            trip_request.action_submit()
            
            return {
                'success': True,
                'trip_request_id': trip_request.id,
                'message': 'Trip request created successfully'
            }
            
        except Exception as e:
            _logger.error(f"Create trip request API error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @http.route('/api/fleet/trip-requests/<int:request_id>/approve', type='json', auth='user', methods=['POST'], cors='*')
    def approve_trip_request(self, request_id):
        """Approve a trip request"""
        try:
            # Check dispatcher permissions
            if not request.env.user.has_group('mesob_fleet_customizations.group_fleet_dispatcher'):
                return {
                    'success': False,
                    'error': 'Insufficient permissions'
                }
            
            trip_request = request.env['mesob.trip.request'].browse(request_id)
            if not trip_request.exists():
                return {
                    'success': False,
                    'error': 'Trip request not found'
                }
            
            trip_request.action_approve()
            
            return {
                'success': True,
                'message': 'Trip request approved successfully'
            }
            
        except Exception as e:
            _logger.error(f"Approve trip request API error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @http.route('/api/fleet/trip-requests/<int:request_id>/assign', type='json', auth='user', methods=['POST'], cors='*')
    def assign_vehicle(self, request_id):
        """Assign vehicle and driver to trip request"""
        try:
            data = request.params
            
            # Check dispatcher permissions
            if not request.env.user.has_group('mesob_fleet_customizations.group_fleet_dispatcher'):
                return {
                    'success': False,
                    'error': 'Insufficient permissions'
                }
            
            trip_request = request.env['mesob.trip.request'].browse(request_id)
            if not trip_request.exists():
                return {
                    'success': False,
                    'error': 'Trip request not found'
                }
            
            vehicle_id = data.get('vehicle_id')
            driver_id = data.get('driver_id')
            
            if not vehicle_id or not driver_id:
                return {
                    'success': False,
                    'error': 'Vehicle and driver are required'
                }
            
            trip_request.action_assign_vehicle(vehicle_id, driver_id)
            
            return {
                'success': True,
                'message': 'Vehicle assigned successfully'
            }
            
        except Exception as e:
            _logger.error(f"Assign vehicle API error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @http.route('/api/fleet/gps/update', type='json', auth='public', methods=['POST'])
    def update_gps_location(self):
        """Update GPS location from external service"""
        try:
            data = request.params
            
            # Validate API key (implement your authentication logic)
            api_key = request.httprequest.headers.get('X-API-Key')
            if not self._validate_api_key(api_key):
                return {
                    'success': False,
                    'error': 'Invalid API key'
                }
            
            # Create GPS log
            gps_log = request.env['mesob.gps.log'].sudo().create_from_gps_data(data)
            
            if gps_log:
                return {
                    'success': True,
                    'message': 'GPS location updated successfully'
                }
            else:
                return {
                    'success': False,
                    'error': 'Failed to update GPS location'
                }
                
        except Exception as e:
            _logger.error(f"GPS update API error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @http.route('/api/fleet/vehicles/<int:vehicle_id>/location', type='json', auth='user', methods=['GET'], cors='*')
    def get_vehicle_location(self, vehicle_id):
        """Get current location of a specific vehicle"""
        try:
            vehicle = request.env['fleet.vehicle'].browse(vehicle_id)
            if not vehicle.exists():
                return {
                    'success': False,
                    'error': 'Vehicle not found'
                }
            
            return {
                'success': True,
                'location': {
                    'vehicle_id': vehicle.id,
                    'vehicle_name': vehicle.name,
                    'latitude': vehicle.current_latitude,
                    'longitude': vehicle.current_longitude,
                    'speed': vehicle.current_speed,
                    'heading': vehicle.current_heading,
                    'last_update': vehicle.last_gps_update.isoformat() if vehicle.last_gps_update else None
                }
            }
            
        except Exception as e:
            _logger.error(f"Get vehicle location API error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @http.route('/api/fleet/analytics/kpis', type='json', auth='user', methods=['GET'], cors='*')
    def get_kpis(self):
        """Get key performance indicators"""
        try:
            analytics = request.env['mesob.fleet.analytics']
            kpis = analytics._get_key_performance_indicators()
            
            return {
                'success': True,
                'kpis': kpis
            }
            
        except Exception as e:
            _logger.error(f"KPIs API error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @http.route('/api/fleet/maintenance/predictions', type='json', auth='user', methods=['GET'], cors='*')
    def get_maintenance_predictions(self):
        """Get maintenance predictions"""
        try:
            analytics = request.env['mesob.fleet.analytics']
            predictions = analytics._get_predictive_insights()
            
            return {
                'success': True,
                'predictions': predictions['maintenance_predictions']
            }
            
        except Exception as e:
            _logger.error(f"Maintenance predictions API error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _validate_api_key(self, api_key):
        """Validate API key for external services"""
        # Implement your API key validation logic
        # For now, using a simple check
        valid_key = request.env['ir.config_parameter'].sudo().get_param('mesob.api_key')
        return api_key == valid_key

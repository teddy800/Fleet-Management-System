# flake8: noqa
# pyright: ignore
from odoo import http  # type: ignore
from odoo.http import request  # type: ignore
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
    
    @http.route('/api/fleet/trip-requests', type='json', auth='user', methods=['GET', 'POST'], cors='*')
    def trip_requests(self, **kwargs):
        """GET: list all pending trip requests (dispatcher). POST: create a new trip request."""
        if request.httprequest.method == 'GET':
            return self._list_trip_requests()
        return self._create_trip_request()

    def _list_trip_requests(self):
        """List trip requests - all pending for dispatcher, own for staff"""
        try:
            is_dispatcher = request.env.user.has_group('mesob_fleet_customizations.group_fleet_dispatcher') or \
                            request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager')
            if is_dispatcher:
                trip_requests = request.env['mesob.trip.request'].search([], order='create_date desc', limit=100)
            else:
                employee = request.env['hr.employee'].search([('user_id', '=', request.env.uid)], limit=1)
                if not employee:
                    return {'success': False, 'error': 'Employee record not found'}
                trip_requests = request.env['mesob.trip.request'].search(
                    [('employee_id', '=', employee.id)], order='create_date desc', limit=50)

            data = []
            for tr in trip_requests:
                data.append({
                    'id': tr.id,
                    'name': tr.name,
                    'purpose': tr.purpose,
                    'state': tr.state,
                    'employee_name': tr.employee_id.name if tr.employee_id else '',
                    'vehicle_category': tr.vehicle_category,
                    'start_datetime': tr.start_datetime.isoformat() if tr.start_datetime else None,
                    'end_datetime': tr.end_datetime.isoformat() if tr.end_datetime else None,
                    'pickup_location': tr.pickup_location,
                    'destination_location': tr.destination_location,
                    'passenger_count': tr.passenger_count,
                    'priority': tr.priority,
                    'trip_type': tr.trip_type,
                    'assigned_vehicle': tr.assigned_vehicle_id.name if tr.assigned_vehicle_id else None,
                    'assigned_driver': tr.assigned_driver_id.name if tr.assigned_driver_id else None,
                    'create_date': tr.create_date.isoformat() if tr.create_date else None,
                })
            return {'success': True, 'trip_requests': data}
        except Exception as e:
            _logger.error(f"List trip requests error: {e}")
            return {'success': False, 'error': str(e)}

    def _create_trip_request(self, **kwargs):
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
    
    @http.route('/api/fleet/trip-requests/<int:request_id>/reject', type='json', auth='user', methods=['POST'], cors='*')
    def reject_trip_request(self, request_id):
        """Reject a trip request"""
        try:
            if not request.env.user.has_group('mesob_fleet_customizations.group_fleet_dispatcher'):
                return {'success': False, 'error': 'Insufficient permissions'}
            trip_request = request.env['mesob.trip.request'].browse(request_id)
            if not trip_request.exists():
                return {'success': False, 'error': 'Trip request not found'}
            data = request.jsonrequest or {}
            trip_request.action_reject()
            if data.get('reason'):
                trip_request.write({'rejection_reason': data.get('reason')})
            return {'success': True, 'message': 'Trip request rejected'}
        except Exception as e:
            _logger.error(f"Reject trip request error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/fleet/fuel-logs', type='json', auth='user', methods=['GET'], cors='*')
    def get_fuel_logs(self):
        """Get fuel logs"""
        try:
            logs = request.env['mesob.fuel.log'].search([], order='date desc', limit=100)
            data = []
            for log in logs:
                data.append({
                    'id': log.id,
                    'vehicle_name': log.vehicle_id.name if log.vehicle_id else '',
                    'driver_name': log.driver_id.name if log.driver_id else '',
                    'date': log.date.isoformat() if log.date else None,
                    'fuel_station': log.fuel_station,
                    'volume': log.volume,
                    'cost': log.cost,
                    'odometer': log.odometer,
                    'fuel_efficiency': log.fuel_efficiency,
                })
            return {'success': True, 'fuel_logs': data}
        except Exception as e:
            _logger.error(f"Fuel logs error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/fleet/maintenance-logs', type='json', auth='user', methods=['GET'], cors='*')
    def get_maintenance_logs(self):
        """Get maintenance logs"""
        try:
            logs = request.env['mesob.maintenance.log'].search([], order='date desc', limit=100)
            data = []
            for log in logs:
                data.append({
                    'id': log.id,
                    'vehicle_name': log.vehicle_id.name if log.vehicle_id else '',
                    'maintenance_type': log.maintenance_type,
                    'state': log.state,
                    'date': log.date.isoformat() if log.date else None,
                    'technician': log.technician_id.name if log.technician_id else '',
                    'cost': log.cost,
                    'description': log.description,
                    'odometer': log.odometer,
                })
            return {'success': True, 'maintenance_logs': data}
        except Exception as e:
            _logger.error(f"Maintenance logs error: {e}")
            return {'success': False, 'error': str(e)}

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
        valid_key = request.env['ir.config_parameter'].sudo().get_param('mesob.api_key')
        return api_key == valid_key

    @http.route('/api/fleet/drivers', type='json', auth='user', methods=['GET'], cors='*')
    def get_drivers(self):
        """Get all available drivers (is_driver=True employees)"""
        try:
            drivers = request.env['hr.employee'].search([('is_driver', '=', True)])
            data = []
            for d in drivers:
                data.append({
                    'id': d.id,
                    'name': d.name,
                    'license_number': d.driver_license_number,
                    'license_expiry': d.license_expiry_date.isoformat() if d.license_expiry_date else None,
                    'active_trips': d.active_trip_count,
                })
            return {'success': True, 'drivers': data}
        except Exception as e:
            _logger.error(f"Get drivers error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/fleet/trip-requests/<int:request_id>/cancel', type='json', auth='user', methods=['POST'], cors='*')
    def cancel_trip_request(self, request_id):
        """Cancel own trip request (FR-1.3: only if pending)"""
        try:
            trip_request = request.env['mesob.trip.request'].browse(request_id)
            if not trip_request.exists():
                return {'success': False, 'error': 'Trip request not found'}
            if not trip_request.can_cancel:
                return {'success': False, 'error': 'This request cannot be cancelled'}
            trip_request.action_cancel()
            return {'success': True, 'message': 'Trip request cancelled'}
        except Exception as e:
            _logger.error(f"Cancel trip request error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/fleet/trip-requests/<int:request_id>/update-pickup', type='json', auth='user', methods=['POST'], cors='*')
    def update_pickup_point(self, request_id):
        """FR-3.4: Update pickup point on active trip"""
        try:
            data = request.jsonrequest or {}
            trip_request = request.env['mesob.trip.request'].browse(request_id)
            if not trip_request.exists():
                return {'success': False, 'error': 'Trip request not found'}
            if trip_request.state not in ['approved', 'assigned', 'in_progress']:
                return {'success': False, 'error': 'Pickup can only be updated on active trips'}
            trip_request.write({
                'pickup_location': data.get('pickup_location', trip_request.pickup_location),
                'pickup_updated': True,
                'pickup_update_note': data.get('note', ''),
            })
            return {'success': True, 'message': 'Pickup point updated'}
        except Exception as e:
            _logger.error(f"Update pickup error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/fleet/maintenance-schedules', type='json', auth='user', methods=['GET'], cors='*')
    def get_maintenance_schedules(self):
        """FR-4.3: Get maintenance schedules with overdue status"""
        try:
            schedules = request.env['mesob.maintenance.schedule'].search([])
            data = []
            for s in schedules:
                data.append({
                    'id': s.id,
                    'vehicle_name': s.vehicle_id.name if s.vehicle_id else '',
                    'maintenance_type': s.maintenance_type,
                    'interval_km': s.interval_km,
                    'interval_days': s.interval_days,
                    'last_odometer': s.last_odometer,
                    'last_service_date': s.last_service_date.isoformat() if s.last_service_date else None,
                    'next_due_odometer': s.next_due_odometer,
                    'next_due_date': s.next_due_date.isoformat() if s.next_due_date else None,
                    'is_overdue': s.is_overdue,
                })
            return {'success': True, 'schedules': data}
        except Exception as e:
            _logger.error(f"Maintenance schedules error: {e}")
            return {'success': False, 'error': str(e)}

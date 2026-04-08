# flake8: noqa
# pyright: ignore
from odoo import http  # type: ignore
from odoo.http import request  # type: ignore
import json
import logging
from datetime import datetime, timezone

_logger = logging.getLogger(__name__)


class FleetAPIController(http.Controller):
    
    @http.route('/api/fleet/dashboard', type='json', auth='user', methods=['GET', 'POST'], cors='*')
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
    
    @http.route('/api/fleet/vehicles', type='json', auth='user', methods=['GET', 'POST'], cors='*')
    def get_vehicles(self):
        """Get all vehicles with enhanced data — dispatcher/manager only for full list"""
        try:
            is_dispatcher = request.env.user.has_group('mesob_fleet_customizations.group_fleet_dispatcher') or \
                            request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager')
            if not is_dispatcher:
                return {'success': False, 'error': 'Insufficient permissions'}
            vehicles = request.env['fleet.vehicle'].search([])
            vehicle_data = []
            
            for vehicle in vehicles:
                vehicle_data.append({
                    'id': vehicle.id,
                    'name': vehicle.name,
                    'license_plate': vehicle.license_plate,
                    'mesob_status': vehicle.mesob_status or 'available',
                    'current_odometer': vehicle.current_odometer,
                    'maintenance_due': vehicle.maintenance_due,
                    'fuel_efficiency': vehicle.fuel_efficiency,
                    'utilization_rate': vehicle.utilization_rate,
                    'current_location': {
                        'latitude': vehicle.current_latitude,
                        'longitude': vehicle.current_longitude,
                        'last_update': vehicle.last_gps_update.isoformat() if vehicle.last_gps_update else None
                    },
                    'vehicle_category': vehicle.mesob_vehicle_category or 'sedan',
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
        """List trip requests - all pending for dispatcher (oldest first per FR-2.1), own for staff"""
        try:
            is_dispatcher = request.env.user.has_group('mesob_fleet_customizations.group_fleet_dispatcher') or \
                            request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager')
            if is_dispatcher:
                # FR-2.1: sorted by request date, oldest first
                trip_requests = request.env['mesob.trip.request'].search([], order='create_date asc', limit=100)
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

    def _parse_datetime(self, dt_str):
        """Parse ISO 8601 or Odoo datetime string into 'YYYY-MM-DD HH:MM:SS' format."""
        if not dt_str:
            return None
        # Already in Odoo format
        if 'T' not in str(dt_str):
            return dt_str
        try:
            # Handle ISO 8601 with Z or +offset
            dt_str = str(dt_str).replace('Z', '+00:00')
            dt = datetime.fromisoformat(dt_str)
            # Convert to UTC naive for Odoo storage
            if dt.tzinfo is not None:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
            return dt.strftime('%Y-%m-%d %H:%M:%S')
        except Exception:
            # Fallback: strip timezone suffix and truncate
            clean = str(dt_str).split('.')[0].replace('T', ' ')[:19]
            return clean

    def _create_trip_request(self, **kwargs):
        try:
            data = request.params or {}

            # Get current employee
            employee = request.env['hr.employee'].search([
                ('user_id', '=', request.env.uid)
            ], limit=1)

            if not employee:
                return {
                    'success': False,
                    'error': 'Employee record not found for current user'
                }

            # Validate required fields
            vehicle_category = data.get('vehicle_category') or 'sedan'
            purpose = data.get('purpose', '').strip()
            pickup_location = data.get('pickup_location', '').strip()
            destination_location = data.get('destination_location', '').strip()

            if not purpose:
                return {'success': False, 'error': 'Trip purpose is required'}
            if not pickup_location:
                return {'success': False, 'error': 'Pickup location is required'}
            if not destination_location:
                return {'success': False, 'error': 'Destination location is required'}

            # Parse datetimes — frontend sends ISO 8601, Odoo needs '%Y-%m-%d %H:%M:%S'
            start_dt = self._parse_datetime(data.get('start_datetime'))
            end_dt = self._parse_datetime(data.get('end_datetime'))

            if not start_dt or not end_dt:
                return {'success': False, 'error': 'Start and end datetime are required'}

            # Create trip request
            trip_request = request.env['mesob.trip.request'].create({
                'employee_id': employee.id,
                'purpose': purpose,
                'vehicle_category': vehicle_category,
                'start_datetime': start_dt,
                'end_datetime': end_dt,
                'pickup_location': pickup_location,
                'pickup_latitude': float(data.get('pickup_latitude') or 0.0),
                'pickup_longitude': float(data.get('pickup_longitude') or 0.0),
                'destination_location': destination_location,
                'destination_latitude': float(data.get('destination_latitude') or 0.0),
                'destination_longitude': float(data.get('destination_longitude') or 0.0),
                'passenger_count': int(data.get('passenger_count') or 1),
                'priority': data.get('priority') or 'normal',
                'trip_type': data.get('trip_type') or 'official',
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
            data = request.params or {}
            
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
            data = request.params or {}
            trip_request.action_reject(reason=data.get('reason'))
            return {'success': True, 'message': 'Trip request rejected'}
        except Exception as e:
            _logger.error(f"Reject trip request error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/fleet/fuel-logs', type='json', auth='user', methods=['GET', 'POST'], cors='*')
    def get_fuel_logs(self):
        """Get fuel logs — dispatcher/manager only (NFR-3.2)"""
        try:
            if not (request.env.user.has_group('mesob_fleet_customizations.group_fleet_dispatcher') or
                    request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager')):
                return {'success': False, 'error': 'Insufficient permissions'}
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
                    'fuel_efficiency': log.efficiency,
                })
            return {'success': True, 'fuel_logs': data}
        except Exception as e:
            _logger.error(f"Fuel logs error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/fleet/maintenance-logs', type='json', auth='user', methods=['GET', 'POST'], cors='*')
    def get_maintenance_logs(self):
        """Get maintenance logs — dispatcher/manager only (NFR-3.2)"""
        try:
            if not (request.env.user.has_group('mesob_fleet_customizations.group_fleet_dispatcher') or
                    request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager')):
                return {'success': False, 'error': 'Insufficient permissions'}
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
    
    @http.route('/api/fleet/vehicles/<int:vehicle_id>/location', type='json', auth='user', methods=['GET', 'POST'], cors='*')
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
    
    @http.route('/api/fleet/analytics/kpis', type='json', auth='user', methods=['GET', 'POST'], cors='*')
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
    
    @http.route('/api/fleet/maintenance/predictions', type='json', auth='user', methods=['GET', 'POST'], cors='*')
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
    
    @http.route('/api/fleet/alerts', type='json', auth='user', methods=['GET', 'POST'], cors='*')
    def get_alerts(self):
        """Get active fleet alerts — dispatcher/manager only (NFR-3.2, FR-4.3)"""
        try:
            if not (request.env.user.has_group('mesob_fleet_customizations.group_fleet_dispatcher') or
                    request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager')):
                return {'success': False, 'error': 'Insufficient permissions'}

            data = []

            # Try the dedicated alert model first; fall back to computed alerts if not installed
            try:
                alerts = request.env['mesob.fleet.alert'].search(
                    [('resolved', '=', False)], order='timestamp desc', limit=100
                )
                for a in alerts:
                    data.append({
                        'id': a.id,
                        'alert_type': a.alert_type,
                        'vehicle_name': a.vehicle_id.name if a.vehicle_id else None,
                        'driver_name': a.driver_id.name if a.driver_id else None,
                        'message': a.message,
                        'severity': a.severity,
                        'timestamp': a.timestamp.isoformat() if a.timestamp else None,
                        'acknowledged': a.acknowledged,
                        'resolved': a.resolved,
                    })
            except Exception:
                # Model not installed — generate alerts from maintenance schedules
                try:
                    schedules = request.env['mesob.maintenance.schedule'].search([('is_overdue', '=', True)])
                    for s in schedules:
                        data.append({
                            'id': s.id,
                            'alert_type': 'maintenance_due',
                            'vehicle_name': s.vehicle_id.name if s.vehicle_id else None,
                            'driver_name': None,
                            'message': f"Maintenance overdue: {s.maintenance_type} for {s.vehicle_id.name if s.vehicle_id else 'vehicle'}",
                            'severity': 'high',
                            'timestamp': s.next_due_date.isoformat() if s.next_due_date else None,
                            'acknowledged': False,
                            'resolved': False,
                        })
                except Exception:
                    pass

            return {'success': True, 'alerts': data}
        except Exception as e:
            _logger.error(f"Get alerts error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/fleet/alerts/<int:alert_id>/acknowledge', type='json', auth='user', methods=['POST'], cors='*')
    def acknowledge_alert(self, alert_id):
        """Acknowledge a fleet alert"""
        try:
            alert = request.env['mesob.fleet.alert'].browse(alert_id)
            if not alert.exists():
                return {'success': False, 'error': 'Alert not found'}
            alert.action_acknowledge()
            return {'success': True, 'message': 'Alert acknowledged'}
        except Exception as e:
            _logger.error(f"Acknowledge alert error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/fleet/available-resources', type='json', auth='user', methods=['POST'], cors='*')
    def get_available_resources(self):
        """FR-2.2: Get vehicles and drivers available for a specific time window.
        Filters out any already assigned to overlapping trips."""
        try:
            if not (request.env.user.has_group('mesob_fleet_customizations.group_fleet_dispatcher') or
                    request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager')):
                return {'success': False, 'error': 'Insufficient permissions'}

            data = request.params or {}
            start_dt = data.get('start_datetime')
            end_dt = data.get('end_datetime')
            vehicle_category = data.get('vehicle_category')

            if not start_dt or not end_dt:
                return {'success': False, 'error': 'start_datetime and end_datetime are required'}

            # Find conflicting assignment IDs in the time window
            conflicting = request.env['mesob.trip.assignment'].search([
                ('state', 'in', ['assigned', 'in_progress']),
                ('start_datetime', '<', end_dt),
                ('end_datetime', '>', start_dt),
            ])
            busy_vehicle_ids = conflicting.mapped('vehicle_id').ids
            busy_driver_ids  = conflicting.mapped('driver_id').ids

            # Available vehicles: not busy, not in maintenance, matching category
            vehicle_domain = [
                ('mesob_status', '=', 'available'),
                ('id', 'not in', busy_vehicle_ids),
            ]
            if vehicle_category:
                vehicle_domain.append(('mesob_vehicle_category', '=', vehicle_category))

            vehicles = request.env['fleet.vehicle'].search(vehicle_domain)
            vehicle_data = [{
                'id': v.id,
                'name': v.name,
                'license_plate': v.license_plate,
                'vehicle_category': v.mesob_vehicle_category or 'sedan',
                'mesob_status': v.mesob_status or 'available',
                'current_odometer': v.current_odometer,
            } for v in vehicles]

            # Available drivers: is_driver, not busy
            drivers = request.env['hr.employee'].search([
                ('is_driver', '=', True),
                ('id', 'not in', busy_driver_ids),
            ])
            driver_data = [{
                'id': d.id,
                'name': d.name,
                'license_number': d.driver_license_number,
                'license_expiry': d.license_expiry_date.isoformat() if d.license_expiry_date else None,
            } for d in drivers]

            return {'success': True, 'vehicles': vehicle_data, 'drivers': driver_data}
        except Exception as e:
            _logger.error(f"Available resources error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/fleet/users', type='json', auth='user', methods=['GET', 'POST'], cors='*')
    def get_users(self):
        """FR-5.1: List all fleet users — manager only"""
        try:
            if not request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager'):
                return {'success': False, 'error': 'Insufficient permissions'}
            users = request.env['res.users'].search([('active', '=', True), ('share', '=', False)])
            data = []
            for u in users:
                employee = request.env['hr.employee'].search([('user_id', '=', u.id)], limit=1)
                roles = []
                if u.has_group('mesob_fleet_customizations.group_fleet_manager'):
                    roles.append('fleet_manager')
                if u.has_group('mesob_fleet_customizations.group_fleet_dispatcher'):
                    roles.append('fleet_dispatcher')
                if u.has_group('mesob_fleet_customizations.group_fleet_user'):
                    roles.append('fleet_user')
                data.append({
                    'id': u.id,
                    'name': u.name,
                    'email': u.email or '',
                    'login': u.login,
                    'active': u.active,
                    'roles': roles,
                    'employee_id': employee.id if employee else None,
                    'is_driver': bool(employee and employee.is_driver),
                })
            return {'success': True, 'users': data}
        except Exception as e:
            _logger.error(f"Get users error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/fleet/users/<int:user_id>/set-role', type='json', auth='user', methods=['POST'], cors='*')
    def set_user_role(self, user_id):
        """FR-5.1: Assign role to a user — manager only"""
        try:
            if not request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager'):
                return {'success': False, 'error': 'Insufficient permissions'}
            data = request.params or {}
            role = data.get('role')  # 'fleet_manager' | 'fleet_dispatcher' | 'fleet_user'
            user = request.env['res.users'].browse(user_id)
            if not user.exists():
                return {'success': False, 'error': 'User not found'}
            group_map = {
                'fleet_manager':    'mesob_fleet_customizations.group_fleet_manager',
                'fleet_dispatcher': 'mesob_fleet_customizations.group_fleet_dispatcher',
                'fleet_user':       'mesob_fleet_customizations.group_fleet_user',
            }
            if role not in group_map:
                return {'success': False, 'error': f'Invalid role: {role}'}
            # Remove all fleet groups first, then add the new one
            for gref in group_map.values():
                try:
                    grp = request.env.ref(gref)
                    user.sudo().write({'groups_id': [(3, grp.id)]})
                except Exception:
                    pass
            grp = request.env.ref(group_map[role])
            user.sudo().write({'groups_id': [(4, grp.id)]})
            return {'success': True, 'message': f'Role {role} assigned to {user.name}'}
        except Exception as e:
            _logger.error(f"Set user role error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/fleet/drivers/<int:driver_id>', type='json', auth='user', methods=['POST'], cors='*')
    def update_driver(self, driver_id):
        """FR-5.2: Update driver profile — manager only"""
        try:
            if not request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager'):
                return {'success': False, 'error': 'Insufficient permissions'}
            data = request.params or {}
            driver = request.env['hr.employee'].browse(driver_id)
            if not driver.exists():
                return {'success': False, 'error': 'Driver not found'}
            vals = {}
            if 'license_number' in data:
                vals['driver_license_number'] = data['license_number']
            if 'license_expiry' in data:
                vals['license_expiry_date'] = data['license_expiry']
            if 'is_driver' in data:
                vals['is_driver'] = bool(data['is_driver'])
            if vals:
                driver.write(vals)
            return {'success': True, 'message': 'Driver updated'}
        except Exception as e:
            _logger.error(f"Update driver error: {e}")
            return {'success': False, 'error': str(e)}

    def _validate_api_key(self, api_key):
        """Validate API key for external services"""
        valid_key = request.env['ir.config_parameter'].sudo().get_param('mesob.api_key')
        return api_key == valid_key

    @http.route('/api/fleet/drivers', type='json', auth='user', methods=['GET', 'POST'], cors='*')
    def get_drivers(self):
        """Get all available drivers — dispatcher/manager only (NFR-3.2)"""
        try:
            if not (request.env.user.has_group('mesob_fleet_customizations.group_fleet_dispatcher') or
                    request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager')):
                return {'success': False, 'error': 'Insufficient permissions'}
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
            data = request.params or {}
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

    @http.route('/api/fleet/maintenance-schedules', type='json', auth='user', methods=['GET', 'POST'], cors='*')
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

    @http.route('/api/fleet/trip-requests/<int:request_id>/co-passengers', type='json', auth='user', methods=['GET', 'POST'], cors='*')
    def get_co_passengers(self, request_id):
        """FR-3.3: Get co-passengers sharing the same trip assignment"""
        try:
            trip_request = request.env['mesob.trip.request'].browse(request_id)
            if not trip_request.exists():
                return {'success': False, 'error': 'Trip request not found'}

            co_passengers = []

            # Find other requests sharing the same trip assignment
            if trip_request.trip_assignment_id:
                others = request.env['mesob.trip.request'].search([
                    ('trip_assignment_id', '=', trip_request.trip_assignment_id.id),
                    ('id', '!=', request_id),
                    ('state', 'in', ['approved', 'assigned', 'in_progress']),
                ])
                for other in others:
                    co_passengers.append({
                        'id': other.id,
                        'name': other.employee_id.name if other.employee_id else '',
                        'pickup_location': other.pickup_location,
                        'pickup_latitude': other.pickup_latitude,
                        'pickup_longitude': other.pickup_longitude,
                        'pickup_updated': other.pickup_updated,
                        'pickup_update_note': other.pickup_update_note or '',
                    })

            return {
                'success': True,
                'trip_id': request_id,
                'co_passengers': co_passengers,
                'total': len(co_passengers),
            }
        except Exception as e:
            _logger.error(f"Co-passengers error: {e}")
            return {'success': False, 'error': str(e)}



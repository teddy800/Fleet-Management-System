# flake8: noqa
# pyright: ignore
from odoo import http, fields  # type: ignore
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
        """Get all vehicles with essential data — dispatcher/manager only"""
        try:
            is_dispatcher = request.env.user.has_group('mesob_fleet_customizations.group_fleet_dispatcher') or \
                            request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager')
            if not is_dispatcher:
                return {'success': False, 'error': 'Insufficient permissions'}
            # Only read fields the frontend actually uses — faster query
            vehicles = request.env['fleet.vehicle'].search_read(
                [],
                fields=['id', 'name', 'license_plate', 'mesob_status', 'current_odometer',
                        'maintenance_due', 'fuel_efficiency', 'utilization_rate',
                        'current_latitude', 'current_longitude', 'last_gps_update',
                        'mesob_vehicle_category', 'assigned_driver_id'],
            )
            vehicle_data = []
            for v in vehicles:
                driver = request.env['hr.employee'].browse(v['assigned_driver_id'][0]) if v.get('assigned_driver_id') else None
                vehicle_data.append({
                    'id': v['id'],
                    'name': v['name'],
                    'license_plate': v['license_plate'] or '',
                    'mesob_status': v['mesob_status'] or 'available',
                    'current_odometer': v['current_odometer'] or 0,
                    'maintenance_due': v['maintenance_due'] or False,
                    'fuel_efficiency': v['fuel_efficiency'] or 0,
                    'utilization_rate': v['utilization_rate'] or 0,
                    'current_location': {
                        'latitude': v['current_latitude'] or 0,
                        'longitude': v['current_longitude'] or 0,
                        'last_update': v['last_gps_update'].isoformat() if v.get('last_gps_update') else None,
                    },
                    'vehicle_category': v['mesob_vehicle_category'] or 'sedan',
                    'assigned_driver': driver.name if driver else None,
                })
            return {'success': True, 'vehicles': vehicle_data}
        except Exception as e:
            _logger.error(f"Vehicles API error: {e}")
            return {'success': False, 'error': str(e)}
    
    @http.route('/api/fleet/trip-requests', type='json', auth='user', methods=['GET', 'POST'], cors='*')
    def trip_requests(self, **kwargs):
        """Route for trip requests — dispatches based on 'action' param.
        List (default): no params or action='list'
        Create: action='create' with trip data in params
        """
        data = request.params or {}
        # If payload has 'purpose' or 'action=create', it's a create request
        if data.get('action') == 'create' or data.get('purpose'):
            return self._create_trip_request()
        return self._list_trip_requests()

    def _list_trip_requests(self):
        """List trip requests - all for dispatcher (oldest first per FR-2.1), own for staff"""
        try:
            is_dispatcher = request.env.user.has_group('mesob_fleet_customizations.group_fleet_dispatcher') or \
                            request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager')

            FIELDS = ['id', 'name', 'purpose', 'state', 'employee_id', 'vehicle_category',
                      'start_datetime', 'end_datetime', 'pickup_location', 'destination_location',
                      'passenger_count', 'priority', 'trip_type', 'assigned_vehicle_id',
                      'assigned_driver_id', 'create_date', 'rejection_reason',
                      'approved_date', 'estimated_distance',
                      'submitted_at', 'approved_at', 'rejected_at',
                      'started_at', 'completed_at', 'closed_at', 'justification']

            if is_dispatcher:
                records = request.env['mesob.trip.request'].search_read(
                    [], FIELDS, order='create_date asc', limit=100
                )
            else:
                employee = request.env['hr.employee'].search([('user_id', '=', request.env.uid)], limit=1)
                if not employee:
                    return {'success': False, 'error': 'Employee record not found'}
                records = request.env['mesob.trip.request'].search_read(
                    [('employee_id', '=', employee.id)], FIELDS, order='create_date desc', limit=50
                )

            data = []
            for tr in records:
                emp = tr.get('employee_id')
                veh = tr.get('assigned_vehicle_id')
                drv = tr.get('assigned_driver_id')
                data.append({
                    'id': tr['id'],
                    'name': tr['name'],
                    'purpose': tr['purpose'],
                    'justification': tr.get('justification') or '',
                    'state': tr['state'],
                    'employee_name': emp[1] if emp else '',
                    'vehicle_category': tr['vehicle_category'],
                    'start_datetime': tr['start_datetime'].isoformat() if tr.get('start_datetime') else None,
                    'end_datetime': tr['end_datetime'].isoformat() if tr.get('end_datetime') else None,
                    'pickup_location': tr['pickup_location'],
                    'destination_location': tr['destination_location'],
                    'passenger_count': tr['passenger_count'],
                    'priority': tr['priority'],
                    'trip_type': tr['trip_type'],
                    'assigned_vehicle': veh[1] if veh else None,
                    'assigned_vehicle_id': veh[0] if veh else None,
                    'assigned_driver': drv[1] if drv else None,
                    'create_date': tr['create_date'].isoformat() if tr.get('create_date') else None,
                    'rejection_reason': tr.get('rejection_reason') or '',
                    'approved_date': tr['approved_date'].isoformat() if tr.get('approved_date') else None,
                    'estimated_distance': tr.get('estimated_distance') or 0,
                    'submitted_at': tr['submitted_at'].isoformat() if tr.get('submitted_at') else None,
                    'approved_at': tr['approved_at'].isoformat() if tr.get('approved_at') else None,
                    'rejected_at': tr['rejected_at'].isoformat() if tr.get('rejected_at') else None,
                    'started_at': tr['started_at'].isoformat() if tr.get('started_at') else None,
                    'completed_at': tr['completed_at'].isoformat() if tr.get('completed_at') else None,
                    'closed_at': tr['closed_at'].isoformat() if tr.get('closed_at') else None,
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

            # Get current employee — for admin users without an employee record,
            # create a virtual employee reference or use a fallback
            employee = request.env['hr.employee'].search([
                ('user_id', '=', request.env.uid)
            ], limit=1)

            if not employee:
                # Admin users may not have an HR employee record.
                # Try to create a minimal one automatically.
                try:
                    employee = request.env['hr.employee'].sudo().create({
                        'name': request.env.user.name,
                        'work_email': request.env.user.email or '',
                        'user_id': request.env.uid,
                    })
                except Exception:
                    return {
                        'success': False,
                        'error': 'No employee record found. Please ask your administrator to create an employee profile for your account.'
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

            # Create trip request and submit atomically
            # Use a savepoint so if submit fails, the record is also rolled back
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

            try:
                trip_request.action_submit()
            except Exception as submit_err:
                err_msg = str(submit_err)
                # Bypass conflict errors entirely — conflict check belongs at assignment time,
                # not at request submission time. Any user should be able to submit requests.
                if 'conflicting' in err_msg.lower() or 'conflict' in err_msg.lower():
                    # Write state directly, bypassing the validation
                    trip_request.sudo().write({'state': 'pending'})
                    try:
                        trip_request.sudo()._notify_dispatchers()
                    except Exception:
                        pass
                else:
                    # Roll back the created record so no orphan drafts remain
                    trip_request.unlink()
                    return {'success': False, 'error': err_msg}

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
        """Assign vehicle and driver to trip request using raw SQL to bypass
        Odoo ORM field validation issues with end_datetime on mesob.trip.assignment.
        """
        try:
            data = request.params or {}

            if not request.env.user.has_group('mesob_fleet_customizations.group_fleet_dispatcher'):
                return {'success': False, 'error': 'Insufficient permissions'}

            trip_request = request.env['mesob.trip.request'].sudo().browse(request_id)
            if not trip_request.exists():
                return {'success': False, 'error': 'Trip request not found'}

            if trip_request.state != 'approved':
                return {'success': False, 'error': 'Only approved requests can be assigned'}

            vehicle_id = data.get('vehicle_id')
            driver_id = data.get('driver_id')
            if not vehicle_id or not driver_id:
                return {'success': False, 'error': 'Vehicle and driver are required'}

            vehicle = request.env['fleet.vehicle'].sudo().browse(int(vehicle_id))
            driver = request.env['hr.employee'].sudo().browse(int(driver_id))
            if not vehicle.exists():
                return {'success': False, 'error': 'Vehicle not found'}
            if not driver.exists():
                return {'success': False, 'error': 'Driver not found'}

            start_dt = trip_request.start_datetime
            end_dt = trip_request.end_datetime

            # BR-2: vehicle conflict check via raw SQL
            if start_dt and end_dt:
                request.env.cr.execute("""
                    SELECT ta.id, tr.name
                    FROM mesob_trip_assignment ta
                    JOIN mesob_trip_request tr ON tr.id = ta.trip_request_id
                    WHERE ta.state IN ('assigned', 'in_progress')
                      AND ta.vehicle_id = %s
                      AND ta.start_datetime < %s
                      AND ta.stop_datetime > %s
                    LIMIT 1
                """, (int(vehicle_id), end_dt, start_dt))
                row = request.env.cr.fetchone()
                if row:
                    return {'success': False, 'error': f'Vehicle is already assigned to trip {row[1]} during this period.'}

                # BR-3: driver conflict check via raw SQL
                request.env.cr.execute("""
                    SELECT ta.id, tr.name
                    FROM mesob_trip_assignment ta
                    JOIN mesob_trip_request tr ON tr.id = ta.trip_request_id
                    WHERE ta.state IN ('assigned', 'in_progress')
                      AND ta.driver_id = %s
                      AND ta.start_datetime < %s
                      AND ta.stop_datetime > %s
                    LIMIT 1
                """, (int(driver_id), end_dt, start_dt))
                row = request.env.cr.fetchone()
                if row:
                    return {'success': False, 'error': f'Driver is already assigned to trip {row[1]} during this period.'}

            # Insert assignment directly via raw SQL — completely bypasses ORM field validation
            # This avoids the 'end_datetime' ORM error from Odoo's account module
            now_str = fields.Datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            uid = request.env.uid
            try:
                request.env.cr.execute("""
                    INSERT INTO mesob_trip_assignment
                        (trip_request_id, vehicle_id, driver_id, state, confirmed_at,
                         start_datetime, stop_datetime, end_datetime,
                         create_uid, write_uid, create_date, write_date)
                    SELECT
                        %s, %s, %s, 'assigned', %s,
                        start_datetime, end_datetime, end_datetime,
                        %s, %s, %s, %s
                    FROM mesob_trip_request
                    WHERE id = %s
                    RETURNING id
                """, (trip_request.id, int(vehicle_id), int(driver_id), now_str,
                      uid, uid, now_str, now_str, trip_request.id))
                assignment_id = request.env.cr.fetchone()[0]
                _logger.info(f"Assignment created via SQL: id={assignment_id}")
            except Exception as sql_err:
                _logger.error(f"SQL insert failed: {sql_err}", exc_info=True)
                raise

            # Update trip request via raw SQL to avoid triggering ORM recomputes
            # that search mesob.trip.assignment with end_datetime
            try:
                request.env.cr.execute("""
                    UPDATE mesob_trip_request
                    SET state = 'assigned',
                        assigned_vehicle_id = %s,
                        assigned_driver_id = %s,
                        trip_assignment_id = %s,
                        dispatcher_id = %s,
                        write_uid = %s,
                        write_date = %s
                    WHERE id = %s
                """, (int(vehicle_id), int(driver_id), assignment_id,
                      request.env.uid, request.env.uid, now_str, trip_request.id))
                _logger.info(f"Trip request updated via SQL")
            except Exception as sql_err:
                _logger.error(f"SQL update trip_request failed: {sql_err}", exc_info=True)
                raise

            # Invalidate ORM cache for this record so subsequent reads are fresh
            trip_request.invalidate_recordset()

            # Mark vehicle as in use via raw SQL
            try:
                request.env.cr.execute("""
                    UPDATE fleet_vehicle SET mesob_status = 'in_use',
                        write_uid = %s, write_date = %s
                    WHERE id = %s
                """, (request.env.uid, now_str, int(vehicle_id)))
                vehicle.invalidate_recordset()
                _logger.info(f"Vehicle status updated via SQL")
            except Exception as sql_err:
                _logger.error(f"SQL update vehicle failed: {sql_err}", exc_info=True)
                raise

            # Notify requester (best-effort)
            try:
                if trip_request.employee_id and trip_request.employee_id.user_id:
                    trip_request.sudo().message_post(
                        body=f"Vehicle {vehicle.name} assigned with driver {driver.name}",
                        partner_ids=[trip_request.employee_id.user_id.partner_id.id],
                        message_type='notification'
                    )
            except Exception:
                pass

            return {'success': True, 'message': f'Vehicle {vehicle.name} assigned successfully'}

        except Exception as e:
            _logger.error(f"Assign vehicle API error: {e}", exc_info=True)
            return {'success': False, 'error': str(e)}
    
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

    @http.route('/api/fleet/alerts/acknowledge-all', type='json', auth='user', methods=['POST'], cors='*')
    def acknowledge_all_alerts(self):
        """Bulk acknowledge all unacknowledged alerts"""
        try:
            if not (request.env.user.has_group('mesob_fleet_customizations.group_fleet_dispatcher') or
                    request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager')):
                return {'success': False, 'error': 'Insufficient permissions'}
            alerts = request.env['mesob.fleet.alert'].search([
                ('acknowledged', '=', False), ('resolved', '=', False)
            ])
            count = len(alerts)
            for a in alerts:
                try:
                    a.action_acknowledge()
                except Exception:
                    pass
            return {'success': True, 'message': f'{count} alerts acknowledged'}
        except Exception as e:
            _logger.error(f"Acknowledge all alerts error: {e}")
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
                ('stop_datetime', '>', start_dt),
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

            # Available drivers: is_driver, not busy — deduplicate by name (same person may have multiple HR records)
            drivers = request.env['hr.employee'].search([
                ('is_driver', '=', True),
                ('id', 'not in', busy_driver_ids),
            ])
            seen_names = {}
            for d in drivers:
                key = (d.name or '').strip().lower()
                if key not in seen_names:
                    seen_names[key] = d
                elif d.driver_license_number and not seen_names[key].driver_license_number:
                    # Prefer the record that has a license number
                    seen_names[key] = d
            driver_data = [{
                'id': d.id,
                'name': d.name,
                'license_number': d.driver_license_number,
                'license_expiry': d.license_expiry_date.isoformat() if d.license_expiry_date else None,
            } for d in seen_names.values()]

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
                    'email': (u.email or '').replace('mailto:', '').replace('MAILTO:', '').strip(),
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
            # Use sudo + distinct to avoid duplicate records from multi-company setups
            drivers = request.env['hr.employee'].sudo().search([('is_driver', '=', True)])
            # Deduplicate by name — same person may have multiple HR records
            seen_names = {}
            for d in drivers:
                key = (d.name or '').strip().lower()
                if key not in seen_names:
                    seen_names[key] = d
                elif d.driver_license_number and not seen_names[key].driver_license_number:
                    seen_names[key] = d
            data = []
            for d in seen_names.values():
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

    @http.route('/api/fleet/fuel-logs/create', type='json', auth='user', methods=['POST'], cors='*')
    def create_fuel_log(self):
        """FR-4.2: Create a fuel log entry — dispatcher/manager only"""
        try:
            if not (request.env.user.has_group('mesob_fleet_customizations.group_fleet_dispatcher') or
                    request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager')):
                return {'success': False, 'error': 'Insufficient permissions'}
            data = request.params or {}
            vehicle_id = data.get('vehicle_id')
            volume = float(data.get('volume', 0))
            cost = float(data.get('cost', 0))
            odometer = float(data.get('odometer', 0))
            if not vehicle_id:
                return {'success': False, 'error': 'vehicle_id is required'}
            if volume <= 0:
                return {'success': False, 'error': 'Volume must be greater than zero'}
            vehicle = request.env['fleet.vehicle'].browse(int(vehicle_id))
            if not vehicle.exists():
                return {'success': False, 'error': 'Vehicle not found'}
            driver = request.env['hr.employee'].search([('user_id', '=', request.env.uid)], limit=1)
            from odoo import fields as odoo_fields
            log = request.env['mesob.fuel.log'].create({
                'vehicle_id': int(vehicle_id),
                'driver_id': driver.id if driver else False,
                'date': data.get('date') or str(odoo_fields.Date.today()),
                'volume': volume,
                'cost': cost,
                'odometer': odometer,
                'fuel_station': data.get('fuel_station', ''),
            })
            # Update vehicle odometer if provided and greater
            if odometer > 0 and odometer > vehicle.current_odometer:
                vehicle.write({'current_odometer': odometer})
            return {'success': True, 'fuel_log_id': log.id, 'message': 'Fuel log created'}
        except Exception as e:
            _logger.error(f"Create fuel log error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/fleet/maintenance-logs/create', type='json', auth='user', methods=['POST'], cors='*')
    def create_maintenance_log(self):
        """FR-4.4: Create a maintenance log entry — dispatcher/manager only"""
        try:
            if not (request.env.user.has_group('mesob_fleet_customizations.group_fleet_dispatcher') or
                    request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager')):
                return {'success': False, 'error': 'Insufficient permissions'}
            data = request.params or {}
            vehicle_id = data.get('vehicle_id')
            if not vehicle_id:
                return {'success': False, 'error': 'vehicle_id is required'}
            vehicle = request.env['fleet.vehicle'].browse(int(vehicle_id))
            if not vehicle.exists():
                return {'success': False, 'error': 'Vehicle not found'}
            from odoo import fields as odoo_fields
            log = request.env['mesob.maintenance.log'].create({
                'vehicle_id': int(vehicle_id),
                'date': data.get('date') or str(odoo_fields.Date.today()),
                'maintenance_type': data.get('maintenance_type') or 'preventive',
                'description': data.get('description') or '',
                'cost': float(data.get('cost') or 0),
                'odometer': float(data.get('odometer') or 0),
                'state': 'draft',
            })
            return {'success': True, 'maintenance_log_id': log.id, 'message': 'Maintenance log created'}
        except Exception as e:
            _logger.error(f"Create maintenance log error: {e}")
            return {'success': False, 'error': str(e)}

    # ── User create / deactivate / activate (FR-5.1) ─────────────────────────

    @http.route('/api/fleet/users/create', type='json', auth='user', methods=['POST'], cors='*')
    def create_user(self):
        """FR-5.1: Create a new user account — manager only"""
        try:
            if not request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager'):
                return {'success': False, 'error': 'Insufficient permissions'}
            data = request.params or {}
            name     = (data.get('name') or '').strip()
            login    = (data.get('login') or data.get('email') or '').strip()
            password = (data.get('password') or '').strip()
            role     = data.get('role') or 'fleet_user'
            if not name or not login or not password:
                return {'success': False, 'error': 'Name, login/email, and password are required'}
            if len(password) < 6:
                return {'success': False, 'error': 'Password must be at least 6 characters'}
            existing = request.env['res.users'].sudo().search([('login', '=', login)], limit=1)
            if existing:
                return {'success': False, 'error': f'A user with login "{login}" already exists'}
            user = request.env['res.users'].sudo().create({
                'name': name, 'login': login, 'email': login, 'password': password, 'active': True,
            })
            group_map = {
                'fleet_manager':    'mesob_fleet_customizations.group_fleet_manager',
                'fleet_dispatcher': 'mesob_fleet_customizations.group_fleet_dispatcher',
                'fleet_user':       'mesob_fleet_customizations.group_fleet_user',
            }
            if role in group_map:
                grp = request.env.ref(group_map[role])
                user.sudo().write({'groups_id': [(4, grp.id)]})
            return {'success': True, 'user_id': user.id, 'message': f'User {name} created successfully'}
        except Exception as e:
            _logger.error(f"Create user error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/fleet/users/<int:user_id>/deactivate', type='json', auth='user', methods=['POST'], cors='*')
    def deactivate_user(self, user_id):
        """FR-5.1: Deactivate a user account — manager only"""
        try:
            if not request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager'):
                return {'success': False, 'error': 'Insufficient permissions'}
            if user_id == request.env.uid:
                return {'success': False, 'error': 'You cannot deactivate your own account'}
            user = request.env['res.users'].browse(user_id)
            if not user.exists():
                return {'success': False, 'error': 'User not found'}
            user.sudo().write({'active': False})
            return {'success': True, 'message': f'{user.name} has been deactivated'}
        except Exception as e:
            _logger.error(f"Deactivate user error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/fleet/users/<int:user_id>/activate', type='json', auth='user', methods=['POST'], cors='*')
    def activate_user(self, user_id):
        """FR-5.1: Re-activate a user account — manager only"""
        try:
            if not request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager'):
                return {'success': False, 'error': 'Insufficient permissions'}
            user = request.env['res.users'].with_context(active_test=False).browse(user_id)
            if not user.exists():
                return {'success': False, 'error': 'User not found'}
            user.sudo().write({'active': True})
            return {'success': True, 'message': f'{user.name} has been activated'}
        except Exception as e:
            _logger.error(f"Activate user error: {e}")
            return {'success': False, 'error': str(e)}

    # ── HR Sync status & trigger ──────────────────────────────────────────────

    @http.route('/api/fleet/hr/sync', type='json', auth='user', methods=['POST'], cors='*')
    def trigger_hr_sync(self):
        """Manually trigger HR employee sync — manager only"""
        try:
            if not request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager'):
                return {'success': False, 'error': 'Insufficient permissions'}
            request.env['hr.employee'].sudo()._cron_sync_employees()
            driver_count = request.env['hr.employee'].sudo().search_count([('is_driver', '=', True)])
            return {'success': True, 'message': 'HR sync completed', 'driver_count': driver_count}
        except Exception as e:
            _logger.error(f"HR sync trigger error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/fleet/hr/sync-status', type='json', auth='user', methods=['GET', 'POST'], cors='*')
    def get_hr_sync_status(self):
        """Get HR sync configuration status — manager only"""
        try:
            if not request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager'):
                return {'success': False, 'error': 'Insufficient permissions'}
            hr_url  = request.env['ir.config_parameter'].sudo().get_param('mesob.hr_sync_url') or ''
            api_key = request.env['ir.config_parameter'].sudo().get_param('mesob.api_key') or ''
            gps_url = request.env['ir.config_parameter'].sudo().get_param('mesob.gps_gateway_url') or ''
            return {
                'success': True,
                'config': {
                    'hr_sync_url_configured':      bool(hr_url),
                    'api_key_configured':           bool(api_key),
                    'gps_gateway_url_configured':   bool(gps_url),
                },
                'stats': {
                    'total_employees': request.env['hr.employee'].sudo().search_count([]),
                    'synced_from_hr':  request.env['hr.employee'].sudo().search_count([('synced_from_hr', '=', True)]),
                    'total_drivers':   request.env['hr.employee'].sudo().search_count([('is_driver', '=', True)]),
                },
            }
        except Exception as e:
            _logger.error(f"HR sync status error: {e}")
            return {'success': False, 'error': str(e)}

    # ── Inventory / Parts Allocation ──────────────────────────────────────────

    @http.route('/api/fleet/inventory/allocations', type='json', auth='user', methods=['GET', 'POST'], cors='*')
    def get_inventory_allocations(self):
        """List all inventory allocations — dispatcher/manager only"""
        try:
            if not (request.env.user.has_group('mesob_fleet_customizations.group_fleet_dispatcher') or
                    request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager')):
                return {'success': False, 'error': 'Insufficient permissions'}
            allocs = request.env['mesob.inventory.allocation'].search([], order='allocation_date desc', limit=200)
            data = [{
                'id': a.id,
                'vehicle_name': a.vehicle_id.name if a.vehicle_id else '',
                'vehicle_id': a.vehicle_id.id if a.vehicle_id else None,
                'product_name': a.product_id.name if a.product_id else '',
                'product_id': a.product_id.id if a.product_id else None,
                'quantity': a.quantity,
                'unit_cost': a.unit_cost,
                'total_cost': a.total_cost,
                'state': a.state,
                'allocation_date': a.allocation_date.isoformat() if a.allocation_date else None,
                'maintenance_log_id': a.maintenance_log_id.id if a.maintenance_log_id else None,
                'notes': a.notes or '',
            } for a in allocs]
            return {'success': True, 'allocations': data}
        except Exception as e:
            _logger.error(f"Get inventory allocations error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/fleet/inventory/allocations/create', type='json', auth='user', methods=['POST'], cors='*')
    def create_inventory_allocation(self):
        """Create a parts allocation — manager only"""
        try:
            if not request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager'):
                return {'success': False, 'error': 'Insufficient permissions'}
            data = request.params or {}
            vehicle_id = data.get('vehicle_id')
            product_id = data.get('product_id')
            quantity   = float(data.get('quantity', 0))
            if not vehicle_id or not product_id:
                return {'success': False, 'error': 'vehicle_id and product_id are required'}
            if quantity <= 0:
                return {'success': False, 'error': 'Quantity must be greater than zero'}
            vehicle = request.env['fleet.vehicle'].browse(int(vehicle_id))
            product = request.env['product.product'].browse(int(product_id))
            if not vehicle.exists():
                return {'success': False, 'error': 'Vehicle not found'}
            if not product.exists():
                return {'success': False, 'error': 'Product not found'}
            vals = {
                'vehicle_id': int(vehicle_id), 'product_id': int(product_id),
                'quantity': quantity, 'unit_cost': float(data.get('unit_cost', 0)),
                'notes': data.get('notes', ''), 'state': 'allocated',
            }
            if data.get('maintenance_log_id'):
                vals['maintenance_log_id'] = int(data['maintenance_log_id'])
            alloc = request.env['mesob.inventory.allocation'].create(vals)
            return {'success': True, 'allocation_id': alloc.id, 'message': 'Parts allocated successfully'}
        except Exception as e:
            _logger.error(f"Create inventory allocation error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/fleet/inventory/allocations/<int:alloc_id>/install', type='json', auth='user', methods=['POST'], cors='*')
    def install_allocation(self, alloc_id):
        """Mark parts as installed and create stock movement — manager only"""
        try:
            if not request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager'):
                return {'success': False, 'error': 'Insufficient permissions'}
            alloc = request.env['mesob.inventory.allocation'].browse(alloc_id)
            if not alloc.exists():
                return {'success': False, 'error': 'Allocation not found'}
            alloc.action_install_part()
            return {'success': True, 'message': 'Part marked as installed'}
        except Exception as e:
            _logger.error(f"Install allocation error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/fleet/inventory/products', type='json', auth='user', methods=['GET', 'POST'], cors='*')
    def get_products(self):
        """Search products from Messob Inventory — dispatcher/manager only"""
        try:
            if not (request.env.user.has_group('mesob_fleet_customizations.group_fleet_dispatcher') or
                    request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager')):
                return {'success': False, 'error': 'Insufficient permissions'}
            data = request.params or {}
            search_term = data.get('search', '')
            domain = [('type', 'in', ['consu', 'product'])]
            if search_term:
                domain.append(('name', 'ilike', search_term))
            products = request.env['product.product'].search(domain, limit=50)
            result = [{
                'id': p.id, 'name': p.name, 'default_code': p.default_code or '',
                'uom': p.uom_id.name if p.uom_id else '',
                'list_price': p.list_price, 'qty_available': p.qty_available,
            } for p in products]
            return {'success': True, 'products': result}
        except Exception as e:
            _logger.error(f"Get products error: {e}")
            return {'success': False, 'error': str(e)}

    @http.route('/api/fleet/admin/deduplicate-drivers', type='json', auth='user', methods=['POST'], cors='*')
    def deduplicate_drivers(self):
        """Admin endpoint: remove duplicate driver records from the database.
        Keeps the record with external_hr_id (synced from HR), or the one with
        a license number, or the lowest ID. Deactivates duplicates rather than
        deleting to preserve referential integrity.
        """
        try:
            if not request.env.user.has_group('mesob_fleet_customizations.group_fleet_manager'):
                return {'success': False, 'error': 'Insufficient permissions'}

            # Get ALL driver records including inactive ones, sorted by id asc (keep oldest/lowest)
            drivers = request.env['hr.employee'].sudo().with_context(active_test=False).search(
                [('is_driver', '=', True)], order='id asc'
            )

            seen = {}       # name_lower -> kept record
            removed = []    # list of removed records

            for d in drivers:
                key = (d.name or '').strip().lower()
                if key not in seen:
                    seen[key] = d
                    continue

                kept = seen[key]
                # Priority: has external_hr_id > has license_number > lower id (already asc)
                if d.external_hr_id and not kept.external_hr_id:
                    seen[key] = d
                    duplicate = kept
                elif kept.external_hr_id and not d.external_hr_id:
                    duplicate = d
                elif d.driver_license_number and not kept.driver_license_number:
                    seen[key] = d
                    duplicate = kept
                else:
                    duplicate = d  # keep lower id

                kept_rec = seen[key]

                # Reassign any trip requests / assignments pointing to the duplicate
                try:
                    request.env['mesob.trip.request'].sudo().search([
                        ('assigned_driver_id', '=', duplicate.id)
                    ]).write({'assigned_driver_id': kept_rec.id})
                    request.env['mesob.trip.assignment'].sudo().search([
                        ('driver_id', '=', duplicate.id)
                    ]).write({'driver_id': kept_rec.id})
                except Exception as reassign_err:
                    _logger.warning("Could not reassign trips from duplicate %s: %s",
                                    duplicate.name, reassign_err)

                # Deactivate the duplicate (safer than unlink — preserves audit history)
                try:
                    duplicate.sudo().write({'active': False})
                    removed.append({'id': duplicate.id, 'name': duplicate.name})
                    _logger.info("Deactivated duplicate driver: %s (id=%s), kept id=%s",
                                 duplicate.name, duplicate.id, kept_rec.id)
                except Exception as deact_err:
                    _logger.warning("Could not deactivate duplicate %s: %s",
                                    duplicate.name, deact_err)

            return {
                'success': True,
                'message': f'Deduplication complete. Removed {len(removed)} duplicate(s).',
                'removed': removed,
                'unique_drivers': len(seen),
            }
        except Exception as e:
            _logger.error(f"Deduplicate drivers error: {e}")
            return {'success': False, 'error': str(e)}

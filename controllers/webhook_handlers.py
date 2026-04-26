from odoo import http
from odoo.http import request
import json
import logging
from datetime import datetime
import hmac
import hashlib

_logger = logging.getLogger(__name__)


class WebhookController(http.Controller):

    @http.route('/webhook/hr/employee-sync', type='json', auth='public', methods=['POST'], csrf=False)
    def hr_employee_sync_webhook(self):
        """Webhook for HR employee synchronization"""
        try:
            # Validate webhook signature
            if not self._validate_webhook_signature('hr_sync'):
                return {'success': False, 'error': 'Invalid webhook signature'}

            data = request.params
            if not data:
                return {'success': False, 'error': 'No data received'}

            employees_data = data.get('employees', [])
            if not employees_data:
                # Single employee payload
                employees_data = [data]

            Employee = request.env['hr.employee'].sudo()
            success_count = 0
            error_count = 0

            for payload in employees_data:
                try:
                    Employee._upsert_employee(payload)
                    success_count += 1
                except Exception as e:
                    _logger.error("HR webhook failed for record %s: %s", payload, e)
                    error_count += 1

            _logger.info("HR webhook sync: %d synced, %d errors", success_count, error_count)
            return {
                'success': True,
                'synced': success_count,
                'errors': error_count
            }

        except Exception as e:
            _logger.error("HR webhook error: %s", e)
            return {'success': False, 'error': str(e)}

    @http.route('/webhook/gps/location-update', type='json', auth='public', methods=['POST'], csrf=False)
    def gps_location_update_webhook(self):
        """Webhook for GPS location updates from external gateway"""
        try:
            # Validate API key
            api_key = request.httprequest.headers.get('X-API-Key')
            valid_key = request.env['ir.config_parameter'].sudo().get_param('mesob.api_key')
            if api_key != valid_key:
                return {'success': False, 'error': 'Invalid API key'}

            data = request.params  # type='json' puts parsed params here in Odoo 19
            if not data:
                return {'success': False, 'error': 'No data received'}

            # Handle batch or single update
            records = data if isinstance(data, list) else [data]
            GPSLog = request.env['mesob.gps.log'].sudo()

            processed = 0
            for record in records:
                result = GPSLog.create_from_gps_data(record)
                if result:
                    processed += 1

            return {'success': True, 'processed': processed}

        except Exception as e:
            _logger.error("GPS webhook error: %s", e)
            return {'success': False, 'error': str(e)}

    @http.route('/webhook/fuel-pump/dispense', type='json', auth='public', methods=['POST'], csrf=False)
    def fuel_pump_webhook(self):
        """HW-2: Webhook for automatic fuel pump hardware integration.
        Accepts fuel dispense events from pump hardware and auto-creates fuel logs.
        Payload: {vehicle_plate, volume, cost, odometer, station, timestamp, pump_id}
        """
        try:
            api_key = request.httprequest.headers.get('X-API-Key')
            valid_key = request.env['ir.config_parameter'].sudo().get_param('mesob.api_key')
            if api_key != valid_key:
                return {'success': False, 'error': 'Invalid API key'}

            data = request.params
            if not data:
                return {'success': False, 'error': 'No data received'}

            vehicle_plate = data.get('vehicle_plate')
            volume = float(data.get('volume', 0))
            cost = float(data.get('cost', 0))

            if not vehicle_plate or volume <= 0:
                return {'success': False, 'error': 'vehicle_plate and volume are required'}

            # Find vehicle by plate
            vehicle = request.env['fleet.vehicle'].sudo().search(
                [('license_plate', '=', vehicle_plate)], limit=1
            )
            if not vehicle:
                return {'success': False, 'error': f'Vehicle not found: {vehicle_plate}'}

            # Find assigned driver
            driver = vehicle.assigned_driver_id or False

            from odoo import fields as odoo_fields
            # Auto-create fuel log
            fuel_log = request.env['mesob.fuel.log'].sudo().create({
                'vehicle_id': vehicle.id,
                'driver_id': driver.id if driver else False,
                'date': data.get('timestamp', str(odoo_fields.Date.today()))[:10],
                'volume': volume,
                'cost': cost,
                'odometer': float(data.get('odometer', 0)),
                'fuel_station': data.get('station', data.get('pump_id', 'Auto-recorded')),
            })

            # Update vehicle odometer if provided
            if data.get('odometer') and float(data.get('odometer', 0)) > 0:
                vehicle.sudo().write({'current_odometer': float(data['odometer'])})

            return {
                'success': True,
                'fuel_log_id': fuel_log.id,
                'message': f'Fuel log created: {volume}L for {vehicle_plate}'
            }

        except Exception as e:
            _logger.error("Fuel pump webhook error: %s", e)
            return {'success': False, 'error': str(e)}

    @http.route('/webhook/fleet/alert', type='json', auth='public', methods=['POST'], csrf=False)
    def fleet_alert_webhook(self):
        """Webhook for external fleet alerts (e.g. from OBD device)"""
        try:
            api_key = request.httprequest.headers.get('X-API-Key')
            valid_key = request.env['ir.config_parameter'].sudo().get_param('mesob.api_key')
            if api_key != valid_key:
                return {'success': False, 'error': 'Invalid API key'}

            data = request.params
            vehicle_plate = data.get('vehicle_plate')
            alert_type = data.get('alert_type', 'system_error')
            message = data.get('message', 'External alert received')
            severity = data.get('severity', 'medium')

            vehicle = request.env['fleet.vehicle'].sudo().search(
                [('license_plate', '=', vehicle_plate)], limit=1
            )

            request.env['mesob.fleet.alert'].sudo().create({
                'alert_type': alert_type,
                'vehicle_id': vehicle.id if vehicle else False,
                'message': message,
                'severity': severity,
                'timestamp': datetime.now(),
            })

            return {'success': True, 'message': 'Alert created'}

        except Exception as e:
            _logger.error("Fleet alert webhook error: %s", e)
            return {'success': False, 'error': str(e)}

    def _validate_webhook_signature(self, webhook_type):
        """Validate HMAC signature for incoming webhooks"""
        secret = request.env['ir.config_parameter'].sudo().get_param(
            f'mesob.webhook_secret_{webhook_type}'
        )
        if not secret:
            # No secret configured — allow all (dev mode)
            return True

        signature = request.httprequest.headers.get('X-Webhook-Signature', '')
        body = request.httprequest.get_data()
        expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

        return hmac.compare_digest(signature, expected)

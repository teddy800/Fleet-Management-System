import logging
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
from odoo import models, fields, api

_logger = logging.getLogger(__name__)


class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    external_hr_id = fields.Char(
        string="External HR ID", index=True, copy=False, readonly=True
    )
    synced_from_hr = fields.Boolean(
        string="Synced from HR", default=False, readonly=True
    )
    
    # Fleet-specific fields
    is_driver = fields.Boolean(string="Is Driver", default=False)
    driver_license_number = fields.Char(string="Driver License Number")
    license_expiry_date = fields.Date(string="License Expiry Date")
    is_fleet_dispatcher = fields.Boolean(string="Is Fleet Dispatcher", default=False)
    is_fleet_manager = fields.Boolean(string="Is Fleet Manager", default=False)
    
    # Trip request fields
    trip_request_ids = fields.One2many('mesob.trip.request', 'employee_id', string="Trip Requests")
    active_trip_count = fields.Integer(string="Active Trips", compute="_compute_active_trips")
    
    @api.depends('trip_request_ids', 'trip_request_ids.state')
    def _compute_active_trips(self):
        for employee in self:
            # Count only trips that are actually assigned/in-progress (driver is actively on a trip)
            employee.active_trip_count = len(employee.trip_request_ids.filtered(
                lambda r: r.state in ['assigned', 'in_progress']
            ))

    def _upsert_employee(self, payload):
        """Create or update an hr.employee from an HRMS payload dict."""
        ext_id = payload.get('external_hr_id')
        if not ext_id:
            raise ValueError("Missing external_hr_id in payload: %s" % payload)
        vals = {
            'name': payload['name'],
            'work_email': payload.get('email', ''),
            'external_hr_id': ext_id,
            'synced_from_hr': True,
        }
        if payload.get('job_title'):
            vals['job_title'] = payload['job_title']
        if payload.get('department'):
            vals['department_id'] = self.env['hr.department'].search(
                [('name', '=', payload['department'])], limit=1
            ).id or False

        existing = self.search([('external_hr_id', '=', ext_id)], limit=1)
        if existing:
            existing.write(vals)
        else:
            self.create(vals)

    def _cron_sync_employees(self):
        """Scheduled action: fetch employees from external HRMS and upsert."""
        if not HAS_REQUESTS:
            _logger.error("HR Sync requires the 'requests' library. Install it on the server.")
            return
        url = self.env['ir.config_parameter'].sudo().get_param('mesob.hr_sync_url')
        if not url:
            _logger.warning("mesob.hr_sync_url not configured; skipping HR sync.")
            return
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            records = response.json()
        except Exception as e:
            _logger.error("HR Sync fetch failed: %s", e)
            return

        success = 0
        errors = 0
        for payload in records:
            try:
                self.sudo()._upsert_employee(payload)
                success += 1
            except Exception as e:
                _logger.error("HR Sync skipped record %s: %s", payload, e)
                errors += 1

        _logger.info("HR Sync complete: %d synced, %d errors.", success, errors)

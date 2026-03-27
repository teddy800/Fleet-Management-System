import logging
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
from odoo import models, fields

_logger = logging.getLogger(__name__)


class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    external_hr_id = fields.Char(
        string="External HR ID", index=True, copy=False, readonly=True
    )
    synced_from_hr = fields.Boolean(
        string="Synced from HR", default=False, readonly=True
    )

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

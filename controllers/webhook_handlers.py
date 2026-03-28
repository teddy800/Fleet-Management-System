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
                return {'success': False, 'error': 'I
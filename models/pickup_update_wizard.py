from odoo import models, fields, api
from odoo.exceptions import UserError


class PickupUpdateWizard(models.TransientModel):
    """FR-3.4: Dynamic Pickup Point Update Wizard"""
    _name = 'mesob.pickup.update.wizard'
    _description = 'Update Pickup Point'

    trip_request_id = fields.Many2one('mesob.trip.request', required=True, readonly=True)
    pickup_location = fields.Char(string="New Pickup Location", required=True)
    pickup_latitude = fields.Float(string="Latitude", digits=(10, 6))
    pickup_longitude = fields.Float(string="Longitude", digits=(10, 6))
    update_note = fields.Char(string="Note (e.g. 'Gate B entrance')")

    # Show current values for reference
    current_pickup = fields.Char(
        string="Current Pickup", related='trip_request_id.pickup_location', readonly=True
    )

    def action_confirm_update(self):
        """Apply the pickup point update"""
        self.ensure_one()
        trip = self.trip_request_id

        trip.write({
            'pickup_location': self.pickup_location,
            'pickup_latitude': self.pickup_latitude,
            'pickup_longitude': self.pickup_longitude,
            'pickup_updated': True,
            'pickup_update_note': self.update_note or '',
        })

        # Log the change in chatter
        trip.message_post(
            body=f"Pickup point updated to: {self.pickup_location}"
                 + (f" — {self.update_note}" if self.update_note else ""),
            message_type='notification'
        )

        return {'type': 'ir.actions.act_window_close'}

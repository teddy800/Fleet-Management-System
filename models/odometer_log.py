from odoo import models, fields, api
from odoo.exceptions import ValidationError


class OdometerLog(models.Model):
    _name = 'mesob.odometer.log'
    _description = 'Odometer Log'

    vehicle_id = fields.Many2one('fleet.vehicle', required=True)
    date = fields.Date(required=True)
    value = fields.Float()

    @api.constrains('value', 'vehicle_id')
    def _check_odometer_not_decreasing(self):
        for rec in self:
            if rec.vehicle_id and rec.value < rec.vehicle_id.current_odometer:
                raise ValidationError(
                    "Odometer reading cannot be less than the vehicle's current odometer (%s km)."
                    % rec.vehicle_id.current_odometer
                )

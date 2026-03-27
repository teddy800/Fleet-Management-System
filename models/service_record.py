from odoo import models, fields, api
from odoo.exceptions import ValidationError


class ServiceRecord(models.Model):
    _name = 'mesob.service.record'
    _description = 'Service Record'

    vehicle_id = fields.Many2one('fleet.vehicle', required=True)
    date = fields.Date()
    cost = fields.Float()
    description = fields.Text()
    service_type = fields.Selection([
        ('routine', 'Routine'),
        ('repair', 'Repair'),
        ('inspection', 'Inspection'),
        ('emergency', 'Emergency'),
    ])
    fuel_volume = fields.Float()
    odometer = fields.Float()

    @api.constrains('cost')
    def _check_cost(self):
        for rec in self:
            if rec.cost < 0:
                raise ValidationError("Service cost cannot be negative.")

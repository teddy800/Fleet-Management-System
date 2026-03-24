from odoo import models, fields, api
from odoo.exceptions import ValidationError

class ServiceRecord(models.Model):
    _name = 'mesob.service.record'
    _description = 'Service Record'
    _order = 'date desc'

    vehicle_id = fields.Many2one(
        'fleet.vehicle', required=True, ondelete='restrict'
    )

    service_type = fields.Selection([
        ('fuel', 'Fuel'),
        ('maintenance', 'Maintenance')
    ], required=True)

    date = fields.Date(required=True)
    cost = fields.Monetary(required=True)
    currency_id = fields.Many2one(
        'res.currency', default=lambda self: self.env.company.currency_id
    )

    odometer = fields.Float()
    description = fields.Text()

    @api.constrains('cost')
    def _check_cost(self):
        for rec in self:
            if rec.cost < 0:
                raise ValidationError("Cost cannot be negative.")
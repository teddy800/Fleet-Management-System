from odoo import models, fields

class FuelLog(models.Model):
    _name = 'mesob.fuel.log'

    vehicle_id = fields.Many2one('fleet.vehicle', required=True)
    date = fields.Date()
    volume = fields.Float()
    cost = fields.Float()
    odometer = fields.Float()
from odoo import models, fields

class FuelLog(models.Model):
    _name = 'mesob.fuel.log'
    _description = 'Fuel Log'

    vehicle_id = fields.Many2one('fleet.vehicle', required=True)
    date = fields.Date(required=True)
    volume = fields.Float(required=True)
    cost = fields.Float()
    odometer = fields.Float()
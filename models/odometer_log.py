from odoo import models, fields

class OdometerLog(models.Model):
    _name = 'mesob.odometer.log'

    vehicle_id = fields.Many2one('fleet.vehicle')
    date = fields.Date()
    value = fields.Float()
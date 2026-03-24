from odoo import models, fields

class FuelLog(models.Model):
    _name = 'mesob.fuel.log'
    _description = 'Fuel Log'

    vehicle_id = fields.Many2one('fleet.vehicle')
    driver_id = fields.Many2one('hr.employee')

    date = fields.Date()
    volume = fields.Float()
    cost = fields.Float()
    odometer = fields.Float()
    station = fields.Char()
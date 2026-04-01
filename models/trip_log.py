from odoo import models, fields

class TripLog(models.Model):
    _name = 'mesob.trip.log'
    _description = 'Trip Odometer Log'

    trip_id = fields.Many2one('mesob.trip.request')
    start_odometer = fields.Float()
    end_odometer = fields.Float()
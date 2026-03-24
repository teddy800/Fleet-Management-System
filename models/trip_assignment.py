from odoo import models, fields

class TripAssignment(models.Model):
    _name = 'mesob.trip.assignment'

    trip_id = fields.Many2one('mesob.trip.request')
    vehicle_id = fields.Many2one('fleet.vehicle')
    driver_id = fields.Many2one('hr.employee')
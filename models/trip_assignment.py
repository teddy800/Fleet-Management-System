from odoo import models, fields

class TripAssignment(models.Model):
    _name = 'mesob.trip.assignment'
    _description = 'Trip Assignment'

    request_id = fields.Many2one('mesob.trip.request')

    vehicle_id = fields.Many2one('fleet.vehicle')
    driver_id = fields.Many2one('hr.employee')

    assigned_by = fields.Many2one('res.users')
    assigned_at = fields.Datetime(default=fields.Datetime.now)
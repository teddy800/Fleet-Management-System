from odoo import models, fields

class TripLog(models.Model):
    _name = 'mesob.trip.log'
    _description = 'Trip Log'

    assignment_id = fields.Many2one('mesob.trip.assignment')

    timestamp = fields.Datetime()
    status = fields.Selection([
        ('depart', 'Depart'),
        ('arrive', 'Arrive')
    ])

    odometer = fields.Float()
    notes = fields.Text()
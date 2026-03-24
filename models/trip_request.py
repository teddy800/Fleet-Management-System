from odoo import models, fields

class TripRequest(models.Model):
    _name = 'mesob.trip.request'

    state = fields.Selection([
        ('draft', 'Draft'),
        ('approved', 'Approved'),
        ('done', 'Done')
    ], default='draft')

    vehicle_id = fields.Many2one('fleet.vehicle')
    driver_id = fields.Many2one('hr.employee')

    start_date = fields.Datetime()
    end_date = fields.Datetime()

    def action_approve(self):
        self.state = 'approved'

    def action_done(self):
        self.state = 'done'
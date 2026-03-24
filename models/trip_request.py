from odoo import models, fields, api

class TripRequest(models.Model):
    _name = 'mesob.trip.request'
    _inherit = ['mail.thread']

    state = fields.Selection([
        ('draft', 'Draft'),
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('closed', 'Closed'),
    ], default='draft', tracking=True)

    requester_id = fields.Many2one('res.users')
    purpose = fields.Text()

    vehicle_id = fields.Many2one('fleet.vehicle')
    driver_id = fields.Many2one('hr.employee')

    start_datetime = fields.Datetime()
    end_datetime = fields.Datetime()

    def action_submit(self):
        self.state = 'pending'

    def action_approve(self):
        self.state = 'approved'

    def action_start(self):
        self.state = 'in_progress'
        self.vehicle_id.availability = False

    def action_complete(self):
        self.state = 'completed'
        self.vehicle_id.availability = True

    def action_close(self):
        self.state = 'closed'
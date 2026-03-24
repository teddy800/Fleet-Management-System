from odoo import models, fields

class TripRequest(models.Model):
    _name = 'mesob.trip.request'
    _description = 'Trip Request'

    requester_id = fields.Many2one('res.users')
    purpose = fields.Text()

    vehicle_category_needed = fields.Char()

    start_datetime = fields.Datetime()
    end_datetime = fields.Datetime()

    pickup_location = fields.Text()
    dest_location = fields.Text()

    status = fields.Selection([
        ('draft', 'Draft'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected')
    ], default='draft')
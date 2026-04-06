# flake8: noqa
from odoo import models, fields, api  # type: ignore


class TripLog(models.Model):
    """
    FR-1.3 / SRS 7.2: TripLog records status milestones during a trip.
    Statuses: Depart, Arrive, Complete, Fuel, Odometer
    """
    _name = 'mesob.trip.log'
    _description = 'Trip Status Log'
    _order = 'timestamp desc'

    trip_id = fields.Many2one('mesob.trip.request', string="Trip Request", required=True, ondelete='cascade')
    assignment_id = fields.Many2one('mesob.trip.assignment', string="Assignment")
    timestamp = fields.Datetime(string="Timestamp", required=True, default=fields.Datetime.now)

    status = fields.Selection([
        ('depart', 'Departed'),
        ('arrive', 'Arrived at Destination'),
        ('complete', 'Trip Completed'),
        ('fuel', 'Fuel Stop'),
        ('odometer', 'Odometer Update'),
        ('pickup_updated', 'Pickup Point Updated'),
        ('note', 'Driver Note'),
    ], string="Status", required=True, default='note')

    odometer = fields.Float(string="Odometer Reading")
    notes = fields.Text(string="Notes")
    recorded_by = fields.Many2one('res.users', string="Recorded By", default=lambda self: self.env.user)

    # GPS at time of log
    latitude = fields.Float(string="Latitude", digits=(10, 6))
    longitude = fields.Float(string="Longitude", digits=(10, 6))

    start_odometer = fields.Float(string="Start Odometer")
    end_odometer = fields.Float(string="End Odometer")

    @api.model
    def log_trip_event(self, trip_id, status, odometer=0, notes='', lat=0, lng=0):
        """Helper to create a trip log entry"""
        return self.create({
            'trip_id': trip_id,
            'status': status,
            'odometer': odometer,
            'notes': notes,
            'latitude': lat,
            'longitude': lng,
            'timestamp': fields.Datetime.now(),
        })

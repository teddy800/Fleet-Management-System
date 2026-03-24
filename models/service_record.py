from odoo import models, fields, api
from odoo.exceptions import ValidationError


class ServiceRecord(models.Model):
    """Service Record model for logging fuel and maintenance cost events.

    Fields:
        vehicle_id: The vehicle this service record belongs to (required, ondelete='restrict').
        service_type: Type of service — fuel or maintenance (required).
        date: Date of the service event (required).
        cost: Monetary cost of the service (required, must be >= 0).
        currency_id: Currency for the cost field.
        odometer: Odometer reading at the time of service.
        description: Free-text description of the service event.

    Key methods:
        _check_cost: Constraint that raises ValidationError if cost < 0.
    """

    _name = 'mesob.service.record'
    _description = 'Service Record'

    vehicle_id = fields.Many2one(
        'fleet.vehicle',
        required=True,
        ondelete='restrict',
    )
    service_type = fields.Selection([
        ('fuel', 'Fuel'),
        ('maintenance', 'Maintenance'),
    ], required=True)
    date = fields.Date(required=True)
    cost = fields.Float(required=True)
    currency_id = fields.Many2one('res.currency')
    odometer = fields.Integer()
    description = fields.Text()

    @api.constrains('cost')
    def _check_cost(self):
        """Raise ValidationError if cost is negative.

        Inputs: self — recordset of ServiceRecord instances being validated.
        Outputs: None.
        Side effects: Raises ValidationError with message "Cost cannot be negative."
                      if any record has cost < 0.
        """
        for rec in self:
            if rec.cost < 0:
                raise ValidationError("Cost cannot be negative.")

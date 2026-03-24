"""Odometer Log model for MESSOB Fleet Management.

Tracks monotonically non-decreasing odometer readings per vehicle and
keeps the vehicle's current_odometer field in sync with the latest value.
"""
from odoo import models, fields, api
from odoo.exceptions import ValidationError


class OdometerLog(models.Model):
    """Records a single odometer reading for a fleet vehicle.

    Fields:
        vehicle_id: The vehicle this reading belongs to (required).
        value: Odometer value in kilometres (required, float).
        date: Date of the reading (required).

    Key methods:
        _check_odometer_value: Ensures readings never decrease for a vehicle.
        create: Syncs vehicle.current_odometer after creating records.
        write: Syncs vehicle.current_odometer when value is updated.
    """

    _name = 'mesob.odometer.log'
    _description = 'Odometer Log'
    _order = 'date desc'

    vehicle_id = fields.Many2one('fleet.vehicle', required=True)
    value = fields.Float(required=True)
    date = fields.Date(required=True)

    @api.constrains('value', 'vehicle_id')
    def _check_odometer_value(self):
        """Ensure the new odometer value is not less than the previous reading.

        Inputs: self — recordset of OdometerLog records being validated.
        Outputs: None.
        Side effects: Raises ValidationError if value < max existing value for the vehicle.
        """
        for rec in self:
            previous = self.search([
                ('vehicle_id', '=', rec.vehicle_id.id),
                ('id', '!=', rec.id),
            ], order='value desc', limit=1)
            if previous and rec.value < previous.value:
                raise ValidationError(
                    "Odometer value cannot be less than the previous reading."
                )

    @api.model_create_multi
    def create(self, vals_list):
        """Create odometer log records and sync vehicle current_odometer.

        Inputs: vals_list — list of dicts with field values.
        Outputs: Recordset of newly created OdometerLog records.
        Side effects: Sets vehicle_id.current_odometer to int(value) for each record.
        """
        records = super().create(vals_list)
        for rec in records:
            if rec.vehicle_id:
                rec.vehicle_id.current_odometer = int(rec.value)
        return records

    def write(self, vals):
        """Update odometer log records and sync vehicle current_odometer if value changed.

        Inputs: vals — dict of field values to update.
        Outputs: True on success.
        Side effects: Sets vehicle_id.current_odometer to int(value) when value is in vals.
        """
        result = super().write(vals)
        if 'value' in vals:
            for rec in self:
                if rec.vehicle_id:
                    rec.vehicle_id.current_odometer = int(rec.value)
        return result

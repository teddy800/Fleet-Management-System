from odoo import models, fields, api
from odoo.exceptions import ValidationError, AccessError
from odoo.tools.translate import _


class TripAssignment(models.Model):
    _name = 'mesob.trip.assignment'
    _description = 'Trip Assignment'

    trip_id = fields.Many2one('mesob.trip.request', required=True, ondelete='cascade')
    vehicle_id = fields.Many2one('fleet.vehicle', required=True)
    driver_id = fields.Many2one('hr.employee', required=True)
    confirmed_at = fields.Datetime(readonly=True)
    state = fields.Selection([
        ('draft', 'Draft'),
        ('confirmed', 'Confirmed'),
        ('cancelled', 'Cancelled'),
    ], default='draft')

    def _check_dispatcher(self):
        if not (
            self.env.user.has_group('mesob_fleet_customizations.group_fleet_dispatcher') or
            self.env.user.has_group('mesob_fleet_customizations.group_fleet_manager')
        ):
            raise AccessError(_("Only Fleet Dispatchers or Managers can manage trip assignments."))

    def write(self, vals):
        if not self.env.su:
            self._check_dispatcher()
        return super().write(vals)

    @api.constrains('vehicle_id', 'driver_id', 'state')
    def _check_conflicts(self):
        for rec in self:
            if rec.state != 'confirmed':
                continue
            trip = rec.trip_id
            if not trip:
                continue
            overlap_domain = [
                ('state', '=', 'confirmed'),
                ('id', '!=', rec.id),
                ('trip_id.start_datetime', '<', trip.end_datetime),
                ('trip_id.end_datetime', '>', trip.start_datetime),
            ]
            # BR-2: vehicle conflict
            if self.search(overlap_domain + [('vehicle_id', '=', rec.vehicle_id.id)]):
                raise ValidationError(
                    _("Vehicle %s is already assigned to another trip during this period.")
                    % rec.vehicle_id.name
                )
            # BR-3: driver conflict
            if self.search(overlap_domain + [('driver_id', '=', rec.driver_id.id)]):
                raise ValidationError(
                    _("Driver %s is already assigned to another trip during this period.")
                    % rec.driver_id.name
                )

    def action_confirm(self):
        self._check_dispatcher()
        for rec in self:
            rec.state = 'confirmed'
            rec.confirmed_at = fields.Datetime.now()
            if rec.trip_id.state == 'approved':
                rec.trip_id.action_start()

    def action_cancel(self):
        self._check_dispatcher()
        for rec in self:
            rec.state = 'cancelled'

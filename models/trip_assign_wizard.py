from odoo import models, fields, api
from odoo.exceptions import UserError, ValidationError
from odoo.tools.translate import _


class TripAssignWizard(models.TransientModel):
    _name = 'mesob.trip.assign.wizard'
    _description = 'Assign Vehicle to Trip Request'

    trip_request_id = fields.Many2one('mesob.trip.request', required=True, readonly=True)
    vehicle_id = fields.Many2one('fleet.vehicle', string="Vehicle", required=True)
    driver_id = fields.Many2one('hr.employee', string="Driver", required=True)

    def action_assign(self):
        self.ensure_one()
        trip = self.trip_request_id
        if trip.state != 'approved':
            raise UserError(_("Only approved requests can have vehicles assigned."))

        # Create assignment record
        assignment = self.env['mesob.trip.assignment'].create({
            'trip_request_id': trip.id,
            'vehicle_id': self.vehicle_id.id,
            'driver_id': self.driver_id.id,
            'state': 'confirmed',
            'confirmed_at': fields.Datetime.now(),
        })

        trip.write({
            'state': 'assigned',
            'assigned_vehicle_id': self.vehicle_id.id,
            'assigned_driver_id': self.driver_id.id,
            'trip_assignment_id': assignment.id,
            'dispatcher_id': self.env.user.id,
        })

        trip.message_post(
            body=_("Vehicle %s assigned with driver %s by %s") % (
                self.vehicle_id.name, self.driver_id.name, self.env.user.name
            ),
            message_type='notification'
        )
        return {'type': 'ir.actions.act_window_close'}

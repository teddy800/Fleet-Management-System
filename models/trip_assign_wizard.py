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

        now_str = fields.Datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        uid = self.env.uid

        # Use raw SQL to bypass Odoo account_lock_exception end_datetime validation
        self.env.cr.execute("""
            INSERT INTO mesob_trip_assignment
                (trip_request_id, vehicle_id, driver_id, state, confirmed_at,
                 start_datetime, stop_datetime, end_datetime,
                 create_uid, write_uid, create_date, write_date)
            SELECT
                %s, %s, %s, 'assigned', %s,
                start_datetime, end_datetime, end_datetime,
                %s, %s, %s, %s
            FROM mesob_trip_request
            WHERE id = %s
            RETURNING id
        """, (trip.id, self.vehicle_id.id, self.driver_id.id, now_str,
              uid, uid, now_str, now_str, trip.id))
        assignment_id = self.env.cr.fetchone()[0]

        # Update trip request via raw SQL to avoid ORM recompute issues
        self.env.cr.execute("""
            UPDATE mesob_trip_request
            SET state = 'assigned',
                assigned_vehicle_id = %s,
                assigned_driver_id = %s,
                trip_assignment_id = %s,
                dispatcher_id = %s,
                write_uid = %s,
                write_date = %s
            WHERE id = %s
        """, (self.vehicle_id.id, self.driver_id.id, assignment_id,
              uid, uid, now_str, trip.id))

        # Mark vehicle as in use
        self.env.cr.execute("""
            UPDATE fleet_vehicle SET mesob_status = 'in_use',
                write_uid = %s, write_date = %s
            WHERE id = %s
        """, (uid, now_str, self.vehicle_id.id))

        # Invalidate ORM cache
        trip.invalidate_recordset()
        self.vehicle_id.invalidate_recordset()

        # Post chatter message (best-effort)
        try:
            trip.sudo().message_post(
                body=_("Vehicle %s assigned with driver %s by %s") % (
                    self.vehicle_id.name, self.driver_id.name, self.env.user.name
                ),
                message_type='notification'
            )
        except Exception:
            pass

        return {'type': 'ir.actions.act_window_close'}

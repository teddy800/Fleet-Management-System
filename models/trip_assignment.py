from odoo import models, fields, api
from odoo.exceptions import ValidationError, AccessError
from odoo.tools.translate import _


class TripAssignment(models.Model):
    _name = 'mesob.trip.assignment'
    _description = 'Trip Assignment'

    trip_request_id = fields.Many2one('mesob.trip.request', required=True, ondelete='cascade')
    vehicle_id = fields.Many2one('fleet.vehicle', required=True)
    driver_id = fields.Many2one('hr.employee', required=True)
    confirmed_at = fields.Datetime(readonly=True)
    state = fields.Selection([
        ('draft', 'Draft'),
        ('assigned', 'Assigned'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('confirmed', 'Confirmed'),
        ('cancelled', 'Cancelled'),
    ], default='draft')

    # Trip execution tracking (used by Driver mobile API)
    actual_start_datetime = fields.Datetime(string="Actual Start Time")
    actual_end_datetime = fields.Datetime(string="Actual End Time")
    actual_distance = fields.Float(string="Actual Distance (KM)")
    end_odometer = fields.Float(string="End Odometer (KM)")
    notes = fields.Text(string="Trip Notes")

    # Stored related fields for calendar view (FR-2.3)
    start_datetime = fields.Datetime(
        string="Start", related='trip_request_id.start_datetime', store=True
    )
    stop_datetime = fields.Datetime(
        string="End", related='trip_request_id.end_datetime', store=True
    )

    # end_datetime: independent stored field required by Odoo's account_lock_exception
    # module which applies ('end_datetime', '>=', now()) to ALL models on create/write.
    # Populated automatically via create/write overrides below.
    end_datetime = fields.Datetime(
        string="End Date",
        store=True,
        copy=False,
        index=True,
        help="Mirror of stop_datetime. Required by Odoo account_lock_exception module.",
    )

    display_name = fields.Char(
        string="Display Name", compute='_compute_display_name'
    )

    @api.depends('vehicle_id', 'trip_request_id')
    def _compute_display_name(self):
        for rec in self:
            if rec.vehicle_id and rec.trip_request_id:
                purpose = rec.trip_request_id.purpose or ''
                rec.display_name = f"{rec.vehicle_id.name} — {purpose[:30]}"
            else:
                rec.display_name = "Assignment"

    def _check_dispatcher(self):
        if not (
            self.env.user.has_group('mesob_fleet_customizations.group_fleet_dispatcher') or
            self.env.user.has_group('mesob_fleet_customizations.group_fleet_manager')
        ):
            raise AccessError(_("Only Fleet Dispatchers or Managers can manage trip assignments."))

    @api.model_create_multi
    def create(self, vals_list):
        """Populate end_datetime from trip_request on create."""
        records = super().create(vals_list)
        for rec in records:
            if rec.trip_request_id and rec.trip_request_id.end_datetime:
                rec.sudo().write({'end_datetime': rec.trip_request_id.end_datetime})
        return records

    def write(self, vals):
        if not self.env.su and 'state' in vals:
            self._check_dispatcher()
        result = super().write(vals)
        # Keep end_datetime in sync with trip_request.end_datetime
        for rec in self:
            if rec.trip_request_id and rec.trip_request_id.end_datetime:
                if rec.end_datetime != rec.trip_request_id.end_datetime:
                    super(TripAssignment, rec).write(
                        {'end_datetime': rec.trip_request_id.end_datetime}
                    )
        return result

    @api.constrains('vehicle_id', 'driver_id', 'state')
    def _check_conflicts(self):
        """BR-2 / BR-3: Prevent double-booking of vehicles and drivers.
        Uses raw SQL against stop_datetime to avoid ORM field resolution issues.
        """
        for rec in self:
            if rec.state not in ('assigned', 'in_progress'):
                continue
            if self.env.context.get('skip_conflict_check'):
                continue
            trip = rec.trip_request_id
            if not trip or not trip.start_datetime or not trip.end_datetime:
                continue
            # BR-2: vehicle conflict
            self.env.cr.execute("""
                SELECT id FROM mesob_trip_assignment
                WHERE state IN ('assigned', 'in_progress')
                  AND id != %s
                  AND vehicle_id = %s
                  AND start_datetime < %s
                  AND stop_datetime > %s
                LIMIT 1
            """, (rec.id or 0, rec.vehicle_id.id, trip.end_datetime, trip.start_datetime))
            if self.env.cr.fetchone():
                raise ValidationError(
                    _("Vehicle %s is already assigned to another trip during this period.")
                    % rec.vehicle_id.name
                )
            # BR-3: driver conflict
            self.env.cr.execute("""
                SELECT id FROM mesob_trip_assignment
                WHERE state IN ('assigned', 'in_progress')
                  AND id != %s
                  AND driver_id = %s
                  AND start_datetime < %s
                  AND stop_datetime > %s
                LIMIT 1
            """, (rec.id or 0, rec.driver_id.id, trip.end_datetime, trip.start_datetime))
            if self.env.cr.fetchone():
                raise ValidationError(
                    _("Driver %s is already assigned to another trip during this period.")
                    % rec.driver_id.name
                )

    def action_confirm(self):
        self._check_dispatcher()
        for rec in self:
            rec.state = 'assigned'
            rec.confirmed_at = fields.Datetime.now()
            if rec.trip_request_id.state == 'approved':
                rec.trip_request_id.write({
                    'state': 'assigned',
                    'assigned_vehicle_id': rec.vehicle_id.id,
                    'assigned_driver_id': rec.driver_id.id,
                })

    def action_cancel(self):
        self._check_dispatcher()
        for rec in self:
            rec.state = 'cancelled'

    def init(self):
        """Ensure end_datetime column exists and is populated from stop_datetime."""
        super().init()
        try:
            self.env.cr.execute("""
                ALTER TABLE mesob_trip_assignment
                ADD COLUMN IF NOT EXISTS end_datetime timestamp without time zone
            """)
            self.env.cr.execute("""
                UPDATE mesob_trip_assignment
                SET end_datetime = stop_datetime
                WHERE end_datetime IS NULL AND stop_datetime IS NOT NULL
            """)
            # Create trigger to keep end_datetime in sync with stop_datetime
            self.env.cr.execute("""
                CREATE OR REPLACE FUNCTION mesob_sync_end_datetime()
                RETURNS TRIGGER AS $func$
                BEGIN
                    NEW.end_datetime := NEW.stop_datetime;
                    RETURN NEW;
                END;
                $func$ LANGUAGE plpgsql
            """)
            self.env.cr.execute("""
                DROP TRIGGER IF EXISTS trg_mesob_sync_end_datetime
                ON mesob_trip_assignment
            """)
            self.env.cr.execute("""
                CREATE TRIGGER trg_mesob_sync_end_datetime
                BEFORE INSERT OR UPDATE OF stop_datetime ON mesob_trip_assignment
                FOR EACH ROW EXECUTE FUNCTION mesob_sync_end_datetime()
            """)
        except Exception:
            pass  # Column/trigger already exists or DB not ready yet

from odoo import models, fields, api
from odoo.exceptions import ValidationError, AccessError
from odoo.tools.translate import _

COLOR_MAP = {
    'draft': 0,
    'pending': 1,
    'approved': 10,
    'rejected': 9,
    'in_progress': 3,
    'completed': 4,
    'closed': 8,
}


class TripRequest(models.Model):
    _name = 'mesob.trip.request'
    _description = 'Trip Request'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'submitted_at asc, id asc'

    name = fields.Char(
        string="Reference", default="New", readonly=True, copy=False
    )

    # Requester
    requester_id = fields.Many2one(
        'res.users', required=True, default=lambda self: self.env.user, tracking=True
    )

    # Trip details
    purpose = fields.Text(required=True)
    justification = fields.Text(required=True)
    vehicle_category_id = fields.Many2one('fleet.vehicle.tag', string="Vehicle Category")
    pickup_location = fields.Char(required=True)
    destination_location = fields.Char(required=True)

    # Schedule
    start_date = fields.Datetime(required=True, tracking=True)
    end_date = fields.Datetime(required=True, tracking=True)

    # Assignment (filled after approval)
    vehicle_id = fields.Many2one('fleet.vehicle', tracking=True)
    driver_id = fields.Many2one('hr.employee', tracking=True)

    # Workflow
    state = fields.Selection([
        ('draft', 'Draft'),
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('closed', 'Closed'),
    ], default='draft', tracking=True)

    rejection_reason = fields.Text(readonly=True)

    # Timestamps
    submitted_at = fields.Datetime(readonly=True)
    approved_at = fields.Datetime(readonly=True)
    rejected_at = fields.Datetime(readonly=True)
    started_at = fields.Datetime(readonly=True)
    completed_at = fields.Datetime(readonly=True)
    closed_at = fields.Datetime(readonly=True)

    # Kanban color
    color = fields.Integer(compute='_compute_color')

    @api.depends('state')
    def _compute_color(self):
        for rec in self:
            rec.color = COLOR_MAP.get(rec.state, 0)

    @api.constrains('start_date', 'end_date')
    def _check_dates(self):
        for rec in self:
            if rec.start_date and rec.end_date and rec.start_date >= rec.end_date:
                raise ValidationError(_("End date must be after start date."))

    def _require_dispatcher(self):
        if not (
            self.env.user.has_group('mesob_fleet_management.group_fleet_dispatcher') or
            self.env.user.has_group('mesob_fleet_management.group_fleet_manager')
        ):
            raise AccessError(_("Only Fleet Dispatchers can approve or reject trip requests."))

    # --- State transition actions ---

    def action_submit(self):
        for rec in self:
            if rec.state != 'draft':
                raise ValidationError(_("Only draft requests can be submitted."))
            rec.state = 'pending'
            rec.submitted_at = fields.Datetime.now()

    def action_approve(self):
        self._require_dispatcher()
        for rec in self:
            if rec.state != 'pending':
                raise ValidationError(_("Only pending requests can be approved."))
            rec.state = 'approved'
            rec.approved_at = fields.Datetime.now()

    def action_reject(self, reason=''):
        self._require_dispatcher()
        for rec in self:
            if rec.state != 'pending':
                raise ValidationError(_("Only pending requests can be rejected."))
            rec.state = 'rejected'
            rec.rejected_at = fields.Datetime.now()
            rec.rejection_reason = reason

    def action_cancel(self):
        for rec in self:
            if rec.state != 'pending':
                raise ValidationError(_("Only pending requests can be cancelled."))
            rec.state = 'draft'
            rec.submitted_at = False

    def action_start(self):
        for rec in self:
            if rec.state != 'approved':
                raise ValidationError(_("Only approved requests can be started."))
            rec.state = 'in_progress'
            rec.started_at = fields.Datetime.now()

    def action_complete(self):
        for rec in self:
            if rec.state != 'in_progress':
                raise ValidationError(_("Only in-progress requests can be completed."))
            rec.state = 'completed'
            rec.completed_at = fields.Datetime.now()

    def action_close(self):
        for rec in self:
            if rec.state != 'completed':
                raise ValidationError(_("Only completed requests can be closed."))
            rec.state = 'closed'
            rec.closed_at = fields.Datetime.now()

    @api.model
    def create(self, vals):
        if vals.get('name', 'New') == 'New':
            vals['name'] = self.env['ir.sequence'].next_by_code('mesob.trip.request') or 'New'
        return super().create(vals)

from odoo import models, fields, api
from odoo.exceptions import ValidationError


class MaintenanceLog(models.Model):
    _name = 'mesob.maintenance.log'
    _description = 'Vehicle Maintenance Log'
    _order = 'date desc'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    vehicle_id = fields.Many2one(
        'fleet.vehicle', required=True, ondelete='cascade', tracking=True
    )
    technician_id = fields.Many2one('hr.employee', string="Technician", tracking=True)
    service_record_id = fields.Many2one('mesob.service.record', string="Related Service")

    date = fields.Date(required=True, tracking=True)
    description = fields.Text()

    maintenance_type = fields.Selection([
        ('preventive', 'Preventive'),
        ('corrective', 'Corrective'),
        ('emergency', 'Emergency'),
    ], required=True, tracking=True)

    cost = fields.Float(tracking=True)
    currency_id = fields.Many2one(
        'res.currency', default=lambda self: self.env.company.currency_id
    )

    odometer = fields.Float(string="Odometer Reading", required=True, tracking=True)

    parts_ids = fields.One2many(
        'mesob.inventory.allocation', 'maintenance_log_id', string="Parts Used"
    )

    state = fields.Selection([
        ('draft', 'Draft'),
        ('in_progress', 'In Progress'),
        ('done', 'Completed'),
        ('cancel', 'Cancelled'),
    ], default='draft', tracking=True)

    @api.constrains('cost')
    def _check_cost(self):
        for rec in self:
            if rec.cost < 0:
                raise ValidationError("Maintenance cost cannot be negative.")

    @api.constrains('odometer')
    def _check_odometer(self):
        for rec in self:
            if rec.odometer < 0:
                raise ValidationError("Odometer must be positive.")

    def action_start(self):
        for rec in self:
            rec.state = 'in_progress'
            rec.vehicle_id.availability = False

    def action_complete(self):
        for rec in self:
            rec.state = 'done'
            rec.vehicle_id.current_odometer = rec.odometer
            rec.vehicle_id.availability = True
            schedule = self.env['mesob.maintenance.schedule'].search(
                [('vehicle_id', '=', rec.vehicle_id.id)], limit=1
            )
            if schedule:
                schedule.last_odometer = rec.odometer
                schedule.last_service_date = rec.date

    def action_cancel(self):
        for rec in self:
            rec.state = 'cancel'
            if rec.vehicle_id:
                rec.vehicle_id.availability = True

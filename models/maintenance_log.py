from odoo import models, fields, api
from odoo.exceptions import ValidationError


class MaintenanceLog(models.Model):
    _name = 'mesob.maintenance.log'
    _description = 'Vehicle Maintenance Log'
    _order = 'date desc'
    _inherit = ['mail.thread']

    # 🔗 RELATIONS
    vehicle_id = fields.Many2one(
        'fleet.vehicle',
        required=True,
        ondelete='cascade',
        tracking=True
    )

    technician_id = fields.Many2one(
        'hr.employee',
        string="Technician",
        tracking=True
    )

    service_record_id = fields.Many2one(
        'mesob.service.record',
        string="Related Service"
    )

    # 📅 BASIC INFO
    date = fields.Date(required=True, tracking=True)
    description = fields.Text()

    # 🔧 MAINTENANCE TYPE
    maintenance_type = fields.Selection([
        ('preventive', 'Preventive'),
        ('corrective', 'Corrective'),
        ('emergency', 'Emergency')
    ], required=True, tracking=True)

    # 💰 COST
    cost = fields.Float()
    currency_id = fields.Many2one(
        'res.currency',
        default=lambda self: self.env.company.currency_id
    )

    # 📏 ODOMETER
    odometer = fields.Float(
        string="Odometer Reading",
        required=True
    )

    # 📦 INVENTORY LINK (PARTS USED)
    parts_ids = fields.One2many(
        'mesob.inventory.allocation',
        'vehicle_id',
        string="Parts Used"
    )

    # 📊 STATUS
    state = fields.Selection([
        ('draft', 'Draft'),
        ('in_progress', 'In Progress'),
        ('done', 'Completed'),
        ('cancel', 'Cancelled')
    ], default='draft', tracking=True)

    # ✅ VALIDATIONS
    @api.constrains('cost')
    def _check_cost(self):
        for rec in self:
            if rec.cost < 0:
                raise ValidationError("Cost cannot be negative.")

    @api.constrains('odometer')
    def _check_odometer(self):
        for rec in self:
            if rec.odometer < 0:
                raise ValidationError("Odometer must be positive.")

    # 🔄 ACTIONS (WORKFLOW)
    def action_start(self):
        for rec in self:
            rec.state = 'in_progress'
            rec.vehicle_id.is_available = False

    def action_complete(self):
        for rec in self:
            rec.state = 'done'

            # Update vehicle odometer
            rec.vehicle_id.current_odometer = rec.odometer

            # Make vehicle available again
            rec.vehicle_id.is_available = True

    def action_cancel(self):
        self.state = 'cancel'
from odoo import models, fields, api
from datetime import timedelta


class MaintenanceSchedule(models.Model):
    _name = 'mesob.maintenance.schedule'
    _description = 'Maintenance Schedule'
    _rec_name = 'display_name'

    vehicle_id = fields.Many2one('fleet.vehicle', required=True, string="Vehicle")
    maintenance_type = fields.Char(string="Maintenance Type", required=True)
    interval_km = fields.Float(string="Interval (KM)", default=0)
    interval_days = fields.Integer(string="Interval (Days)", default=0)
    last_odometer = fields.Float(string="Last Service Odometer")
    last_service_date = fields.Date(string="Last Service Date")
    notes = fields.Text(string="Notes")

    # Computed next due fields
    next_due_odometer = fields.Float(
        string="Next Due Odometer", compute="_compute_next_due", store=True
    )
    next_due_date = fields.Date(
        string="Next Due Date", compute="_compute_next_due", store=True
    )
    is_overdue = fields.Boolean(
        string="Overdue", compute="_compute_overdue", store=True
    )
    display_name = fields.Char(
        string="Display Name", compute="_compute_display_name"
    )

    @api.depends('maintenance_type', 'vehicle_id')
    def _compute_display_name(self):
        for rec in self:
            if rec.maintenance_type and rec.vehicle_id:
                rec.display_name = f"{rec.maintenance_type} - {rec.vehicle_id.name}"
            else:
                rec.display_name = rec.maintenance_type or "New Schedule"

    @api.depends('last_odometer', 'interval_km', 'last_service_date', 'interval_days')
    def _compute_next_due(self):
        for rec in self:
            if rec.interval_km and rec.last_odometer:
                rec.next_due_odometer = rec.last_odometer + rec.interval_km
            else:
                rec.next_due_odometer = 0

            if rec.interval_days and rec.last_service_date:
                rec.next_due_date = rec.last_service_date + timedelta(days=rec.interval_days)
            else:
                rec.next_due_date = False

    @api.depends('next_due_odometer', 'next_due_date', 'vehicle_id')
    def _compute_overdue(self):
        today = fields.Date.today()
        for rec in self:
            overdue = False
            if rec.next_due_date and rec.next_due_date < today:
                overdue = True
            if rec.next_due_odometer and rec.vehicle_id and rec.vehicle_id.current_odometer:
                if rec.vehicle_id.current_odometer >= rec.next_due_odometer:
                    overdue = True
            rec.is_overdue = overdue

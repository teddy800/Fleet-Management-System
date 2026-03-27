from odoo import models, fields, api
from odoo.exceptions import ValidationError


class FuelLog(models.Model):
    _name = 'mesob.fuel.log'
    _description = 'Fuel Log'
    _order = 'date desc, id desc'

    vehicle_id = fields.Many2one('fleet.vehicle', required=True)
    driver_id = fields.Many2one('hr.employee', string="Driver")
    date = fields.Date(required=True)
    fuel_station = fields.Char(string="Fuel Station")
    volume = fields.Float(string="Volume (L)")
    cost = fields.Float()
    odometer = fields.Float(string="Odometer at Refuel")
    efficiency = fields.Float(
        string="Efficiency (KM/L)", compute='_compute_efficiency', store=True
    )

    @api.depends('odometer', 'volume', 'vehicle_id', 'date')
    def _compute_efficiency(self):
        for rec in self:
            if not rec.vehicle_id or not rec.volume or rec.volume <= 0:
                rec.efficiency = 0.0
                continue
            prev = self.search([
                ('vehicle_id', '=', rec.vehicle_id.id),
                ('date', '<=', rec.date),
                ('id', '!=', rec._origin.id),
            ], order='date desc, id desc', limit=1)
            if prev and rec.odometer > prev.odometer:
                rec.efficiency = (rec.odometer - prev.odometer) / rec.volume
            else:
                rec.efficiency = 0.0

    @api.constrains('volume')
    def _check_volume(self):
        for rec in self:
            if rec.volume <= 0:
                raise ValidationError("Fuel volume must be greater than zero.")

    @api.constrains('cost')
    def _check_cost(self):
        for rec in self:
            if rec.cost < 0:
                raise ValidationError("Fuel cost cannot be negative.")

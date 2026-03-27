from odoo import models, fields, api
from odoo.exceptions import ValidationError


class InventoryAllocation(models.Model):
    _name = 'mesob.inventory.allocation'
    _description = 'Inventory Allocation to Vehicle'

    vehicle_id = fields.Many2one('fleet.vehicle')
    product_id = fields.Many2one('product.product', required=True)
    quantity = fields.Float()
    maintenance_log_id = fields.Many2one(
        'mesob.maintenance.log', string="Maintenance Job", ondelete='cascade'
    )

    @api.constrains('quantity')
    def _check_quantity(self):
        for rec in self:
            if rec.quantity <= 0:
                raise ValidationError("Quantity must be greater than zero.")

from odoo import models, fields

class InventoryAllocation(models.Model):
    _name = 'mesob.inventory.allocation'

    vehicle_id = fields.Many2one('fleet.vehicle')
    product_id = fields.Many2one('product.product')
    quantity = fields.Float()
    
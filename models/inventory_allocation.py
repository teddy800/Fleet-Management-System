from odoo import models, fields, api
from odoo.exceptions import ValidationError


class InventoryAllocation(models.Model):
    _name = 'mesob.inventory.allocation'
    _description = 'Inventory Allocation to Vehicle'
    _rec_name = 'display_name'

    vehicle_id = fields.Many2one('fleet.vehicle', required=True, string="Vehicle")
    product_id = fields.Many2one('product.product', required=True, string="Product/Part")
    quantity = fields.Float(required=True, string="Quantity")
    unit_cost = fields.Float(string="Unit Cost")
    total_cost = fields.Float(string="Total Cost", compute="_compute_total_cost", store=True)
    allocation_date = fields.Datetime(string="Allocation Date", default=fields.Datetime.now)
    maintenance_log_id = fields.Many2one(
        'mesob.maintenance.log', string="Maintenance Job", ondelete='cascade'
    )
    state = fields.Selection([
        ('allocated', 'Allocated'),
        ('installed', 'Installed'),
        ('returned', 'Returned')
    ], default='allocated', string="Status")
    
    # Integration with stock module
    stock_move_id = fields.Many2one('stock.move', string="Stock Movement")
    location_id = fields.Many2one('stock.location', string="Source Location")
    destination_location_id = fields.Many2one('stock.location', string="Destination Location")
    
    display_name = fields.Char(string="Display Name", compute="_compute_display_name")

    @api.depends('product_id', 'vehicle_id', 'quantity')
    def _compute_display_name(self):
        for rec in self:
            if rec.product_id and rec.vehicle_id:
                rec.display_name = f"{rec.product_id.name} → {rec.vehicle_id.name} ({rec.quantity})"
            else:
                rec.display_name = "New Allocation"

    @api.depends('quantity', 'unit_cost')
    def _compute_total_cost(self):
        for rec in self:
            rec.total_cost = rec.quantity * rec.unit_cost

    @api.constrains('quantity')
    def _check_quantity(self):
        for rec in self:
            if rec.quantity <= 0:
                raise ValidationError("Quantity must be greater than zero.")

    def action_install_part(self):
        """Mark part as installed and create stock movement"""
        for rec in self:
            rec.state = 'installed'
            # Create stock movement if stock module is available
            if rec.env['ir.module.module'].search([('name', '=', 'stock'), ('state', '=', 'installed')]):
                rec._create_stock_movement()

    def _create_stock_movement(self):
        """Create stock movement for inventory tracking"""
        if not self.stock_move_id and self.product_id:
            move_vals = {
                'name': f"Fleet allocation: {self.product_id.name} to {self.vehicle_id.name}",
                'product_id': self.product_id.id,
                'product_uom_qty': self.quantity,
                'product_uom': self.product_id.uom_id.id,
                'location_id': self.location_id.id or self.env.ref('stock.stock_location_stock').id,
                'location_dest_id': self.destination_location_id.id or self.env.ref('stock.stock_location_customers').id,
            }
            move = self.env['stock.move'].create(move_vals)
            move._action_confirm()
            move._action_done()
            self.stock_move_id = move.id

from odoo import models, fields, api
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta
import json
import logging

_logger = logging.getLogger(__name__)


class TripRequest(models.Model):
    _name = 'mesob.trip.request'
    _description = 'Trip Request'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'create_date desc'
    _rec_name = 'display_name'

    # Basic Information
    name = fields.Char(string="Request Number", required=True, copy=False, readonly=True, default='New')
    display_name = fields.Char(string="Display Name", compute="_compute_display_name", store=True)
    employee_id = fields.Many2one('hr.employee', string="Requester", required=True, default=lambda self: self._get_current_employee())
    purpose = fields.Text(string="Trip Purpose", required=True, tracking=True)
    
    # Vehicle Requirements
    vehicle_category = fields.Selection([
        ('sedan', 'Sedan'),
        ('suv', 'SUV'),
        ('pickup', 'Pickup Truck'),
        ('bus', 'Bus'),
        ('minibus', 'Mini-Bus'),
        ('motorcycle', 'Motorcycle'),
        ('truck', 'Truck')
    ], string="Required Vehicle Category", required=True, tracking=True)
    
    passenger_count = fields.Integer(string="Number of Passengers", default=1)
    cargo_requirements = fields.Text(string="Cargo Requirements")
    special_requirements = fields.Text(string="Special Requirements")
    
    # Schedule Information
    start_datetime = fields.Datetime(string="Start Date & Time", required=True, tracking=True)
    end_datetime = fields.Datetime(string="End Date & Time", required=True, tracking=True)
    is_recurring = fields.Boolean(string="Recurring Trip")
    recurrence_pattern = fields.Selection([
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly')
    ], string="Recurrence Pattern")
    
    # Location Information
    pickup_location = fields.Char(string="Pickup Location", required=True)
    pickup_latitude = fields.Float(string="Pickup Latitude", digits=(10, 6))
    pickup_longitude = fields.Float(string="Pickup Longitude", digits=(10, 6))
    
    destination_location = fields.Char(string="Destination Location", required=True)
    destination_latitude = fields.Float(string="Destination Latitude", digits=(10, 6))
    destination_longitude = fields.Float(string="Destination Longitude", digits=(10, 6))
    
    # Route Information
    estimated_distance = fields.Float(string="Estimated Distance (KM)")
    estimated_duration = fields.Float(string="Estimated Duration (Hours)")
    estimated_cost = fields.Float(string="Estimated Cost")
    route_waypoints = fields.Text(string="Route Waypoints (JSON)")
    
    # Priority and Classification
    priority = fields.Selection([
        ('low', 'Low'),
        ('normal', 'Normal'),
        ('high', 'High'),
        ('urgent', 'Urgent')
    ], string="Priority", default='normal', tracking=True)
    
    trip_type = fields.Selection([
        ('official', 'Official Business'),
        ('emergency', 'Emergency'),
        ('maintenance', 'Maintenance'),
        ('personal', 'Personal (Authorized)')
    ], string="Trip Type", default='official', required=True)
    
    # Status and Workflow
    state = fields.Selection([
        ('draft', 'Draft'),
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('assigned', 'Vehicle Assigned'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('rejected', 'Rejected')
    ], string="Status", default='draft', tracking=True)
    
    # Assignment Information
    assigned_vehicle_id = fields.Many2one('fleet.vehicle', string="Assigned Vehicle", tracking=True)
    assigned_driver_id = fields.Many2one('hr.employee', string="Assigned Driver", tracking=True)
    dispatcher_id = fields.Many2one('res.users', string="Dispatcher", tracking=True)
    
    # Approval Information
    approved_by = fields.Many2one('res.users', string="Approved By", readonly=True)
    approved_date = fields.Datetime(string="Approval Date", readonly=True)
    rejection_reason = fields.Text(string="Rejection Reason")
    
    # Trip Execution
    actual_start_datetime = fields.Datetime(string="Actual Start Time")
    actual_end_datetime = fields.Datetime(string="Actual End Time")
    actual_distance = fields.Float(string="Actual Distance (KM)")
    actual_cost = fields.Float(string="Actual Cost")
    
    # Feedback and Rating
    trip_rating = fields.Selection([
        ('1', 'Poor'),
        ('2', 'Fair'),
        ('3', 'Good'),
        ('4', 'Very Good'),
        ('5', 'Excellent')
    ], string="Trip Rating")
    feedback = fields.Text(string="Feedback")
    
    # Related Records
    trip_assignment_id = fields.Many2one('mesob.trip.assignment', string="Trip Assignment")
    fuel_log_ids = fields.One2many('mesob.fuel.log', 'trip_request_id', string="Fuel Logs")
    
    # Computed Fields
    duration_hours = fields.Float(string="Duration (Hours)", compute="_compute_duration", store=True)
    is_overdue = fields.Boolean(string="Is Overdue", compute="_compute_overdue")
    can_cancel = fields.Boolean(string="Can Cancel", compute="_compute_can_cancel")
    can_modify = fields.Boolean(string="Can Modify", compute="_compute_can_modify")

    @api.model
    def create(self, vals):
        if vals.get('name', 'New') == 'New':
            vals['name'] = self.env['ir.sequence'].next_by_code('mesob.trip.request') or 'New'
        return super().create(vals)

    @api.depends('name', 'purpose', 'employee_id')
    def _compute_display_name(self):
        for request in self:
            if request.name and request.purpose:
                request.display_name = f"{request.name} - {request.purpose[:50]}"
            else:
                request.display_name = request.name or 'New Request'

    @api.depends('start_datetime', 'end_datetime')
    def _compute_duration(self):
        for request in self:
            if request.start_datetime and request.end_datetime:
                delta = request.end_datetime - request.start_datetime
                request.duration_hours = delta.total_seconds() / 3600
            else:
                request.duration_hours = 0

    @api.depends('end_datetime', 'state')
    def _compute_overdue(self):
        now = fields.Datetime.now()
        for request in self:
            request.is_overdue = (
                request.end_datetime and 
                request.end_datetime < now and 
                request.state not in ['completed', 'cancelled']
            )

    @api.depends('state', 'employee_id')
    def _compute_can_cancel(self):
        for request in self:
            request.can_cancel = (
                request.state in ['draft', 'pending'] and
                (request.employee_id.user_id == self.env.user or 
                 self.env.user.has_group('mesob_fleet_customizations.group_fleet_dispatcher'))
            )

    @api.depends('state', 'employee_id')
    def _compute_can_modify(self):
        for request in self:
            request.can_modify = (
                request.state == 'draft' and
                request.employee_id.user_id == self.env.user
            )

    def _get_current_employee(self):
        """Get current user's employee record"""
        return self.env['hr.employee'].search([('user_id', '=', self.env.uid)], limit=1)

    @api.constrains('start_datetime', 'end_datetime')
    def _check_datetime_sequence(self):
        for request in self:
            if request.start_datetime and request.end_datetime:
                if request.start_datetime >= request.end_datetime:
                    raise ValidationError("End date/time must be after start date/time.")

    @api.constrains('passenger_count')
    def _check_passenger_count(self):
        for request in self:
            if request.passenger_count < 1:
                raise ValidationError("Passenger count must be at least 1.")

    def action_submit(self):
        """Submit trip request for approval"""
        self.ensure_one()
        if self.state != 'draft':
            raise UserError("Only draft requests can be submitted.")
        
        # Validate required fields
        self._validate_request_data()
        
        # Calculate route information
        self._calculate_route_info()
        
        # Change state to pending
        self.write({
            'state': 'pending'
        })
        
        # Send notification to dispatchers
        self._notify_dispatchers()
        
        # Log activity
        self.message_post(
            body=f"Trip request submitted by {self.employee_id.name}",
            message_type='notification'
        )

    def action_approve(self):
        """Approve trip request"""
        self.ensure_one()
        if not self.env.user.has_group('mesob_fleet_customizations.group_fleet_dispatcher'):
            raise UserError("Only dispatchers can approve requests.")
        
        if self.state != 'pending':
            raise UserError("Only pending requests can be approved.")
        
        self.write({
            'state': 'approved',
            'approved_by': self.env.user.id,
            'approved_date': fields.Datetime.now(),
            'dispatcher_id': self.env.user.id
        })
        
        # Notify requester
        self._notify_requester('approved')
        
        # Log activity
        self.message_post(
            body=f"Trip request approved by {self.env.user.name}",
            message_type='notification'
        )

    def action_reject(self):
        """Reject trip request"""
        self.ensure_one()
        if not self.env.user.has_group('mesob_fleet_customizations.group_fleet_dispatcher'):
            raise UserError("Only dispatchers can reject requests.")
        
        if self.state != 'pending':
            raise UserError("Only pending requests can be rejected.")
        
        # Open wizard for rejection reason
        return {
            'type': 'ir.actions.act_window',
            'name': 'Rejection Reason',
            'res_model': 'mesob.trip.rejection.wizard',
            'view_mode': 'form',
            'target': 'new',
            'context': {'default_trip_request_id': self.id}
        }

    def action_assign_vehicle(self, vehicle_id, driver_id):
        """Assign vehicle and driver to trip request"""
        self.ensure_one()
        if self.state != 'approved':
            raise UserError("Only approved requests can have vehicles assigned.")
        
        # Validate vehicle availability
        vehicle = self.env['fleet.vehicle'].browse(vehicle_id)
        if not self._check_vehicle_availability(vehicle):
            raise UserError("Selected vehicle is not available for the requested time period.")
        
        # Validate driver availability
        driver = self.env['hr.employee'].browse(driver_id)
        if not self._check_driver_availability(driver):
            raise UserError("Selected driver is not available for the requested time period.")
        
        # Create trip assignment
        assignment = self.env['mesob.trip.assignment'].create({
            'trip_request_id': self.id,
            'vehicle_id': vehicle_id,
            'driver_id': driver_id,
            'start_datetime': self.start_datetime,
            'end_datetime': self.end_datetime,
            'state': 'assigned'
        })
        
        self.write({
            'state': 'assigned',
            'assigned_vehicle_id': vehicle_id,
            'assigned_driver_id': driver_id,
            'trip_assignment_id': assignment.id
        })
        
        # Update vehicle availability
        vehicle.write({'mesob_status': 'in_use'})
        
        # Notify driver and requester
        self._notify_assignment(vehicle, driver)

    def action_open_assign_wizard(self):
        """Open wizard to assign vehicle and driver"""
        self.ensure_one()
        if self.state != 'approved':
            raise UserError("Only approved requests can have vehicles assigned.")
        return {
            'type': 'ir.actions.act_window',
            'name': 'Assign Vehicle',
            'res_model': 'mesob.trip.assign.wizard',
            'view_mode': 'form',
            'target': 'new',
            'context': {'default_trip_request_id': self.id}
        }

    def action_cancel(self):
        """Cancel trip request"""
        self.ensure_one()
        if not self.can_cancel:
            raise UserError("This request cannot be cancelled.")
        
        # If vehicle is assigned, make it available again
        if self.assigned_vehicle_id:
            self.assigned_vehicle_id.write({'mesob_status': 'available'})
        
        self.write({'state': 'cancelled'})
        
        # Notify relevant parties
        self._notify_cancellation()

    def _validate_request_data(self):
        """Validate trip request data"""
        if not self.purpose or len(self.purpose.strip()) < 10:
            raise ValidationError("Trip purpose must be at least 10 characters long.")
        
        if not self.pickup_location or not self.destination_location:
            raise ValidationError("Both pickup and destination locations are required.")
        
        # Check for conflicting requests
        conflicting = self.search([
            ('employee_id', '=', self.employee_id.id),
            ('state', 'in', ['approved', 'assigned', 'in_progress']),
            ('start_datetime', '<=', self.end_datetime),
            ('end_datetime', '>=', self.start_datetime),
            ('id', '!=', self.id)
        ])
        
        if conflicting:
            raise ValidationError("You have a conflicting trip request for this time period.")

    def _calculate_route_info(self):
        """Calculate route information using external mapping service"""
        # This would integrate with Google Maps API or similar
        # For now, using placeholder calculations
        
        # Simple distance calculation (placeholder)
        if self.pickup_latitude and self.pickup_longitude and self.destination_latitude and self.destination_longitude:
            # Haversine formula for distance calculation
            import math
            
            lat1, lon1 = math.radians(self.pickup_latitude), math.radians(self.pickup_longitude)
            lat2, lon2 = math.radians(self.destination_latitude), math.radians(self.destination_longitude)
            
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            
            a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
            c = 2 * math.asin(math.sqrt(a))
            distance = 6371 * c  # Earth's radius in kilometers
            
            self.estimated_distance = distance
            self.estimated_duration = distance / 50  # Assuming 50 km/h average speed
            self.estimated_cost = distance * 2.5  # Assuming 2.5 currency units per km

    def _check_vehicle_availability(self, vehicle):
        """Check if vehicle is available for the requested time period"""
        conflicting_assignments = self.env['mesob.trip.assignment'].search([
            ('vehicle_id', '=', vehicle.id),
            ('state', 'in', ['assigned', 'in_progress']),
            ('start_datetime', '<=', self.end_datetime),
            ('end_datetime', '>=', self.start_datetime)
        ])
        
        return len(conflicting_assignments) == 0

    def _check_driver_availability(self, driver):
        """Check if driver is available for the requested time period"""
        conflicting_assignments = self.env['mesob.trip.assignment'].search([
            ('driver_id', '=', driver.id),
            ('state', 'in', ['assigned', 'in_progress']),
            ('start_datetime', '<=', self.end_datetime),
            ('end_datetime', '>=', self.start_datetime)
        ])
        
        return len(conflicting_assignments) == 0

    def _notify_dispatchers(self):
        """Send notification to dispatchers about new request"""
        dispatchers = self.env['res.users'].search([
            ('groups_id', 'in', self.env.ref('mesob_fleet_customizations.group_fleet_dispatcher').id)
        ])
        
        for dispatcher in dispatchers:
            self.message_post(
                body=f"New trip request requires approval: {self.display_name}",
                partner_ids=[dispatcher.partner_id.id],
                message_type='notification'
            )

    def _notify_requester(self, action):
        """Send notification to requester about request status"""
        if self.employee_id.user_id:
            message = f"Your trip request has been {action}: {self.display_name}"
            self.message_post(
                body=message,
                partner_ids=[self.employee_id.user_id.partner_id.id],
                message_type='notification'
            )

    def _notify_assignment(self, vehicle, driver):
        """Send notification about vehicle assignment"""
        # Notify requester
        if self.employee_id.user_id:
            message = f"Vehicle assigned to your trip: {vehicle.name} with driver {driver.name}"
            self.message_post(
                body=message,
                partner_ids=[self.employee_id.user_id.partner_id.id],
                message_type='notification'
            )
        
        # Notify driver
        if driver.user_id:
            message = f"You have been assigned to trip: {self.display_name}"
            self.message_post(
                body=message,
                partner_ids=[driver.user_id.partner_id.id],
                message_type='notification'
            )

    def _notify_cancellation(self):
        """Send notification about trip cancellation"""
        partners_to_notify = []
        
        if self.employee_id.user_id:
            partners_to_notify.append(self.employee_id.user_id.partner_id.id)
        
        if self.assigned_driver_id and self.assigned_driver_id.user_id:
            partners_to_notify.append(self.assigned_driver_id.user_id.partner_id.id)
        
        if self.dispatcher_id:
            partners_to_notify.append(self.dispatcher_id.partner_id.id)
        
        if partners_to_notify:
            self.message_post(
                body=f"Trip request has been cancelled: {self.display_name}",
                partner_ids=partners_to_notify,
                message_type='notification'
            )

    @api.model
    def get_dashboard_stats(self):
        """Get dashboard statistics for trip requests"""
        today = fields.Date.today()
        
        stats = {
            'total_requests': self.search_count([]),
            'pending_requests': self.search_count([('state', '=', 'pending')]),
            'approved_today': self.search_count([
                ('state', '=', 'approved'),
                ('approved_date', '>=', today)
            ]),
            'in_progress': self.search_count([('state', '=', 'in_progress')]),
            'completed_today': self.search_count([
                ('state', '=', 'completed'),
                ('actual_end_datetime', '>=', today)
            ]),
            'overdue_requests': self.search_count([('is_overdue', '=', True)])
        }
        
        return stats
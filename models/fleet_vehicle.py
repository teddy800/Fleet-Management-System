from odoo import models, fields, api
from odoo.exceptions import ValidationError
import requests
import json
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)


class FleetVehicle(models.Model):
    _inherit = 'fleet.vehicle'

    availability = fields.Selection([
        ('available', 'Available'),
        ('in_use', 'In Use'),
        ('maintenance', 'Under Maintenance'),
        ('unavailable', 'Unavailable')
    ], default='available', string="Availability Status")

    maintenance_due = fields.Boolean(
        string="Maintenance Due", compute="_compute_maintenance_due", store=True
    )
    
    current_odometer = fields.Float(string="Current Odometer (KM)")
    
    # Advanced GPS tracking fields
    last_gps_update = fields.Datetime(string="Last GPS Update")
    current_latitude = fields.Float(string="Current Latitude", digits=(10, 6))
    current_longitude = fields.Float(string="Current Longitude", digits=(10, 6))
    current_speed = fields.Float(string="Current Speed (KM/H)")
    current_heading = fields.Float(string="Current Heading (Degrees)")
    gps_accuracy = fields.Float(string="GPS Accuracy (Meters)")
    
    # Enhanced analytics fields
    fuel_efficiency = fields.Float(string="Fuel Efficiency (KM/L)", compute="_compute_fuel_efficiency", store=True)
    total_trips = fields.Integer(string="Total Trips", compute="_compute_trip_stats", store=True)
    utilization_rate = fields.Float(string="Utilization Rate (%)", compute="_compute_utilization_rate", store=True)
    average_trip_distance = fields.Float(string="Avg Trip Distance (KM)", compute="_compute_trip_stats", store=True)
    total_maintenance_cost = fields.Float(string="Total Maintenance Cost", compute="_compute_maintenance_cost", store=True)
    
    # Predictive maintenance fields
    next_maintenance_date = fields.Date(string="Next Maintenance Date", compute="_compute_next_maintenance")
    maintenance_score = fields.Float(string="Maintenance Risk Score", compute="_compute_maintenance_score")
    
    # Fleet management fields
    assigned_driver_id = fields.Many2one('hr.employee', string="Assigned Driver")
    vehicle_category = fields.Selection([
        ('sedan', 'Sedan'),
        ('suv', 'SUV'),
        ('pickup', 'Pickup Truck'),
        ('bus', 'Bus'),
        ('minibus', 'Mini-Bus'),
        ('motorcycle', 'Motorcycle'),
        ('truck', 'Truck')
    ], string="Vehicle Category", required=True)
    
    # Insurance and documentation
    insurance_expiry = fields.Date(string="Insurance Expiry Date")
    registration_expiry = fields.Date(string="Registration Expiry Date")
    inspection_expiry = fields.Date(string="Inspection Expiry Date")
    
    # Cost tracking
    acquisition_cost = fields.Float(string="Acquisition Cost")
    current_value = fields.Float(string="Current Value", compute="_compute_current_value")
    depreciation_rate = fields.Float(string="Annual Depreciation Rate (%)", default=15.0)

    @api.depends('current_odometer')
    def _compute_maintenance_due(self):
        for vehicle in self:
            maintenance_due = False
            
            # Check odometer-based maintenance
            if vehicle.current_odometer:
                schedules = self.env['mesob.maintenance.schedule'].search([
                    ('vehicle_id', '=', vehicle.id),
                    ('next_due_odometer', '<=', vehicle.current_odometer + 500)  # 500 KM warning
                ])
                if schedules:
                    maintenance_due = True
            
            # Check date-based maintenance
            date_schedules = self.env['mesob.maintenance.schedule'].search([
                ('vehicle_id', '=', vehicle.id),
                ('next_due_date', '<=', fields.Date.today() + timedelta(days=30))  # 30 days warning
            ])
            if date_schedules:
                maintenance_due = True
                
            vehicle.maintenance_due = maintenance_due

    @api.depends('current_odometer')
    def _compute_fuel_efficiency(self):
        for vehicle in self:
            fuel_logs = self.env['mesob.fuel.log'].search([('vehicle_id', '=', vehicle.id)], order='date')
            if len(fuel_logs) >= 2:
                total_fuel = sum(fuel_logs.mapped('volume'))
                distance_traveled = fuel_logs[-1].odometer - fuel_logs[0].odometer
                vehicle.fuel_efficiency = distance_traveled / total_fuel if total_fuel > 0 else 0
            else:
                vehicle.fuel_efficiency = 0

    @api.depends('current_odometer')
    def _compute_trip_stats(self):
        for vehicle in self:
            assignments = self.env['mesob.trip.assignment'].search([('vehicle_id', '=', vehicle.id), ('state', '=', 'completed')])
            vehicle.total_trips = len(assignments)
            
            if assignments:
                total_distance = sum(assignments.mapped('actual_distance'))
                vehicle.average_trip_distance = total_distance / len(assignments)
            else:
                vehicle.average_trip_distance = 0

    @api.depends('current_odometer')
    def _compute_utilization_rate(self):
        for vehicle in self:
            # Calculate utilization for the last 30 days
            thirty_days_ago = fields.Date.today() - timedelta(days=30)
            recent_assignments = self.env['mesob.trip.assignment'].search([
                ('vehicle_id', '=', vehicle.id),
                ('start_datetime', '>=', thirty_days_ago),
                ('state', 'in', ['completed', 'in_progress'])
            ])
            
            if recent_assignments:
                total_hours_used = sum(
                    (assignment.end_datetime - assignment.start_datetime).total_seconds() / 3600
                    for assignment in recent_assignments
                    if assignment.end_datetime
                )
                total_available_hours = 30 * 24  # 30 days * 24 hours
                vehicle.utilization_rate = (total_hours_used / total_available_hours) * 100
            else:
                vehicle.utilization_rate = 0

    @api.depends('current_odometer')
    def _compute_maintenance_cost(self):
        for vehicle in self:
            maintenance_logs = self.env['mesob.maintenance.log'].search([('vehicle_id', '=', vehicle.id)])
            vehicle.total_maintenance_cost = sum(maintenance_logs.mapped('cost'))

    @api.depends('acquisition_cost', 'acquisition_date', 'depreciation_rate')
    def _compute_current_value(self):
        for vehicle in self:
            if vehicle.acquisition_cost and vehicle.acquisition_date:
                years_owned = (fields.Date.today() - vehicle.acquisition_date).days / 365.25
                depreciation = vehicle.acquisition_cost * (vehicle.depreciation_rate / 100) * years_owned
                vehicle.current_value = max(0, vehicle.acquisition_cost - depreciation)
            else:
                vehicle.current_value = 0

    def _compute_next_maintenance(self):
        for vehicle in self:
            next_maintenance = self.env['mesob.maintenance.schedule'].search([
                ('vehicle_id', '=', vehicle.id)
            ], order='next_due_date asc', limit=1)
            
            vehicle.next_maintenance_date = next_maintenance.next_due_date if next_maintenance else False

    def _compute_maintenance_score(self):
        for vehicle in self:
            # Calculate maintenance risk score based on various factors
            score = 0
            
            # Age factor
            if vehicle.acquisition_date:
                age_years = (fields.Date.today() - vehicle.acquisition_date).days / 365.25
                score += min(age_years * 10, 50)  # Max 50 points for age
            
            # Mileage factor
            if vehicle.current_odometer:
                mileage_factor = vehicle.current_odometer / 10000  # Every 10k KM adds 1 point
                score += min(mileage_factor, 30)  # Max 30 points for mileage
            
            # Recent maintenance frequency
            recent_maintenance = self.env['mesob.maintenance.log'].search_count([
                ('vehicle_id', '=', vehicle.id),
                ('date', '>=', fields.Date.today() - timedelta(days=90))
            ])
            score += recent_maintenance * 5  # 5 points per recent maintenance
            
            vehicle.maintenance_score = min(score, 100)  # Cap at 100

    def update_gps_location(self, latitude, longitude, speed=0, heading=0, accuracy=0):
        """Update vehicle GPS location"""
        self.ensure_one()
        self.write({
            'current_latitude': latitude,
            'current_longitude': longitude,
            'current_speed': speed,
            'current_heading': heading,
            'gps_accuracy': accuracy,
            'last_gps_update': fields.Datetime.now()
        })
        
        # Log GPS history
        self.env['mesob.gps.log'].create({
            'vehicle_id': self.id,
            'latitude': latitude,
            'longitude': longitude,
            'speed': speed,
            'heading': heading,
            'accuracy': accuracy,
            'timestamp': fields.Datetime.now()
        })

    def action_view_trips(self):
        """Action to view vehicle trips"""
        return {
            'type': 'ir.actions.act_window',
            'name': f'Trips for {self.name}',
            'res_model': 'mesob.trip.assignment',
            'view_mode': 'tree,form',
            'domain': [('vehicle_id', '=', self.id)],
            'context': {'default_vehicle_id': self.id}
        }

    def action_view_maintenance(self):
        """Action to view vehicle maintenance"""
        return {
            'type': 'ir.actions.act_window',
            'name': f'Maintenance for {self.name}',
            'res_model': 'mesob.maintenance.log',
            'view_mode': 'tree,form',
            'domain': [('vehicle_id', '=', self.id)],
            'context': {'default_vehicle_id': self.id}
        }

    def _cron_check_maintenance(self):
        """Cron job to check maintenance status"""
        for rec in self.search([]):
            if rec.maintenance_due:
                rec.availability = 'maintenance'
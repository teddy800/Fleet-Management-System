from odoo import models, fields, api
from datetime import timedelta
import logging

_logger = logging.getLogger(__name__)


class FleetVehicle(models.Model):
    _inherit = 'fleet.vehicle'

    mesob_status = fields.Selection([
        ('available', 'Available'),
        ('in_use', 'In Use'),
        ('maintenance', 'Under Maintenance'),
        ('unavailable', 'Unavailable')
    ], default='available', string="Fleet Status")

    maintenance_due = fields.Boolean(
        string="Maintenance Due", compute="_compute_maintenance_due", store=True, default=False
    )
    current_odometer = fields.Float(string="Current Odometer (KM)")

    # GPS tracking fields
    last_gps_update = fields.Datetime(string="Last GPS Update")
    current_latitude = fields.Float(string="Current Latitude", digits=(10, 6))
    current_longitude = fields.Float(string="Current Longitude", digits=(10, 6))
    current_speed = fields.Float(string="Current Speed (KM/H)")
    current_heading = fields.Float(string="Current Heading (Degrees)")
    gps_accuracy = fields.Float(string="GPS Accuracy (Meters)")

    # Analytics fields
    fuel_efficiency = fields.Float(
        string="Fuel Efficiency (KM/L)", compute="_compute_fuel_efficiency", store=True
    )
    total_trips = fields.Integer(
        string="Total Trips", compute="_compute_trip_stats", store=True
    )
    utilization_rate = fields.Float(
        string="Utilization Rate (%)", compute="_compute_utilization_rate", store=True
    )
    total_maintenance_cost = fields.Float(
        string="Total Maintenance Cost", compute="_compute_maintenance_cost", store=True
    )

    # Fleet management fields
    assigned_driver_id = fields.Many2one('hr.employee', string="Assigned Driver")
    mesob_vehicle_category = fields.Selection([
        ('sedan', 'Sedan'),
        ('suv', 'SUV'),
        ('pickup', 'Pickup Truck'),
        ('bus', 'Bus'),
        ('minibus', 'Mini-Bus'),
        ('motorcycle', 'Motorcycle'),
        ('truck', 'Truck')
    ], string="Vehicle Category")

    # Documentation
    insurance_expiry = fields.Date(string="Insurance Expiry Date")
    registration_expiry = fields.Date(string="Registration Expiry Date")

    # Analytics / KPI fields used by fleet_analytics.py
    maintenance_score = fields.Float(
        string="Maintenance Risk Score (%)",
        compute="_compute_maintenance_score",
        store=True,
        default=0.0,
    )
    current_value = fields.Float(
        string="Current Market Value (ETB)",
        default=0.0,
    )

    @api.depends('current_odometer')
    def _compute_maintenance_due(self):
        for vehicle in self:
            maintenance_due = False
            schedules = self.env['mesob.maintenance.schedule'].search([
                ('vehicle_id', '=', vehicle.id)
            ])
            for schedule in schedules:
                if schedule.interval_km and vehicle.current_odometer and schedule.last_odometer:
                    if vehicle.current_odometer >= (schedule.last_odometer + schedule.interval_km - 500):
                        maintenance_due = True
                        break
                if schedule.last_service_date and schedule.interval_days:
                    next_due = schedule.last_service_date + timedelta(days=schedule.interval_days - 30)
                    if fields.Date.today() >= next_due:
                        maintenance_due = True
                        break
            vehicle.maintenance_due = maintenance_due

    @api.depends('current_odometer')
    def _compute_fuel_efficiency(self):
        for vehicle in self:
            fuel_logs = self.env['mesob.fuel.log'].search(
                [('vehicle_id', '=', vehicle.id)], order='date asc'
            )
            if len(fuel_logs) >= 2:
                total_fuel = sum(fuel_logs.mapped('volume'))
                distance = fuel_logs[-1].odometer - fuel_logs[0].odometer
                vehicle.fuel_efficiency = distance / total_fuel if total_fuel > 0 else 0.0
            else:
                vehicle.fuel_efficiency = 0.0

    @api.depends('current_odometer')
    def _compute_trip_stats(self):
        for vehicle in self:
            count = self.env['mesob.trip.assignment'].search_count([
                ('vehicle_id', '=', vehicle.id),
                ('state', '=', 'confirmed')
            ])
            vehicle.total_trips = count

    @api.depends('current_odometer')
    def _compute_utilization_rate(self):
        for vehicle in self:
            assignments = self.env['mesob.trip.assignment'].search([
                ('vehicle_id', '=', vehicle.id),
                ('state', '=', 'confirmed'),
            ])
            thirty_days_ago = fields.Datetime.now() - timedelta(days=30)
            total_hours = 0.0
            for a in assignments:
                if a.trip_request_id and a.trip_request_id.start_datetime and a.trip_request_id.end_datetime:
                    if a.trip_request_id.start_datetime >= thirty_days_ago:
                        delta = a.trip_request_id.end_datetime - a.trip_request_id.start_datetime
                        total_hours += delta.total_seconds() / 3600
            vehicle.utilization_rate = (total_hours / (30 * 24)) * 100

    @api.depends('current_odometer')
    def _compute_maintenance_cost(self):
        for vehicle in self:
            logs = self.env['mesob.maintenance.log'].search([('vehicle_id', '=', vehicle.id)])
            vehicle.total_maintenance_cost = sum(logs.mapped('cost'))

    # Computed map URL for GPS tab
    gps_map_url = fields.Char(
        string="GPS Map URL", compute="_compute_gps_map_url"
    )

    @api.depends('current_latitude', 'current_longitude')
    def _compute_gps_map_url(self):
        for v in self:
            lat = v.current_latitude or 0.0
            lng = v.current_longitude or 0.0
            if lat and lng:
                v.gps_map_url = (
                    f"https://www.openstreetmap.org/export/embed.html"
                    f"?bbox={lng-0.01}%2C{lat-0.01}%2C{lng+0.01}%2C{lat+0.01}"
                    f"&layer=mapnik&marker={lat}%2C{lng}"
                )
            else:
                v.gps_map_url = ""

    def update_gps_location(self, latitude, longitude, speed=0, heading=0, accuracy=0):
        self.ensure_one()
        self.write({
            'current_latitude': latitude,
            'current_longitude': longitude,
            'current_speed': speed,
            'current_heading': heading,
            'gps_accuracy': accuracy,
            'last_gps_update': fields.Datetime.now()
        })
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
        return {
            'type': 'ir.actions.act_window',
            'name': f'Trips for {self.name}',
            'res_model': 'mesob.trip.assignment',
            'view_mode': 'tree,form',
            'domain': [('vehicle_id', '=', self.id)],
            'context': {'default_vehicle_id': self.id}
        }

    def action_view_maintenance(self):
        return {
            'type': 'ir.actions.act_window',
            'name': f'Maintenance for {self.name}',
            'res_model': 'mesob.maintenance.log',
            'view_mode': 'tree,form',
            'domain': [('vehicle_id', '=', self.id)],
            'context': {'default_vehicle_id': self.id}
        }

    def _cron_check_maintenance(self):
        for rec in self.search([]):
            if rec.maintenance_due:
                rec.mesob_status = 'maintenance'

    @api.depends('current_odometer', 'maintenance_due', 'last_gps_update', 'insurance_expiry', 'registration_expiry')
    def _compute_maintenance_score(self):
        """Compute a 0-100 risk score: higher = more urgent maintenance needed."""
        today = fields.Date.today()
        for vehicle in self:
            score = 0.0
            # +40 if maintenance is already due
            if vehicle.maintenance_due:
                score += 40.0
            # +20 if insurance expires within 30 days
            if vehicle.insurance_expiry:
                days_to_expiry = (vehicle.insurance_expiry - today).days
                if days_to_expiry <= 0:
                    score += 20.0
                elif days_to_expiry <= 30:
                    score += 10.0
            # +20 if registration expires within 30 days
            if vehicle.registration_expiry:
                days_to_expiry = (vehicle.registration_expiry - today).days
                if days_to_expiry <= 0:
                    score += 20.0
                elif days_to_expiry <= 30:
                    score += 10.0
            # +20 if GPS has not updated in more than 24 hours (vehicle may be stuck)
            if vehicle.last_gps_update:
                hours_since_update = (fields.Datetime.now() - vehicle.last_gps_update).total_seconds() / 3600
                if hours_since_update > 24:
                    score += 20.0
            vehicle.maintenance_score = min(score, 100.0)

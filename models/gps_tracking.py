from odoo import models, fields, api
from datetime import datetime, timedelta
import json
import logging
import requests

_logger = logging.getLogger(__name__)


class GPSLog(models.Model):
    _name = 'mesob.gps.log'
    _description = 'GPS Location Log'
    _order = 'timestamp desc'
    _rec_name = 'display_name'

    vehicle_id = fields.Many2one('fleet.vehicle', string="Vehicle", required=True, ondelete='cascade')
    latitude = fields.Float(string="Latitude", digits=(10, 6), required=True)
    longitude = fields.Float(string="Longitude", digits=(10, 6), required=True)
    timestamp = fields.Datetime(string="Timestamp", required=True, default=fields.Datetime.now)
    speed = fields.Float(string="Speed (KM/H)")
    heading = fields.Float(string="Heading (Degrees)")
    accuracy = fields.Float(string="GPS Accuracy (Meters)")
    altitude = fields.Float(string="Altitude (Meters)")
    
    # Additional tracking data
    engine_status = fields.Boolean(string="Engine On")
    fuel_level = fields.Float(string="Fuel Level (%)")
    odometer_reading = fields.Float(string="Odometer Reading")
    
    # Geofencing
    is_in_geofence = fields.Boolean(string="In Geofence", compute="_compute_geofence_status")
    geofence_violations = fields.Text(string="Geofence Violations")
    
    # Trip context
    trip_assignment_id = fields.Many2one('mesob.trip.assignment', string="Related Trip")
    
    # Computed fields
    display_name = fields.Char(string="Display Name", compute="_compute_display_name")
    location_address = fields.Char(string="Address", compute="_compute_address")
    distance_from_previous = fields.Float(string="Distance from Previous (KM)", compute="_compute_distance")

    @api.depends('vehicle_id', 'timestamp')
    def _compute_display_name(self):
        for log in self:
            if log.vehicle_id and log.timestamp:
                log.display_name = f"{log.vehicle_id.name} - {log.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"
            else:
                log.display_name = "GPS Log"

    @api.depends('latitude', 'longitude')
    def _compute_address(self):
        for log in self:
            if log.latitude and log.longitude:
                # This would integrate with reverse geocoding service
                # For now, using placeholder
                log.location_address = f"Lat: {log.latitude:.4f}, Lng: {log.longitude:.4f}"
            else:
                log.location_address = ""

    @api.depends('latitude', 'longitude', 'vehicle_id')
    def _compute_distance(self):
        for log in self:
            if log.latitude and log.longitude and log.vehicle_id:
                previous_log = self.search([
                    ('vehicle_id', '=', log.vehicle_id.id),
                    ('timestamp', '<', log.timestamp)
                ], order='timestamp desc', limit=1)
                
                if previous_log:
                    log.distance_from_previous = self._calculate_distance(
                        log.latitude, log.longitude,
                        previous_log.latitude, previous_log.longitude
                    )
                else:
                    log.distance_from_previous = 0
            else:
                log.distance_from_previous = 0

    def _compute_geofence_status(self):
        for log in self:
            # Check if location is within defined geofences
            geofences = self.env['mesob.geofence'].search([('active', '=', True)])
            log.is_in_geofence = any(
                geofence.contains_point(log.latitude, log.longitude)
                for geofence in geofences
            )

    def _calculate_distance(self, lat1, lon1, lat2, lon2):
        """Calculate distance between two GPS coordinates using Haversine formula"""
        import math
        
        # Convert to radians
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
        
        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        # Earth's radius in kilometers
        return 6371 * c

    @api.model
    def create_from_gps_data(self, gps_data):
        """Create GPS log from external GPS data"""
        try:
            vehicle = self.env['fleet.vehicle'].search([
                ('license_plate', '=', gps_data.get('vehicle_plate'))
            ], limit=1)
            
            if not vehicle:
                _logger.warning(f"Vehicle not found for plate: {gps_data.get('vehicle_plate')}")
                return False
            
            # Create GPS log
            gps_log = self.create({
                'vehicle_id': vehicle.id,
                'latitude': gps_data.get('latitude'),
                'longitude': gps_data.get('longitude'),
                'timestamp': gps_data.get('timestamp', fields.Datetime.now()),
                'speed': gps_data.get('speed', 0),
                'heading': gps_data.get('heading', 0),
                'accuracy': gps_data.get('accuracy', 0),
                'altitude': gps_data.get('altitude', 0),
                'engine_status': gps_data.get('engine_on', False),
                'fuel_level': gps_data.get('fuel_level', 0),
                'odometer_reading': gps_data.get('odometer', 0)
            })
            
            # Update vehicle's current location
            vehicle.update_gps_location(
                gps_data.get('latitude'),
                gps_data.get('longitude'),
                gps_data.get('speed', 0),
                gps_data.get('heading', 0),
                gps_data.get('accuracy', 0)
            )
            
            # Check for alerts
            self._check_gps_alerts(gps_log)
            
            return gps_log
            
        except Exception as e:
            _logger.error(f"Failed to create GPS log: {e}")
            return False

    def _check_gps_alerts(self, gps_log):
        """Check for GPS-based alerts"""
        vehicle = gps_log.vehicle_id
        
        # Speed limit alerts
        if gps_log.speed > 80:  # Configurable speed limit
            self._create_alert('speed_violation', vehicle, f"Speed limit exceeded: {gps_log.speed} KM/H")
        
        # Geofence violations
        if not gps_log.is_in_geofence:
            active_trip = self.env['mesob.trip.assignment'].search([
                ('vehicle_id', '=', vehicle.id),
                ('state', '=', 'in_progress')
            ], limit=1)
            
            if active_trip:
                self._create_alert('geofence_violation', vehicle, "Vehicle outside authorized area")
        
        # Engine idle alerts
        if gps_log.engine_status and gps_log.speed == 0:
            # Check if idling for more than 15 minutes
            idle_logs = self.search([
                ('vehicle_id', '=', vehicle.id),
                ('engine_status', '=', True),
                ('speed', '=', 0),
                ('timestamp', '>=', gps_log.timestamp - timedelta(minutes=15))
            ])
            
            if len(idle_logs) >= 3:  # 3 logs in 15 minutes = excessive idling
                self._create_alert('excessive_idling', vehicle, "Vehicle idling for extended period")

    def _create_alert(self, alert_type, vehicle, message):
        """Create system alert"""
        self.env['mesob.fleet.alert'].create({
            'alert_type': alert_type,
            'vehicle_id': vehicle.id,
            'message': message,
            'severity': 'medium',
            'timestamp': fields.Datetime.now()
        })

    @api.model
    def get_vehicle_route(self, vehicle_id, start_date, end_date):
        """Get vehicle route for a specific time period"""
        logs = self.search([
            ('vehicle_id', '=', vehicle_id),
            ('timestamp', '>=', start_date),
            ('timestamp', '<=', end_date)
        ], order='timestamp asc')
        
        route_data = []
        for log in logs:
            route_data.append({
                'latitude': log.latitude,
                'longitude': log.longitude,
                'timestamp': log.timestamp.isoformat(),
                'speed': log.speed,
                'heading': log.heading
            })
        
        return route_data

    @api.model
    def get_realtime_locations(self):
        """Get real-time locations of all vehicles"""
        vehicles = self.env['fleet.vehicle'].search([('active', '=', True)])
        locations = []
        
        for vehicle in vehicles:
            latest_log = self.search([
                ('vehicle_id', '=', vehicle.id)
            ], order='timestamp desc', limit=1)
            
            if latest_log:
                locations.append({
                    'vehicle_id': vehicle.id,
                    'vehicle_name': vehicle.name,
                    'license_plate': vehicle.license_plate,
                    'latitude': latest_log.latitude,
                    'longitude': latest_log.longitude,
                    'speed': latest_log.speed,
                    'heading': latest_log.heading,
                    'last_update': latest_log.timestamp.isoformat(),
                    'status': vehicle.availability
                })
        
        return locations


class Geofence(models.Model):
    _name = 'mesob.geofence'
    _description = 'Geofence Definition'
    _rec_name = 'name'

    name = fields.Char(string="Geofence Name", required=True)
    description = fields.Text(string="Description")
    active = fields.Boolean(string="Active", default=True)
    
    # Geofence type
    fence_type = fields.Selection([
        ('circular', 'Circular'),
        ('polygon', 'Polygon'),
        ('rectangular', 'Rectangular')
    ], string="Fence Type", required=True, default='circular')
    
    # Circular geofence
    center_latitude = fields.Float(string="Center Latitude", digits=(10, 6))
    center_longitude = fields.Float(string="Center Longitude", digits=(10, 6))
    radius = fields.Float(string="Radius (Meters)")
    
    # Polygon geofence
    polygon_coordinates = fields.Text(string="Polygon Coordinates (JSON)")
    
    # Rectangular geofence
    north_latitude = fields.Float(string="North Latitude", digits=(10, 6))
    south_latitude = fields.Float(string="South Latitude", digits=(10, 6))
    east_longitude = fields.Float(string="East Longitude", digits=(10, 6))
    west_longitude = fields.Float(string="West Longitude", digits=(10, 6))
    
    # Geofence rules
    entry_alert = fields.Boolean(string="Alert on Entry", default=False)
    exit_alert = fields.Boolean(string="Alert on Exit", default=True)
    allowed_vehicles = fields.Many2many('fleet.vehicle', string="Allowed Vehicles")
    
    def contains_point(self, latitude, longitude):
        """Check if a point is within this geofence"""
        if self.fence_type == 'circular':
            return self._point_in_circle(latitude, longitude)
        elif self.fence_type == 'rectangular':
            return self._point_in_rectangle(latitude, longitude)
        elif self.fence_type == 'polygon':
            return self._point_in_polygon(latitude, longitude)
        
        return False

    def _point_in_circle(self, latitude, longitude):
        """Check if point is within circular geofence"""
        if not (self.center_latitude and self.center_longitude and self.radius):
            return False
        
        # Calculate distance from center
        distance = self._calculate_distance(
            latitude, longitude,
            self.center_latitude, self.center_longitude
        )
        
        return distance <= (self.radius / 1000)  # Convert meters to kilometers

    def _point_in_rectangle(self, latitude, longitude):
        """Check if point is within rectangular geofence"""
        return (
            self.south_latitude <= latitude <= self.north_latitude and
            self.west_longitude <= longitude <= self.east_longitude
        )

    def _point_in_polygon(self, latitude, longitude):
        """Check if point is within polygon geofence"""
        if not self.polygon_coordinates:
            return False
        
        try:
            coordinates = json.loads(self.polygon_coordinates)
            # Implement ray casting algorithm for point-in-polygon test
            # This is a simplified version
            return self._ray_casting_algorithm(latitude, longitude, coordinates)
        except:
            return False

    def _calculate_distance(self, lat1, lon1, lat2, lon2):
        """Calculate distance between two points"""
        import math
        
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        return 6371 * c

    def _ray_casting_algorithm(self, lat, lon, polygon):
        """Ray casting algorithm for point-in-polygon test"""
        n = len(polygon)
        inside = False
        
        p1x, p1y = polygon[0]
        for i in range(1, n + 1):
            p2x, p2y = polygon[i % n]
            if lat > min(p1y, p2y):
                if lat <= max(p1y, p2y):
                    if lon <= max(p1x, p2x):
                        if p1y != p2y:
                            xinters = (lat - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or lon <= xinters:
                            inside = not inside
            p1x, p1y = p2x, p2y
        
        return inside


class FleetAlert(models.Model):
    _name = 'mesob.fleet.alert'
    _description = 'Fleet Management Alert'
    _order = 'timestamp desc'
    _rec_name = 'display_name'

    alert_type = fields.Selection([
        ('speed_violation', 'Speed Violation'),
        ('geofence_violation', 'Geofence Violation'),
        ('excessive_idling', 'Excessive Idling'),
        ('maintenance_due', 'Maintenance Due'),
        ('fuel_low', 'Low Fuel'),
        ('unauthorized_use', 'Unauthorized Use'),
        ('accident', 'Accident/Emergency'),
        ('system_error', 'System Error')
    ], string="Alert Type", required=True)
    
    vehicle_id = fields.Many2one('fleet.vehicle', string="Vehicle")
    driver_id = fields.Many2one('hr.employee', string="Driver")
    message = fields.Text(string="Alert Message", required=True)
    
    severity = fields.Selection([
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical')
    ], string="Severity", required=True, default='medium')
    
    timestamp = fields.Datetime(string="Alert Time", required=True, default=fields.Datetime.now)
    acknowledged = fields.Boolean(string="Acknowledged", default=False)
    acknowledged_by = fields.Many2one('res.users', string="Acknowledged By")
    acknowledged_date = fields.Datetime(string="Acknowledgment Date")
    
    resolution_notes = fields.Text(string="Resolution Notes")
    resolved = fields.Boolean(string="Resolved", default=False)
    resolved_by = fields.Many2one('res.users', string="Resolved By")
    resolved_date = fields.Datetime(string="Resolution Date")
    
    display_name = fields.Char(string="Display Name", compute="_compute_display_name")

    @api.depends('alert_type', 'vehicle_id', 'timestamp')
    def _compute_display_name(self):
        for alert in self:
            vehicle_name = alert.vehicle_id.name if alert.vehicle_id else "System"
            alert.display_name = f"{alert.alert_type.replace('_', ' ').title()} - {vehicle_name}"

    def action_acknowledge(self):
        """Acknowledge the alert"""
        self.write({
            'acknowledged': True,
            'acknowledged_by': self.env.user.id,
            'acknowledged_date': fields.Datetime.now()
        })

    def action_resolve(self):
        """Mark alert as resolved"""
        return {
            'type': 'ir.actions.act_window',
            'name': 'Resolve Alert',
            'res_model': 'mesob.alert.resolution.wizard',
            'view_mode': 'form',
            'target': 'new',
            'context': {'default_alert_id': self.id}
        }
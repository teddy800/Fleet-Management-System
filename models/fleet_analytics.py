from odoo import models, fields, api
from datetime import datetime, timedelta
import json
import logging
from collections import defaultdict

_logger = logging.getLogger(__name__)


class FleetAnalytics(models.AbstractModel):
    _name = 'mesob.fleet.analytics'
    _description = 'Fleet Analytics and KPIs'

    @api.model
    def get_comprehensive_dashboard(self):
        """Get comprehensive fleet dashboard data"""
        return {
            'fleet_overview': self._get_fleet_overview(),
            'utilization_metrics': self._get_utilization_metrics(),
            'cost_analysis': self._get_cost_analysis(),
            'maintenance_insights': self._get_maintenance_insights(),
            'fuel_analytics': self._get_fuel_analytics(),
            'driver_performance': self._get_driver_performance(),
            'trip_statistics': self._get_trip_statistics(),
            'predictive_insights': self._get_predictive_insights(),
            'alerts_summary': self._get_alerts_summary(),
            'kpis': self._get_key_performance_indicators()
        }

    def _get_fleet_overview(self):
        """Get fleet overview statistics"""
        Vehicle = self.env['fleet.vehicle']
        
        total_vehicles = Vehicle.search_count([])
        available_vehicles = Vehicle.search_count([('mesob_status', '=', 'available')])
        in_use_vehicles = Vehicle.search_count([('mesob_status', '=', 'in_use')])
        maintenance_vehicles = Vehicle.search_count([('mesob_status', '=', 'maintenance')])
        
        # Vehicle categories breakdown
        categories = Vehicle.read_group(
            [], ['mesob_vehicle_category'], ['mesob_vehicle_category']
        )
        
        # Age distribution
        current_date = fields.Date.today()
        age_groups = {
            'new': Vehicle.search_count([('acquisition_date', '>=', current_date - timedelta(days=365))]),
            'medium': Vehicle.search_count([
                ('acquisition_date', '>=', current_date - timedelta(days=1825)),
                ('acquisition_date', '<', current_date - timedelta(days=365))
            ]),
            'old': Vehicle.search_count([('acquisition_date', '<', current_date - timedelta(days=1825))])
        }
        
        return {
            'total_vehicles': total_vehicles,
            'available_vehicles': available_vehicles,
            'in_use_vehicles': in_use_vehicles,
            'maintenance_vehicles': maintenance_vehicles,
            'availability_rate': (available_vehicles / total_vehicles * 100) if total_vehicles > 0 else 0,
            'categories': categories,
            'age_distribution': age_groups
        }

    def _get_utilization_metrics(self):
        """Get vehicle utilization metrics"""
        Vehicle = self.env['fleet.vehicle']
        TripAssignment = self.env['mesob.trip.assignment']
        
        # Calculate utilization for last 30 days
        thirty_days_ago = fields.Date.today() - timedelta(days=30)
        
        vehicles = Vehicle.search([])
        utilization_data = []
        
        total_utilization = 0
        for vehicle in vehicles:
            assignments = TripAssignment.search([
                ('vehicle_id', '=', vehicle.id),
                ('start_datetime', '>=', thirty_days_ago),
                ('state', 'in', ['completed', 'in_progress'])
            ])
            
            if assignments:
                total_hours_used = sum(
                    (assignment.end_datetime - assignment.start_datetime).total_seconds() / 3600
                    for assignment in assignments
                    if assignment.end_datetime
                )
                total_available_hours = 30 * 24  # 30 days * 24 hours
                utilization_rate = (total_hours_used / total_available_hours) * 100
            else:
                utilization_rate = 0
            
            utilization_data.append({
                'vehicle_id': vehicle.id,
                'vehicle_name': vehicle.name,
                'utilization_rate': utilization_rate,
                'total_trips': len(assignments)
            })
            
            total_utilization += utilization_rate
        
        average_utilization = total_utilization / len(vehicles) if vehicles else 0
        
        # Top and bottom performers
        utilization_data.sort(key=lambda x: x['utilization_rate'], reverse=True)
        
        return {
            'average_utilization': average_utilization,
            'vehicle_utilization': utilization_data,
            'top_performers': utilization_data[:5],
            'underutilized': [v for v in utilization_data if v['utilization_rate'] < 30]
        }

    def _get_cost_analysis(self):
        """Get comprehensive cost analysis"""
        Vehicle = self.env['fleet.vehicle']
        MaintenanceLog = self.env['mesob.maintenance.log']
        FuelLog = self.env['mesob.fuel.log']
        
        # Time periods
        current_month = fields.Date.today().replace(day=1)
        last_month = (current_month - timedelta(days=1)).replace(day=1)
        current_year = fields.Date.today().replace(month=1, day=1)
        
        # Maintenance costs
        maintenance_current_month = sum(MaintenanceLog.search([
            ('date', '>=', current_month)
        ]).mapped('cost'))
        
        maintenance_last_month = sum(MaintenanceLog.search([
            ('date', '>=', last_month),
            ('date', '<', current_month)
        ]).mapped('cost'))
        
        maintenance_current_year = sum(MaintenanceLog.search([
            ('date', '>=', current_year)
        ]).mapped('cost'))
        
        # Fuel costs
        fuel_current_month = sum(FuelLog.search([
            ('date', '>=', current_month)
        ]).mapped('cost'))
        
        fuel_last_month = sum(FuelLog.search([
            ('date', '>=', last_month),
            ('date', '<', current_month)
        ]).mapped('cost'))
        
        fuel_current_year = sum(FuelLog.search([
            ('date', '>=', current_year)
        ]).mapped('cost'))
        
        # Cost per vehicle
        vehicles = Vehicle.search([])
        cost_per_vehicle = []
        
        for vehicle in vehicles:
            vehicle_maintenance = sum(MaintenanceLog.search([
                ('vehicle_id', '=', vehicle.id),
                ('date', '>=', current_year)
            ]).mapped('cost'))
            
            vehicle_fuel = sum(FuelLog.search([
                ('vehicle_id', '=', vehicle.id),
                ('date', '>=', current_year)
            ]).mapped('cost'))
            
            total_cost = vehicle_maintenance + vehicle_fuel
            
            cost_per_vehicle.append({
                'vehicle_id': vehicle.id,
                'vehicle_name': vehicle.name,
                'maintenance_cost': vehicle_maintenance,
                'fuel_cost': vehicle_fuel,
                'total_cost': total_cost,
                'cost_per_km': total_cost / vehicle.current_odometer if vehicle.current_odometer > 0 else 0
            })
        
        return {
            'maintenance_costs': {
                'current_month': maintenance_current_month,
                'last_month': maintenance_last_month,
                'current_year': maintenance_current_year,
                'month_over_month_change': ((maintenance_current_month - maintenance_last_month) / maintenance_last_month * 100) if maintenance_last_month > 0 else 0
            },
            'fuel_costs': {
                'current_month': fuel_current_month,
                'last_month': fuel_last_month,
                'current_year': fuel_current_year,
                'month_over_month_change': ((fuel_current_month - fuel_last_month) / fuel_last_month * 100) if fuel_last_month > 0 else 0
            },
            'cost_per_vehicle': sorted(cost_per_vehicle, key=lambda x: x['total_cost'], reverse=True),
            'total_fleet_cost': maintenance_current_year + fuel_current_year
        }

    def _get_maintenance_insights(self):
        """Get maintenance insights and predictions"""
        Vehicle = self.env['fleet.vehicle']
        MaintenanceLog = self.env['mesob.maintenance.log']
        
        # Vehicles due for maintenance
        vehicles_due = Vehicle.search([('maintenance_due', '=', True)])
        
        # Maintenance frequency analysis
        maintenance_frequency = MaintenanceLog.read_group(
            [('date', '>=', fields.Date.today() - timedelta(days=365))],
            ['vehicle_id', 'cost:sum'],
            ['vehicle_id']
        )
        
        # Predictive maintenance
        high_risk_vehicles = Vehicle.search([('maintenance_score', '>', 70)])
        
        # Maintenance cost trends
        monthly_costs = []
        for i in range(12):
            month_start = (fields.Date.today().replace(day=1) - timedelta(days=30*i))
            month_end = month_start.replace(day=28) + timedelta(days=4)
            month_end = month_end - timedelta(days=month_end.day)
            
            cost = sum(MaintenanceLog.search([
                ('date', '>=', month_start),
                ('date', '<=', month_end)
            ]).mapped('cost'))
            
            monthly_costs.append({
                'month': month_start.strftime('%Y-%m'),
                'cost': cost
            })
        
        return {
            'vehicles_due_maintenance': len(vehicles_due),
            'high_risk_vehicles': len(high_risk_vehicles),
            'maintenance_frequency': maintenance_frequency,
            'monthly_cost_trend': list(reversed(monthly_costs)),
            'average_maintenance_cost': sum(log.cost for log in MaintenanceLog.search([('date', '>=', fields.Date.today() - timedelta(days=365))])) / len(Vehicle.search([])) if Vehicle.search([]) else 0
        }

    def _get_fuel_analytics(self):
        """Get fuel consumption analytics"""
        Vehicle = self.env['fleet.vehicle']
        FuelLog = self.env['mesob.fuel.log']
        
        # Fleet-wide fuel efficiency
        vehicles = Vehicle.search([('fuel_efficiency', '>', 0)])
        average_efficiency = sum(vehicles.mapped('fuel_efficiency')) / len(vehicles) if vehicles else 0
        
        # Fuel consumption trends
        monthly_consumption = []
        for i in range(12):
            month_start = (fields.Date.today().replace(day=1) - timedelta(days=30*i))
            month_end = month_start.replace(day=28) + timedelta(days=4)
            month_end = month_end - timedelta(days=month_end.day)
            
            consumption = sum(FuelLog.search([
                ('date', '>=', month_start),
                ('date', '<=', month_end)
            ]).mapped('volume'))
            
            monthly_consumption.append({
                'month': month_start.strftime('%Y-%m'),
                'consumption': consumption
            })
        
        # Top fuel consumers
        fuel_consumers = []
        for vehicle in Vehicle.search([]):
            total_fuel = sum(FuelLog.search([
                ('vehicle_id', '=', vehicle.id),
                ('date', '>=', fields.Date.today() - timedelta(days=365))
            ]).mapped('volume'))
            
            fuel_consumers.append({
                'vehicle_id': vehicle.id,
                'vehicle_name': vehicle.name,
                'total_fuel': total_fuel,
                'efficiency': vehicle.fuel_efficiency
            })
        
        fuel_consumers.sort(key=lambda x: x['total_fuel'], reverse=True)
        
        return {
            'average_efficiency': average_efficiency,
            'monthly_consumption': list(reversed(monthly_consumption)),
            'top_consumers': fuel_consumers[:10],
            'most_efficient': sorted(fuel_consumers, key=lambda x: x['efficiency'], reverse=True)[:10]
        }

    def _get_driver_performance(self):
        """Get driver performance metrics"""
        Employee = self.env['hr.employee']
        TripAssignment = self.env['mesob.trip.assignment']

        drivers = Employee.search([('is_driver', '=', True)])
        driver_stats = []

        for driver in drivers:
            assignments = TripAssignment.search([
                ('driver_id', '=', driver.id),
                ('state', '=', 'completed'),
                ('start_datetime', '>=', fields.Date.today() - timedelta(days=30))
            ])

            if assignments:
                total_distance = sum(assignments.mapped('actual_distance'))
                total_trips = len(assignments)
                ratings = [int(a.trip_request_id.trip_rating) for a in assignments
                           if a.trip_request_id and a.trip_request_id.trip_rating]
                average_rating = sum(ratings) / len(ratings) if ratings else 0

                # Calculate on-time performance safely (actual_start_datetime may be None)
                on_time_trips = 0
                for a in assignments:
                    try:
                        if a.actual_start_datetime and a.start_datetime:
                            if a.actual_start_datetime <= a.start_datetime + timedelta(minutes=15):
                                on_time_trips += 1
                        else:
                            on_time_trips += 1  # no data = assume on-time
                    except Exception:
                        pass
                on_time_percentage = (on_time_trips / total_trips * 100) if total_trips > 0 else 0

                driver_stats.append({
                    'driver_id': driver.id,
                    'driver_name': driver.name,
                    'total_trips': total_trips,
                    'total_distance': total_distance,
                    'average_rating': average_rating,
                    'on_time_percentage': on_time_percentage
                })

        # Sort by performance score (combination of rating and on-time percentage)
        for stat in driver_stats:
            stat['performance_score'] = (stat['average_rating'] * 0.6 + stat['on_time_percentage'] * 0.4)

        driver_stats.sort(key=lambda x: x['performance_score'], reverse=True)

        return {
            'driver_statistics': driver_stats,
            'top_performers': driver_stats[:5],
            'total_drivers': len(drivers),
            'active_drivers': len([d for d in driver_stats if d['total_trips'] > 0])
        }

    def _get_trip_statistics(self):
        """Get trip statistics and trends"""
        TripRequest = self.env['mesob.trip.request']
        TripAssignment = self.env['mesob.trip.assignment']

        # Current month statistics
        current_month = fields.Date.today().replace(day=1)

        total_requests = TripRequest.search_count([('create_date', '>=', current_month)])
        approved_requests = TripRequest.search_count([
            ('state', '=', 'approved'),
            ('approved_date', '>=', current_month)
        ])

        # Use state-based count instead of actual_end_datetime to avoid missing-column errors
        completed_trips = TripAssignment.search_count([
            ('state', '=', 'completed'),
            ('start_datetime', '>=', current_month),
        ])

        # Request approval rate
        approval_rate = (approved_requests / total_requests * 100) if total_requests > 0 else 0

        # Average processing time
        approved_requests_with_dates = TripRequest.search([
            ('state', '=', 'approved'),
            ('approved_date', '>=', current_month)
        ])

        if approved_requests_with_dates:
            total_processing_time = sum(
                (request.approved_date - request.create_date).total_seconds() / 3600
                for request in approved_requests_with_dates
            )
            average_processing_time = total_processing_time / len(approved_requests_with_dates)
        else:
            average_processing_time = 0

        # Trip purpose analysis
        purpose_analysis = TripRequest.read_group(
            [('create_date', '>=', current_month)],
            ['trip_type'],
            ['trip_type']
        )

        return {
            'total_requests': total_requests,
            'approved_requests': approved_requests,
            'completed_trips': completed_trips,
            'approval_rate': approval_rate,
            'average_processing_time': average_processing_time,
            'purpose_analysis': purpose_analysis
        }

    def _get_predictive_insights(self):
        """Get predictive insights using simple algorithms"""
        Vehicle = self.env['fleet.vehicle']
        
        # Maintenance predictions
        maintenance_predictions = []
        vehicles = Vehicle.search([])
        
        for vehicle in vehicles:
            risk_score = vehicle.maintenance_score
            
            if risk_score > 80:
                predicted_date = fields.Date.today() + timedelta(days=7)
                urgency = 'high'
            elif risk_score > 60:
                predicted_date = fields.Date.today() + timedelta(days=30)
                urgency = 'medium'
            elif risk_score > 40:
                predicted_date = fields.Date.today() + timedelta(days=60)
                urgency = 'low'
            else:
                continue
            
            maintenance_predictions.append({
                'vehicle_id': vehicle.id,
                'vehicle_name': vehicle.name,
                'predicted_maintenance_date': predicted_date.isoformat(),
                'risk_score': risk_score,
                'urgency': urgency,
                'recommended_actions': self._get_maintenance_recommendations(vehicle)
            })
        
        # Fuel consumption forecast
        fuel_forecast = self._forecast_fuel_consumption()
        
        # Cost optimization suggestions
        cost_optimizations = self._get_cost_optimization_suggestions()
        
        return {
            'maintenance_predictions': maintenance_predictions,
            'fuel_forecast': fuel_forecast,
            'cost_optimizations': cost_optimizations
        }

    def _get_maintenance_recommendations(self, vehicle):
        """Get maintenance recommendations for a vehicle"""
        recommendations = []
        
        if vehicle.current_odometer and vehicle.current_odometer % 5000 < 500:
            recommendations.append('Oil change due soon')
        
        if vehicle.current_odometer and vehicle.current_odometer % 10000 < 500:
            recommendations.append('Tire rotation recommended')
        
        if vehicle.insurance_expiry and vehicle.insurance_expiry <= fields.Date.today() + timedelta(days=30):
            recommendations.append('Insurance renewal required')
        
        return recommendations

    def _forecast_fuel_consumption(self):
        """Forecast fuel consumption for next month"""
        FuelLog = self.env['mesob.fuel.log']
        
        # Get last 3 months of data
        three_months_ago = fields.Date.today() - timedelta(days=90)
        recent_logs = FuelLog.search([('date', '>=', three_months_ago)])
        
        if len(recent_logs) < 10:  # Not enough data
            return {'forecast': 0, 'confidence': 'low'}
        
        # Simple linear trend calculation
        monthly_consumption = defaultdict(float)
        for log in recent_logs:
            month_key = log.date.strftime('%Y-%m')
            monthly_consumption[month_key] += log.volume
        
        if len(monthly_consumption) >= 2:
            consumption_values = list(monthly_consumption.values())
            # Simple average of recent months
            forecast = sum(consumption_values) / len(consumption_values)
            confidence = 'medium' if len(consumption_values) >= 3 else 'low'
        else:
            forecast = 0
            confidence = 'low'
        
        return {
            'forecast': forecast,
            'confidence': confidence,
            'historical_data': dict(monthly_consumption)
        }

    def _get_cost_optimization_suggestions(self):
        """Get cost optimization suggestions"""
        suggestions = []
        
        # Underutilized vehicles
        Vehicle = self.env['fleet.vehicle']
        underutilized = Vehicle.search([('utilization_rate', '<', 30)])
        
        if underutilized:
            suggestions.append({
                'type': 'utilization',
                'title': 'Underutilized Vehicles',
                'description': f'{len(underutilized)} vehicles have utilization below 30%',
                'action': 'Consider reassigning or reducing fleet size',
                'potential_savings': len(underutilized) * 1000  # Estimated monthly savings
            })
        
        # High maintenance cost vehicles
        high_maintenance = Vehicle.search([('maintenance_score', '>', 80)])
        
        if high_maintenance:
            suggestions.append({
                'type': 'maintenance',
                'title': 'High Maintenance Vehicles',
                'description': f'{len(high_maintenance)} vehicles have high maintenance risk',
                'action': 'Consider replacement or intensive maintenance',
                'potential_savings': len(high_maintenance) * 500
            })
        
        return suggestions

    def _get_alerts_summary(self):
        """Get summary of active alerts"""
        total_alerts = 0
        critical_alerts = 0
        unacknowledged = 0
        alert_types = []

        try:
            Alert = self.env['mesob.fleet.alert']
            total_alerts = Alert.search_count([('resolved', '=', False)])
            critical_alerts = Alert.search_count([
                ('resolved', '=', False),
                ('severity', '=', 'critical')
            ])
            unacknowledged = Alert.search_count([
                ('resolved', '=', False),
                ('acknowledged', '=', False)
            ])
            alert_types = Alert.read_group(
                [('resolved', '=', False)],
                ['alert_type'],
                ['alert_type']
            )
        except Exception:
            # mesob.fleet.alert model not installed — use maintenance overdue count
            try:
                total_alerts = self.env['mesob.maintenance.schedule'].search_count([('is_overdue', '=', True)])
                unacknowledged = total_alerts
            except Exception:
                pass

        return {
            'total_alerts': total_alerts,
            'critical_alerts': critical_alerts,
            'unacknowledged_alerts': unacknowledged,
            'alert_types': alert_types
        }

    def _get_key_performance_indicators(self):
        """Calculate key performance indicators"""
        Vehicle = self.env['fleet.vehicle']
        TripRequest = self.env['mesob.trip.request']
        
        # Fleet availability
        total_vehicles = Vehicle.search_count([])
        available_vehicles = Vehicle.search_count([('mesob_status', '=', 'available')])
        fleet_availability = (available_vehicles / total_vehicles * 100) if total_vehicles > 0 else 0
        
        # Request fulfillment rate
        total_requests = TripRequest.search_count([
            ('create_date', '>=', fields.Date.today() - timedelta(days=30))
        ])
        fulfilled_requests = TripRequest.search_count([
            ('create_date', '>=', fields.Date.today() - timedelta(days=30)),
            ('state', 'in', ['completed', 'in_progress'])
        ])
        fulfillment_rate = (fulfilled_requests / total_requests * 100) if total_requests > 0 else 0
        
        # Average utilization
        vehicles = Vehicle.search([])
        avg_utilization = sum(vehicles.mapped('utilization_rate')) / len(vehicles) if vehicles else 0
        
        # Cost per kilometer
        MaintenanceLog = self.env['mesob.maintenance.log']
        FuelLog = self.env['mesob.fuel.log']
        
        total_costs = sum(MaintenanceLog.search([
            ('date', '>=', fields.Date.today() - timedelta(days=365))
        ]).mapped('cost')) + sum(FuelLog.search([
            ('date', '>=', fields.Date.today() - timedelta(days=365))
        ]).mapped('cost'))
        
        total_distance = sum(vehicles.mapped('current_odometer'))
        cost_per_km = total_costs / total_distance if total_distance > 0 else 0
        
        return {
            'fleet_availability': fleet_availability,
            'request_fulfillment_rate': fulfillment_rate,
            'average_utilization': avg_utilization,
            'cost_per_kilometer': cost_per_km,
            'total_fleet_value': sum(vehicles.mapped('current_value')),
            'maintenance_compliance': self._calculate_maintenance_compliance()
        }

    def _calculate_maintenance_compliance(self):
        """Calculate maintenance compliance percentage"""
        Vehicle = self.env['fleet.vehicle']
        
        total_vehicles = Vehicle.search_count([])
        compliant_vehicles = Vehicle.search_count([('maintenance_due', '=', False)])
        
        return (compliant_vehicles / total_vehicles * 100) if total_vehicles > 0 else 0
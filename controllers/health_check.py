from odoo import http
from odoo.http import request
import json
import logging
from datetime import datetime, timedelta
import psutil
import os

_logger = logging.getLogger(__name__)


class HealthCheckController(http.Controller):
    """Production health check and monitoring endpoints"""

    @http.route('/health', type='http', auth='none', methods=['GET'], csrf=False)
    def health_check(self):
        """Basic health check endpoint for load balancers"""
        try:
            # Test database connection
            request.env.cr.execute("SELECT 1")
            
            return request.make_response(
                json.dumps({
                    'status': 'healthy',
                    'timestamp': datetime.now().isoformat(),
                    'version': '1.3.0'
                }),
                headers=[('Content-Type', 'application/json')]
            )
        except Exception as e:
            _logger.error(f"Health check failed: {e}")
            return request.make_response(
                json.dumps({
                    'status': 'unhealthy',
                    'error': str(e),
                    'timestamp': datetime.now().isoformat()
                }),
                status=503,
                headers=[('Content-Type', 'application/json')]
            )

    @http.route('/health/detailed', type='json', auth='user', methods=['GET'], csrf=False)
    def detailed_health_check(self):
        """Detailed health check for monitoring systems"""
        try:
            # Check if user has admin rights
            if not request.env.user.has_group('base.group_system'):
                return {'error': 'Insufficient permissions'}

            health_data = {
                'status': 'healthy',
                'timestamp': datetime.now().isoformat(),
                'checks': {}
            }

            # Database check
            try:
                request.env.cr.execute("SELECT COUNT(*) FROM res_users")
                user_count = request.env.cr.fetchone()[0]
                health_data['checks']['database'] = {
                    'status': 'healthy',
                    'user_count': user_count
                }
            except Exception as e:
                health_data['checks']['database'] = {
                    'status': 'unhealthy',
                    'error': str(e)
                }
                health_data['status'] = 'degraded'

            # System resources
            try:
                memory = psutil.virtual_memory()
                disk = psutil.disk_usage('/')
                cpu_percent = psutil.cpu_percent(interval=1)
                
                health_data['checks']['system'] = {
                    'status': 'healthy',
                    'memory_percent': memory.percent,
                    'disk_percent': (disk.used / disk.total) * 100,
                    'cpu_percent': cpu_percent
                }
                
                # Alert if resources are high
                if memory.percent > 90 or cpu_percent > 90:
                    health_data['checks']['system']['status'] = 'warning'
                    health_data['status'] = 'degraded'
                    
            except Exception as e:
                health_data['checks']['system'] = {
                    'status': 'unknown',
                    'error': str(e)
                }

            # Fleet-specific checks
            try:
                # Check recent GPS updates
                gps_logs = request.env['mesob.gps.log'].search([
                    ('timestamp', '>=', datetime.now() - timedelta(minutes=10))
                ])
                
                # Check active trips
                active_trips = request.env['mesob.trip.assignment'].search([
                    ('state', 'in', ['assigned', 'in_progress'])
                ])
                
                health_data['checks']['fleet'] = {
                    'status': 'healthy',
                    'recent_gps_updates': len(gps_logs),
                    'active_trips': len(active_trips)
                }
                
            except Exception as e:
                health_data['checks']['fleet'] = {
                    'status': 'unhealthy',
                    'error': str(e)
                }
                health_data['status'] = 'degraded'

            return health_data

        except Exception as e:
            _logger.error(f"Detailed health check failed: {e}")
            return {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }

    @http.route('/metrics', type='http', auth='none', methods=['GET'], csrf=False)
    def prometheus_metrics(self):
        """Prometheus metrics endpoint"""
        try:
            metrics = []
            
            # System metrics
            memory = psutil.virtual_memory()
            cpu_percent = psutil.cpu_percent()
            
            metrics.extend([
                f'# HELP messob_memory_usage_percent Memory usage percentage',
                f'# TYPE messob_memory_usage_percent gauge',
                f'messob_memory_usage_percent {memory.percent}',
                f'',
                f'# HELP messob_cpu_usage_percent CPU usage percentage',
                f'# TYPE messob_cpu_usage_percent gauge',
                f'messob_cpu_usage_percent {cpu_percent}',
                f''
            ])
            
            # Fleet metrics
            try:
                # Active vehicles
                active_vehicles = request.env['fleet.vehicle'].search_count([
                    ('mesob_status', '=', 'in_use')
                ])
                
                # Pending requests
                pending_requests = request.env['mesob.trip.request'].search_count([
                    ('state', '=', 'pending')
                ])
                
                metrics.extend([
                    f'# HELP messob_active_vehicles Number of vehicles currently in use',
                    f'# TYPE messob_active_vehicles gauge',
                    f'messob_active_vehicles {active_vehicles}',
                    f'',
                    f'# HELP messob_pending_requests Number of pending trip requests',
                    f'# TYPE messob_pending_requests gauge',
                    f'messob_pending_requests {pending_requests}',
                    f''
                ])
                
            except Exception as e:
                _logger.error(f"Fleet metrics error: {e}")
            
            return request.make_response(
                '\n'.join(metrics),
                headers=[('Content-Type', 'text/plain; version=0.0.4')]
            )
            
        except Exception as e:
            _logger.error(f"Metrics endpoint failed: {e}")
            return request.make_response(
                f'# Error generating metrics: {e}',
                status=500,
                headers=[('Content-Type', 'text/plain')]
            )
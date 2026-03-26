{
    'name': 'Mesob Fleet Management',
    'version': '1.0',
    'summary': 'Advanced Fleet Management System',
    'author': 'Mesob',
    'category': 'Fleet',
    'depends': ['base', 'fleet', 'hr', 'stock', 'mail'],
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',

        'data/cron.xml',

        'views/fleet_vehicle_views.xml',
        'views/service_record_views.xml',
        'views/fuel_log_views.xml',
        'views/odometer_log_views.xml',
        'views/trip_request_views.xml',
        'views/trip_assignment_views.xml',
        'views/dashboard_views.xml',
        'views/menu.xml',
    ],
    'installable': True,
    'application': True,
}
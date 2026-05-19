{
    'name': '🚗 MESSOB Fleet Management System',
    'version': '19.0.2.0',
    'summary': 'Comprehensive Fleet Management Solution for MESOB - Vehicle Tracking, Trip Management, Maintenance & Analytics',
    'description': '''
        MESSOB Fleet Management System
        =============================
        
        A comprehensive fleet management solution featuring:
        
        🚗 **Fleet Management**
        • Vehicle registration and tracking
        • Driver management and assignments
        • Vehicle categories and specifications
        
        📋 **Trip Management**
        • Trip request workflow
        • Approval queue for dispatchers
        • Fleet calendar and scheduling
        • Trip history and logs
        
        🔧 **Maintenance & Service**
        • Maintenance scheduling and logs
        • Service provider management
        • Maintenance alerts and notifications
        • Parts inventory tracking
        
        🛰️ **GPS Tracking**
        • Real-time vehicle tracking
        • Geofence management
        • Route optimization
        • Fleet alerts and notifications
        
        📈 **Analytics & Reports**
        • Fleet performance analytics
        • Cost analysis and reporting
        • Utilization reports
        • Compliance tracking
        
        ⚙️ **Administration**
        • HR synchronization
        • User management
        • System configuration
        • Audit logs
        
        📱 **Mobile Integration**
        • Mobile app support
        • API endpoints
        • Webhook integrations
        • Real-time notifications
    ''',
    'author': 'MESOB Technology Solutions',
    'website': 'https://mesob.com',
    'category': 'Fleet Management',
    'license': 'LGPL-3',
    'depends': ['base', 'fleet', 'hr', 'stock', 'mail', 'web'],
    'external_dependencies': {
        'python': ['requests', 'geopy', 'folium'],
    },
    'data': [
        # Security
        'security/security.xml',
        'security/ir.model.access.csv',

        # Data
        'data/cron.xml',
        'data/sequence.xml',

        # Views - Core Fleet
        'views/fleet_vehicle_views.xml',
        'views/service_record_views.xml',
        'views/fuel_log_views.xml',
        'views/odometer_log_views.xml',
        
        # Views - Maintenance
        'views/maintenance_schedule_views.xml',
        'views/maintenance_log_views.xml',
        
        # Views - Trip Management
        'views/trip_request_views.xml',
        'views/trip_assignment_views.xml',
        
        # Views - Tracking & GPS
        'views/gps_tracking_views.xml',
        
        # Views - Dashboard & Analytics
        'views/dashboard_views.xml',
        
        # Views - Wizards & Mobile
        'views/pickup_update_wizard_views.xml',
        'views/mobile_responsive.xml',
        
        # Menu Structure (must be last)
        'views/menu.xml',
    ],
    'demo': [
        'demo/fleet_demo_data.xml',
    ],
    'assets': {
        'web.assets_backend': [],
        'web.assets_frontend': [],
    },
    'images': [
        'static/description/banner.png',
        'static/description/icon.png',
        'static/description/screenshot_dashboard.png',
        'static/description/screenshot_tracking.png',
    ],
    'pre_init_hook': 'pre_init_hook',
    'post_init_hook': 'post_init_hook',
    'installable': True,
    'application': True,
    'auto_install': False,
    'sequence': 5,  # High priority in app list
    'price': 0.00,
    'currency': 'USD',
}

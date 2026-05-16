#!/usr/bin/env python3
"""
RBAC Group Assignment Script
Assigns users to correct fleet management groups based on their employee roles
"""
import xmlrpc.client
import logging

logging.basicConfig(level=logging.INFO)
_logger = logging.getLogger(__name__)

# Configuration
ODOO_URL = 'http://localhost:8069'
DB_NAME = 'messob_db'
ADMIN_USER = 'admin'
ADMIN_PASSWORD = 'admin'

def connect_odoo():
    """Connect to Odoo via XML-RPC"""
    common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
    uid = common.authenticate(DB_NAME, ADMIN_USER, ADMIN_PASSWORD, {})
    if not uid:
        raise Exception("Authentication failed")
    models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
    return uid, models

def get_group_id(models, uid, group_xml_id):
    """Get group ID from XML ID"""
    try:
        group_ids = models.execute_kw(
            DB_NAME, uid, ADMIN_PASSWORD,
            'ir.model.data', 'search_read',
            [[('name', '=', group_xml_id.split('.')[1]), ('module', '=', group_xml_id.split('.')[0])]],
            {'fields': ['res_id'], 'limit': 1}
        )
        if group_ids:
            return group_ids[0]['res_id']
    except Exception as e:
        _logger.error(f"Error getting group {group_xml_id}: {e}")
    return None

def assign_user_groups(models, uid):
    """Assign users to appropriate groups based on employee data"""
    
    # Get all group IDs
    groups = {
        'fleet_user': get_group_id(models, uid, 'mesob_fleet_customizations.group_fleet_user'),
        'fleet_driver': get_group_id(models, uid, 'mesob_fleet_customizations.group_fleet_driver'),
        'fleet_mechanic': get_group_id(models, uid, 'mesob_fleet_customizations.group_fleet_mechanic'),
        'fleet_dispatcher': get_group_id(models, uid, 'mesob_fleet_customizations.group_fleet_dispatcher'),
        'fleet_manager': get_group_id(models, uid, 'mesob_fleet_customizations.group_fleet_manager'),
    }
    
    _logger.info(f"Group IDs: {groups}")
    
    # Get all employees with user accounts
    employees = models.execute_kw(
        DB_NAME, uid, ADMIN_PASSWORD,
        'hr.employee', 'search_read',
        [[('user_id', '!=', False)]],
        {'fields': ['id', 'name', 'user_id', 'is_driver', 'is_fleet_dispatcher', 'is_fleet_manager']}
    )
    
    _logger.info(f"Found {len(employees)} employees with user accounts")
    
    for emp in employees:
        user_id = emp['user_id'][0] if isinstance(emp['user_id'], list) else emp['user_id']
        user_name = emp['name']
        groups_to_add = []
        
        # Determine which groups to add
        if emp.get('is_fleet_manager'):
            groups_to_add.append(groups['fleet_manager'])
            _logger.info(f"  → {user_name}: Fleet Manager")
        elif emp.get('is_fleet_dispatcher'):
            groups_to_add.append(groups['fleet_dispatcher'])
            _logger.info(f"  → {user_name}: Fleet Dispatcher")
        elif emp.get('is_driver'):
            groups_to_add.append(groups['fleet_driver'])
            _logger.info(f"  → {user_name}: Fleet Driver")
        else:
            groups_to_add.append(groups['fleet_user'])
            _logger.info(f"  → {user_name}: Fleet User (Staff)")
        
        # Add groups to user
        if groups_to_add:
            try:
                # Get current groups
                user_data = models.execute_kw(
                    DB_NAME, uid, ADMIN_PASSWORD,
                    'res.users', 'read',
                    [user_id],
                    {'fields': ['groups_id']}
                )
                
                current_groups = user_data[0]['groups_id'] if user_data else []
                
                # Add new groups (avoid duplicates)
                new_groups = list(set(current_groups + [g for g in groups_to_add if g]))
                
                # Update user
                models.execute_kw(
                    DB_NAME, uid, ADMIN_PASSWORD,
                    'res.users', 'write',
                    [[user_id], {'groups_id': [(6, 0, new_groups)]}]
                )
                _logger.info(f"    ✓ Updated groups for {user_name}")
            except Exception as e:
                _logger.error(f"    ✗ Error updating {user_name}: {e}")

def create_test_users(models, uid):
    """Create test users for each role if they don't exist"""
    
    test_users = [
        {
            'name': 'Fleet Manager Test',
            'login': 'manager@mesob.et',
            'password': 'manager123',
            'is_fleet_manager': True,
            'is_fleet_dispatcher': False,
            'is_driver': False,
        },
        {
            'name': 'Fleet Dispatcher Test',
            'login': 'dispatcher@mesob.et',
            'password': 'dispatcher123',
            'is_fleet_manager': False,
            'is_fleet_dispatcher': True,
            'is_driver': False,
        },
        {
            'name': 'Driver Test',
            'login': 'driver@mesob.et',
            'password': 'driver123',
            'is_fleet_manager': False,
            'is_fleet_dispatcher': False,
            'is_driver': True,
            'driver_license_number': 'DL-TEST-001',
        },
        {
            'name': 'Mechanic Test',
            'login': 'mechanic@mesob.et',
            'password': 'mechanic123',
            'is_fleet_manager': False,
            'is_fleet_dispatcher': False,
            'is_driver': False,
            'job_title': 'Mechanic',
        },
        {
            'name': 'Staff User Test',
            'login': 'staff@mesob.et',
            'password': 'staff123',
            'is_fleet_manager': False,
            'is_fleet_dispatcher': False,
            'is_driver': False,
        },
    ]
    
    for user_data in test_users:
        try:
            # Check if user exists
            existing = models.execute_kw(
                DB_NAME, uid, ADMIN_PASSWORD,
                'res.users', 'search',
                [[('login', '=', user_data['login'])]]
            )
            
            if existing:
                _logger.info(f"User {user_data['login']} already exists")
                continue
            
            # Create user
            user_id = models.execute_kw(
                DB_NAME, uid, ADMIN_PASSWORD,
                'res.users', 'create',
                [{
                    'name': user_data['name'],
                    'login': user_data['login'],
                    'password': user_data['password'],
                }]
            )
            
            # Create employee
            emp_vals = {
                'name': user_data['name'],
                'user_id': user_id,
                'is_driver': user_data.get('is_driver', False),
                'is_fleet_dispatcher': user_data.get('is_fleet_dispatcher', False),
                'is_fleet_manager': user_data.get('is_fleet_manager', False),
            }
            
            if user_data.get('driver_license_number'):
                emp_vals['driver_license_number'] = user_data['driver_license_number']
            if user_data.get('job_title'):
                emp_vals['job_title'] = user_data['job_title']
            
            models.execute_kw(
                DB_NAME, uid, ADMIN_PASSWORD,
                'hr.employee', 'create',
                [emp_vals]
            )
            
            _logger.info(f"✓ Created test user: {user_data['login']} / {user_data['password']}")
            
        except Exception as e:
            _logger.error(f"✗ Error creating user {user_data['login']}: {e}")

def main():
    """Main execution"""
    try:
        _logger.info("=" * 60)
        _logger.info("RBAC Group Assignment Script")
        _logger.info("=" * 60)
        
        uid, models = connect_odoo()
        _logger.info(f"✓ Connected to Odoo as user ID: {uid}")
        
        _logger.info("\n1. Creating test users...")
        create_test_users(models, uid)
        
        _logger.info("\n2. Assigning groups to users...")
        assign_user_groups(models, uid)
        
        _logger.info("\n" + "=" * 60)
        _logger.info("✓ RBAC setup complete!")
        _logger.info("=" * 60)
        _logger.info("\nTest Credentials:")
        _logger.info("  Manager:    manager@mesob.et / manager123")
        _logger.info("  Dispatcher: dispatcher@mesob.et / dispatcher123")
        _logger.info("  Driver:     driver@mesob.et / driver123")
        _logger.info("  Mechanic:   mechanic@mesob.et / mechanic123")
        _logger.info("  Staff:      staff@mesob.et / staff123")
        _logger.info("=" * 60)
        
    except Exception as e:
        _logger.error(f"Error: {e}", exc_info=True)

if __name__ == '__main__':
    main()

# MESOB Fleet Management - Backend Integration Guide

## Step 1: Configure System Parameters

### Navigate to System Parameters:
1. Go to **Settings** → **Technical** → **System Parameters**
2. Click **Create** to add new parameters

### Required Parameters for Backend Integration:

#### HR System Integration:
- **Key**: `mesob.hr_sync_url`
- **Value**: `http://your-hr-backend.com/api/employees`
- **Description**: URL for HR employee synchronization

#### GPS Tracking Integration:
- **Key**: `mesob.gps_gateway_url`
- **Value**: `http://your-gps-backend.com/api/locations`
- **Description**: GPS tracking service endpoint

#### Notification Service:
- **Key**: `mesob.notification_service_url`
- **Value**: `http://your-notification-backend.com/api/send`
- **Description**: Email/SMS notification service

#### API Authentication:
- **Key**: `mesob.api_key`
- **Value**: `your-secure-api-key-here`
- **Description**: Authentication key for external services

## Step 2: Configure Scheduled Actions (Cron Jobs)

### Navigate to Scheduled Actions:
1. Go to **Settings** → **Technical** → **Automation** → **Scheduled Actions**
2. Find "HR Employee Sync" action
3. Set it to run every hour: `0 * * * *`

## Step 3: Set Up External API Endpoints

### Your Python Backend Should Provide These Endpoints:

#### HR System API:
```
GET /api/employees
Response: [
  {
    "external_hr_id": "EMP001",
    "name": "John Doe",
    "email": "john@mesob.com",
    "job_title": "Driver",
    "department": "Fleet Operations",
    "is_driver": true,
    "driver_license_number": "DL123456",
    "license_expiry_date": "2025-12-31"
  }
]
```

#### GPS Tracking API:
```
POST /api/locations
Body: {
  "vehicle_id": "VEHICLE001",
  "latitude": 9.0192,
  "longitude": 38.7525,
  "timestamp": "2024-03-27T10:30:00Z",
  "speed": 45.5,
  "heading": 180
}
```

#### Notification API:
```
POST /api/send
Body: {
  "type": "email",
  "recipient": "user@mesob.com",
  "subject": "Trip Request Approved",
  "message": "Your trip request has been approved.",
  "template": "trip_approval"
}
```

## Step 4: Database Integration

### Configure Database Connection:
1. Go to **Settings** → **Technical** → **Database Structure** → **External Database**
2. Add connection details for your external systems

## Step 5: Test Integration

### Test HR Sync:
1. Go to **MESSOB Fleet** → **Configuration** → **HR Sync**
2. Click "Sync Now" button
3. Check **Employees** menu for synced data

### Test GPS Integration:
1. Go to **MESSOB Fleet** → **Vehicles**
2. Open a vehicle record
3. Check "Location History" tab

### Test Notifications:
1. Create a trip request
2. Approve it as dispatcher
3. Check if notification was sent

## Step 6: Mobile App Integration

### Configure Mobile API:
1. Enable REST API access
2. Set up JWT authentication
3. Configure mobile app endpoints

### Mobile API Endpoints:
- `GET /api/fleet/vehicles` - Get vehicle list
- `POST /api/fleet/trip-requests` - Create trip request
- `GET /api/fleet/my-trips` - Get user's trips
- `PUT /api/fleet/trip-status` - Update trip status

## Step 7: Inventory Integration

### Link with Stock Module:
1. Go to **Inventory** → **Configuration** → **Locations**
2. Create "Fleet Vehicles" location
3. Configure automatic stock movements

## Step 8: Reporting Integration

### Configure Business Intelligence:
1. Go to **MESSOB Fleet** → **Reporting**
2. Set up automated reports
3. Configure dashboard widgets

## Troubleshooting

### Common Issues:
1. **HR Sync Fails**: Check URL and API key
2. **GPS Not Working**: Verify GPS service connection
3. **Notifications Not Sent**: Check email configuration
4. **Mobile App Issues**: Verify API authentication

### Log Files:
- Check Odoo logs: `/var/log/odoo/odoo.log`
- HR sync logs: **Settings** → **Technical** → **Logging**
- API access logs: **Settings** → **Technical** → **API Logs**
# Test GPS webhook — PowerShell version (no curl needed)
# Usage: .\test_gps_webhook.ps1
# Make sure mesob.api_key is set in Odoo System Parameters first

$OdooUrl = "http://localhost:8069"
$ApiKey  = "mesob_test_key"   # Must match mesob.api_key in System Parameters

# --- Test 1: Single GPS update via webhook ---
Write-Host "`n[Test 1] Sending GPS update for vehicle AA-001-ET..." -ForegroundColor Cyan

$body = @{
    vehicle_plate = "AA-001-ET"
    latitude      = 9.0054
    longitude     = 38.7636
    speed         = 45.5
    heading       = 90
    accuracy      = 5.0
    altitude      = 2355.0
    engine_on     = $true
    fuel_level    = 78.5
    odometer      = 45231.2
    timestamp     = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod `
        -Uri "$OdooUrl/webhook/gps/location-update" `
        -Method POST `
        -ContentType "application/json" `
        -Headers @{ "X-API-Key" = $ApiKey } `
        -Body $body
    Write-Host "  Response: $($response | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "  Error: $_" -ForegroundColor Red
}

# --- Test 2: Get vehicle location via API ---
Write-Host "`n[Test 2] Getting vehicle location (vehicle ID 1)..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod `
        -Uri "$OdooUrl/api/fleet/vehicles/1/location" `
        -Method POST `
        -ContentType "application/json" `
        -Body "{}"
    Write-Host "  Response: $($response | ConvertTo-Json -Depth 5)" -ForegroundColor Green
} catch {
    Write-Host "  Error: $_" -ForegroundColor Red
}

# --- Test 3: Get all real-time locations ---
Write-Host "`n[Test 3] Getting all vehicle locations..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod `
        -Uri "$OdooUrl/api/fleet/vehicles" `
        -Method POST `
        -ContentType "application/json" `
        -Body "{}"
    Write-Host "  Total vehicles: $($response.vehicles.Count)" -ForegroundColor Green
    $response.vehicles | ForEach-Object {
        Write-Host "    $($_.name) [$($_.license_plate)] — Status: $($_.mesob_status) — GPS: $($_.current_location.latitude), $($_.current_location.longitude)" -ForegroundColor White
    }
} catch {
    Write-Host "  Error: $_" -ForegroundColor Red
}

Write-Host "`nDone." -ForegroundColor Yellow
